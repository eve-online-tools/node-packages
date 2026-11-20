import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, join, relative, resolve } from 'node:path'

import type { Dataset, DatasetAsset, DatasetContext } from '../core/dataset'
import { SdeError } from '../core/errors'
import { createSde, type Sde } from '../core/sde'
import type { TableName } from '../core/types'
import type { SdeSource } from '../sources/types'
import { files } from './files-source'
import { lockfileManifest, type Lockfile } from './lockfile'

export type DatasetOutput = {
  /** JSON value; emitted files appear as asset placeholders. */
  value: unknown
  assets: ReadonlyMap<string, Uint8Array>
}

export type DatasetResult = {
  id: string
  fingerprint: string
  /** Reads the cached output, building the dataset when the cache has none. */
  load: () => Promise<DatasetOutput>
}

export type RunDatasetsOptions = {
  datasets: readonly Dataset<unknown, TableName>[]
  lockfile: Lockfile
  cacheDir: string
  /** Base for dataset `outDir`. */
  root: string
  /** Where tables are read from. Default: `files()` over the lockfile. */
  source?: SdeSource
}

const markerFileName = '.eve-sde-dataset.json'

declare const __EVE_SDE_VERSION__: string | undefined
// Set by the package build; decoder fixes in a new release must not reuse results cached by an older one.
const packageVersion = typeof __EVE_SDE_VERSION__ === 'string' ? __EVE_SDE_VERSION__ : 'source'

const toBytes = (data: Uint8Array | string): Uint8Array =>
  typeof data === 'string' ? new TextEncoder().encode(data) : data

const sha256 = (text: string): string => createHash('sha256').update(text).digest('hex')

const safeJoin = (base: string, relativePath: string, what: string): string => {
  const target = resolve(base, relativePath)
  const rel = relative(base, target)
  if (rel === '' || rel.startsWith('..') || isAbsolute(rel)) {
    throw new SdeError(`${what} "${relativePath}" must stay inside ${base}.`)
  }
  return target
}

/** All datasets including transitive dependencies, dependencies first. */
export const orderDatasets = (roots: readonly Dataset<unknown, TableName>[]): Dataset<unknown, TableName>[] => {
  const ordered: Dataset<unknown, TableName>[] = []
  const byId = new Map<string, Dataset<unknown, TableName>>()
  const visiting = new Set<string>()

  const visit = (dataset: Dataset<unknown, TableName>, path: string[]): void => {
    const known = byId.get(dataset.id)
    if (known && known !== dataset) {
      throw new SdeError(`Two different datasets use the id "${dataset.id}".`)
    }
    if (known) {
      return
    }
    if (visiting.has(dataset.id)) {
      throw new SdeError(`Dataset dependency cycle: ${[...path, dataset.id].join(' -> ')}.`)
    }
    visiting.add(dataset.id)
    for (const dependency of dataset.dependsOn ?? []) {
      visit(dependency, [...path, dataset.id])
    }
    visiting.delete(dataset.id)
    byId.set(dataset.id, dataset)
    ordered.push(dataset)
  }

  for (const dataset of roots) {
    visit(dataset, [])
  }
  return ordered
}

const fingerprintOf = (dataset: Dataset<unknown, TableName>, lock: Lockfile, dependencies: string[]): string => {
  const tables = [...dataset.tables].sort().map((table) => {
    const locked = lock.tables[table]
    if (!locked) {
      throw new SdeError(`Dataset "${dataset.id}" reads "${table}", which is not in release ${lock.release}.`)
    }
    return [table, locked.version]
  })
  // The build source catches edits made without bumping `version`; helpers it calls are still covered by `version` only.
  return sha256(
    JSON.stringify({
      id: dataset.id,
      version: dataset.version,
      build: String(dataset.build),
      eveSde: packageVersion,
      tables,
      dependencies,
    }),
  )
}

type CachedDataset = { value: unknown; assets: Map<string, Uint8Array>; writes: Map<string, Uint8Array> }

const cacheDirOf = (cacheDir: string, id: string, fingerprint: string): string =>
  join(cacheDir, 'datasets', encodeURIComponent(id), fingerprint)

const readFilesIn = async (dir: string): Promise<Map<string, Uint8Array>> => {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true }).catch(() => [])
  const result = new Map<string, Uint8Array>()
  for (const entry of entries) {
    if (entry.isFile()) {
      const path = join(entry.parentPath, entry.name)
      result.set(relative(dir, path).split('\\').join('/'), await readFile(path))
    }
  }
  return result
}

const writeFiles = async (dir: string, files: ReadonlyMap<string, Uint8Array>): Promise<void> => {
  for (const [name, bytes] of files) {
    const path = safeJoin(dir, name, 'File')
    await mkdir(dirname(path), { recursive: true })
    await writeFile(path, bytes)
  }
}

const readCache = async (dir: string): Promise<CachedDataset | undefined> => {
  let value: string
  try {
    value = await readFile(join(dir, 'value.json'), 'utf8')
  } catch {
    return undefined
  }
  return {
    value: JSON.parse(value),
    assets: await readFilesIn(join(dir, 'assets')),
    writes: await readFilesIn(join(dir, 'writes')),
  }
}

const writeCache = async (dir: string, cached: CachedDataset): Promise<void> => {
  await writeFiles(join(dir, 'assets'), cached.assets)
  await writeFiles(join(dir, 'writes'), cached.writes)
  // value.json last: its presence marks a complete entry.
  await writeFile(join(dir, 'value.json'), JSON.stringify(cached.value ?? null))
}

const readMarker = async (outDir: string): Promise<Record<string, string>> => {
  try {
    return JSON.parse(await readFile(join(outDir, markerFileName), 'utf8')) as Record<string, string>
  } catch {
    return {}
  }
}

const build = async (
  dataset: Dataset<unknown, TableName>,
  sde: Sde,
  lock: Lockfile,
  values: ReadonlyMap<string, unknown>,
): Promise<CachedDataset> => {
  const declared = new Set<string>(dataset.tables)
  const dependencies = new Set((dataset.dependsOn ?? []).map((dependency) => dependency.id))
  const assets = new Map<string, Uint8Array>()
  const writes = new Map<string, Uint8Array>()

  const ctx: DatasetContext<TableName> = {
    release: { release: lock.release, buildNumber: lock.buildNumber, releaseDate: lock.releaseDate },
    table: (name) => {
      if (!declared.has(name)) {
        throw new SdeError(`Dataset "${dataset.id}" reads "${name}" without declaring it in "tables".`)
      }
      return sde.table(name)
    },
    dataset: <Value>(dependency: Dataset<Value>) => {
      if (!dependencies.has(dependency.id)) {
        throw new SdeError(`Dataset "${dataset.id}" reads "${dependency.id}" without listing it in "dependsOn".`)
      }
      return values.get(dependency.id) as Value
    },
    emit: (fileName, data) => {
      safeJoin('/', fileName, 'Emitted file')
      if (assets.has(fileName)) {
        throw new SdeError(`Dataset "${dataset.id}" emitted "${fileName}" twice.`)
      }
      assets.set(fileName, toBytes(data))
      return { __eveSdeAsset: fileName } as DatasetAsset
    },
    write: async (relativePath, data) => {
      if (!dataset.outDir) {
        throw new SdeError(`Dataset "${dataset.id}" calls write() but has no outDir.`)
      }
      safeJoin('/', relativePath, 'Written file')
      writes.set(relativePath, toBytes(data))
    },
  }

  const value = await dataset.build(ctx)
  return { value, assets, writes }
}

/**
 * Resolves datasets in dependency order. Outputs are built when their cache entry is missing, except for datasets whose
 * `outDir` is already up to date: those build only when something loads their value.
 */
export const runDatasets = async (options: RunDatasetsOptions): Promise<Map<string, DatasetResult>> => {
  const { lockfile, cacheDir, root } = options
  const sde = createSde({
    release: lockfileManifest(lockfile),
    sources: [options.source ?? files({ lockfile, cacheDir })],
    updates: 'off',
  })
  const results = new Map<string, DatasetResult>()

  for (const dataset of orderDatasets(options.datasets)) {
    const dependencies = (dataset.dependsOn ?? []).map((dependency) => results.get(dependency.id)!)
    const fingerprint = fingerprintOf(
      dataset,
      lockfile,
      dependencies.map((dependency) => dependency.fingerprint),
    )
    const dir = cacheDirOf(cacheDir, dataset.id, fingerprint)

    let loading: Promise<CachedDataset> | undefined
    const load = (): Promise<CachedDataset> => {
      loading ??= (async () => {
        const cached = await readCache(dir)
        if (cached) {
          return cached
        }
        const values = new Map<string, unknown>()
        for (const dependency of dependencies) {
          values.set(dependency.id, (await dependency.load()).value)
        }
        const built = await build(dataset, sde, lockfile, values)
        await mkdir(dir, { recursive: true })
        await writeCache(dir, built)
        return built
      })()
      return loading
    }

    const outDir = dataset.outDir && resolve(root, dataset.outDir)
    const marker = outDir ? await readMarker(outDir) : {}
    if (outDir && marker[dataset.id] !== fingerprint) {
      await writeFiles(outDir, (await load()).writes)
      await mkdir(outDir, { recursive: true })
      await writeFile(
        join(outDir, markerFileName),
        `${JSON.stringify({ ...marker, [dataset.id]: fingerprint }, null, 2)}\n`,
      )
    } else if (!outDir) {
      await load()
    }

    results.set(dataset.id, { id: dataset.id, fingerprint, load })
  }

  return results
}
