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

export type DatasetResult = {
  id: string
  fingerprint: string
  /** JSON value; emitted files appear as asset placeholders. */
  value: unknown
  assets: ReadonlyMap<string, Uint8Array>
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
  return sha256(JSON.stringify({ id: dataset.id, version: dataset.version, tables, dependencies }))
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

/** Builds datasets in dependency order, reusing cached results whose inputs are unchanged. */
export const runDatasets = async (options: RunDatasetsOptions): Promise<Map<string, DatasetResult>> => {
  const { lockfile, cacheDir, root } = options
  const sde = createSde({
    release: lockfileManifest(lockfile),
    sources: [options.source ?? files({ lockfile, cacheDir })],
    updates: 'off',
  })
  const results = new Map<string, DatasetResult>()
  const values = new Map<string, unknown>()

  for (const dataset of orderDatasets(options.datasets)) {
    const dependencies = (dataset.dependsOn ?? []).map((dependency) => results.get(dependency.id)!.fingerprint)
    const fingerprint = fingerprintOf(dataset, lockfile, dependencies)
    const dir = cacheDirOf(cacheDir, dataset.id, fingerprint)

    let cached = await readCache(dir)
    if (!cached) {
      cached = await build(dataset, sde, lockfile, values)
      await mkdir(dir, { recursive: true })
      await writeCache(dir, cached)
    }

    if (dataset.outDir) {
      const outDir = resolve(root, dataset.outDir)
      const marker = await readMarker(outDir)
      if (marker[dataset.id] !== fingerprint) {
        await writeFiles(outDir, cached.writes)
        await mkdir(outDir, { recursive: true })
        await writeFile(
          join(outDir, markerFileName),
          `${JSON.stringify({ ...marker, [dataset.id]: fingerprint }, null, 2)}\n`,
        )
      }
    }

    values.set(dataset.id, cached.value)
    results.set(dataset.id, { id: dataset.id, fingerprint, value: cached.value, assets: cached.assets })
  }

  return results
}
