import { copyFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

import { resolveAssets } from '../core/dataset'
import { SdeError } from '../core/errors'
import { createBlobStore, type BlobStore } from '../node/blob-store'
import { writeDts } from '../node/dts'
import { loadConfig, resolveConfig, tableModes, type EveSdeConfig, type ResolvedConfig } from '../node/config'
import { runDatasets, type DatasetResult } from '../node/datasets'
import { files } from '../node/files-source'
import { createLockfile, readLockfile, writeLockfile, type Lockfile } from '../node/lockfile'
import { fetchLatestManifest } from '../core/manifest'
import { createSde } from '../core/sde'

/**
 * Inline config, or `{ configFile }` to load one. Without options the plugin reads `eve-sde.config.*` from the project
 * root. Dataset module types are only typed when the config comes from a file.
 */
export type SdePluginOptions = EveSdeConfig | { configFile: string }

export type Environment = 'client' | 'server'

/** Emits a file into the build output and returns a JS expression for its URL. */
export type EmitAsset = (fileName: string, source: Uint8Array) => string

export const configModuleId = '@eve-online-tools/eve-sde/config'
export const datasetPrefix = 'eve-sde:dataset/'
export const tablePrefix = 'eve-sde:table/'
const virtualConfigId = '\0eve-sde:config'

/** Directory, relative to the output root, that server builds copy FlatBuffers files into. */
export const serverFilesDir = 'eve-sde'
/** Replaced per chunk with the URL of `serverFilesDir`, since chunks can live in nested output folders. */
export const serverFilesToken = '__EVE_SDE_SERVER_FILES__'

const json = (value: unknown): string => JSON.stringify(value)

export type PluginState = {
  config: ResolvedConfig
  lockfile: Lockfile
  datasets: ReadonlyMap<string, DatasetResult>
  store: BlobStore
}

export const createPluginCore = (options: SdePluginOptions | undefined) => {
  let state: Promise<PluginState> | undefined
  /** File name under `serverFilesDir` -> cached source path. */
  const serverFiles = new Map<string, string>()

  const setup = async (root: string, log: (message: string) => void): Promise<PluginState> => {
    const config =
      options === undefined || 'configFile' in options
        ? await loadConfig(root, options?.configFile)
        : resolveConfig(options, root)
    let lockfile = await readLockfile(config.lockfile)
    if (!lockfile) {
      lockfile = await createLockfile(globalThis.fetch, await fetchLatestManifest(globalThis.fetch))
      await writeLockfile(config.lockfile, lockfile)
      log(`Locked SDE release ${lockfile.release} in ${config.lockfile}.`)
    }
    const unknown = Object.keys(config.tables).filter((table) => !lockfile.tables[table])
    if (unknown.length > 0) {
      throw new SdeError(
        `eve-sde config: SDE release ${lockfile.release} has no table ${unknown.map((table) => `"${table}"`).join(', ')}.`,
      )
    }
    const datasets = await runDatasets({
      datasets: config.datasets,
      lockfile,
      cacheDir: config.cacheDir,
      root: config.root,
    })
    if (config.dts) {
      await writeDts(config, lockfile)
    }
    return { config, lockfile, datasets, store: createBlobStore({ dir: config.cacheDir }) }
  }

  /** Runs once per plugin instance; every environment's build shares the result. */
  const init = (root: string, log: (message: string) => void): Promise<PluginState> => {
    state ??= setup(root, log)
    return state
  }

  const ready = (): Promise<PluginState> => {
    if (!state) {
      throw new SdeError('eve-sde plugin used before buildStart.')
    }
    return state
  }

  const resolveId = (id: string): string | undefined => {
    if (id === configModuleId) {
      return virtualConfigId
    }
    if (id.startsWith(datasetPrefix) || id.startsWith(tablePrefix)) {
      return `\0${id}`
    }
    return undefined
  }

  const tableModule = async (table: string): Promise<string> => {
    const { config, lockfile } = await ready()
    const sde = createSde({ sources: [files({ lockfile, cacheDir: config.cacheDir })], updates: 'off' })
    const rows: unknown[] = []
    for await (const row of sde.table(table as never).list()) {
      rows.push(row)
    }
    // JSON.parse of a string literal parses faster than an equivalent object literal.
    return `export default JSON.parse(${json(JSON.stringify(rows))})`
  }

  const datasetModule = async (id: string, emit: EmitAsset): Promise<string> => {
    const { datasets, config } = await ready()
    const result = datasets.get(id)
    if (!result) {
      const known = [...datasets.keys()]
      throw new SdeError(
        `Dataset "${id}" is not registered. Add it to \`datasets\` in the eve-sde config${config.datasets.length > 0 ? ` (registered: ${known.join(', ')})` : ''}.`,
      )
    }
    const output = await result.load()
    const placeholders = new Map<string, string>()
    const value = resolveAssets(output.value, (fileName) => {
      const marker = `__eve_sde_asset_${placeholders.size}__`
      placeholders.set(marker, emit(fileName, output.assets.get(fileName)!))
      return marker
    })
    let code = `export default JSON.parse(${json(JSON.stringify(value))})`
    if (placeholders.size > 0) {
      // Asset URLs are expressions, so the value is rebuilt with them substituted after parsing.
      const replacements = [...placeholders].map(([marker, url]) => `[${json(marker)}, ${url}]`).join(', ')
      code = `const urls = new Map([${replacements}])
const resolve = (value) =>
  typeof value === 'string' ? (urls.get(value) ?? value)
  : Array.isArray(value) ? value.map(resolve)
  : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, resolve(v)]))
  : value
export default resolve(JSON.parse(${json(JSON.stringify(value))}))`
    }
    return code
  }

  /** Options of the shared `sde` instance for one environment. */
  const configModule = async (environment: Environment, command: 'build' | 'serve') => {
    const { config, lockfile, store } = await ready()
    const tables = Object.keys(config.tables).sort()
    const byMode = (mode: string) => tables.filter((table) => tableModes(config, table)[environment] === mode)
    const embedTables = byMode('embed')
    const fileTables = environment === 'server' ? byMode('files') : []
    const bulkTables = byMode('bulk')
    const recordTables = byMode('record')
    const defaultMode = config.defaults[environment]

    const imports = [`import { embedded, remote } from '@eve-online-tools/eve-sde'`]
    const sources: string[] = []

    if (embedTables.length > 0) {
      const loaders = embedTables
        .map((table) => `${json(table)}: () => import(${json(`${tablePrefix}${table}`)}).then((m) => m.default)`)
        .join(', ')
      const versions = Object.fromEntries(embedTables.map((table) => [table, lockfile.tables[table]!.version]))
      sources.push(`embedded({ ${loaders} }, { versions: ${json(versions)} })`)
    }

    if (fileTables.length > 0) {
      imports.push(`import { files } from '@eve-online-tools/eve-sde/node'`)
      const locked = { ...lockfile, tables: Object.fromEntries(fileTables.map((t) => [t, lockfile.tables[t]!])) }
      if (command === 'serve') {
        sources.push(
          `files({ lockfile: ${json(locked)}, cacheDir: ${json(config.cacheDir)}, tables: ${json(fileTables)} })`,
        )
      } else {
        imports.push(`import { fileURLToPath } from 'node:url'`)
        const paths: string[] = []
        for (const table of fileTables) {
          const [fb, bfbs] = await Promise.all(
            (['fb', 'bfbs'] as const).map(async (kind) => {
              const source = await store.ensure(lockfile, table, kind)
              const fileName = `${lockfile.tables[table]![kind]}.${kind}`
              serverFiles.set(fileName, source)
              return `fileURLToPath(new URL(${json(fileName)}, ${serverFilesToken}))`
            }),
          )
          paths.push(`${json(table)}: { fb: ${fb}, bfbs: ${bfbs} }`)
        }
        sources.push(`files({ lockfile: ${json(locked)}, paths: { ${paths.join(', ')} } })`)
      }
    }

    const explicitRemote = defaultMode === 'bulk' ? recordTables : bulkTables
    if (explicitRemote.length > 0) {
      const mode = defaultMode === 'bulk' ? 'record' : 'bulk'
      sources.push(`remote({ get: ${json(mode)}, tables: ${json(explicitRemote)} })`)
    }
    sources.push(`remote({ get: ${json(defaultMode)} })`)

    const onStale = Object.fromEntries(
      tables.filter((table) => config.tables[table]?.onStale).map((table) => [table, config.tables[table]!.onStale]),
    )

    // Servers render with the locked release, so prerendered pages match build-time tables. Browsers start at latest:
    // a hydrated page adopts the server's release instead, and a cold start avoids fetching a release it would leave.
    const release = environment === 'server' ? lockfile.release : 'latest'
    return `${imports.join('\n')}
export default () => ({
  release: ${json(release)},
  onStale: ${json(onStale)},
  sources: [
    ${sources.join(',\n    ')},
  ],
})
`
  }

  const load = async (id: string, environment: Environment, command: 'build' | 'serve', emit: EmitAsset) => {
    if (id === virtualConfigId) {
      return configModule(environment, command)
    }
    if (id.startsWith(`\0${tablePrefix}`)) {
      return tableModule(id.slice(tablePrefix.length + 1))
    }
    if (id.startsWith(`\0${datasetPrefix}`)) {
      return datasetModule(id.slice(datasetPrefix.length + 1), emit)
    }
    return undefined
  }

  /** Replaces the server files token in a rendered chunk; `undefined` when the chunk doesn't use it. */
  const renderChunk = (code: string, chunkFileName: string): string | undefined => {
    if (!code.includes(serverFilesToken)) {
      return undefined
    }
    const depth = chunkFileName.split('/').length - 1
    const base = `${'../'.repeat(depth) || './'}${serverFilesDir}/`
    return code.replaceAll(serverFilesToken, `new URL(${json(base)}, import.meta.url)`)
  }

  /** Copies the FlatBuffers files referenced by server chunks into the output directory. */
  const writeServerFiles = async (outDir: string): Promise<void> => {
    if (serverFiles.size === 0) {
      return
    }
    await mkdir(join(outDir, serverFilesDir), { recursive: true })
    await Promise.all(
      [...serverFiles].map(([fileName, source]) => copyFile(source, join(outDir, serverFilesDir, fileName))),
    )
  }

  return { init, ready, resolveId, load, renderChunk, writeServerFiles }
}
