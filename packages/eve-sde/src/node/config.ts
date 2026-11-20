import { existsSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

import type { Dataset } from '../core/dataset'
import { SdeError } from '../core/errors'
import type { TableName } from '../core/types'
import { orderDatasets } from './datasets'
import { defaultLockfilePath } from './lockfile'

/**
 * - `embed`: rows bundled as a JSON chunk.
 * - `files`: FlatBuffers files shipped with the server output (server only).
 * - `record`: the HTTP API, one request per row.
 * - `bulk`: the HTTP API, the table's FlatBuffers file downloaded once.
 */
export type RemoteMode = 'record' | 'bulk'
export type ClientMode = 'embed' | RemoteMode
export type ServerMode = ClientMode | 'files'

export type TableConfig = {
  client?: ClientMode
  server?: ServerMode
  /** When the build's copy of the table falls behind the latest release. Default `keep`. */
  onStale?: 'keep' | 'remote'
}

export type EveSdeConfig = {
  /** Default `eve-sde.lock.json`. */
  lockfile?: string
  /** Default `.cache/eve-sde`. */
  cacheDir?: string
  /** Modes for tables not listed in `tables`. Default `record` in both environments. */
  defaults?: { client?: RemoteMode; server?: RemoteMode }
  tables?: Partial<Record<TableName, TableConfig>>
  datasets?: readonly Dataset<any, any>[]
  /**
   * Declaration file for row types of the locked release, e.g. `src/eve-sde.d.ts`. Dataset module types are written
   * next to it (`src/eve-sde.datasets.d.ts`). Written by the build plugins and `eve-sde types`.
   */
  dts?: string
}

export type ResolvedConfig = {
  root: string
  /** Config file the config was loaded from, if any. */
  configFile?: string
  lockfile: string
  cacheDir: string
  defaults: { client: RemoteMode; server: RemoteMode }
  tables: Readonly<Record<string, TableConfig>>
  datasets: readonly Dataset<unknown, TableName>[]
  dts?: string
}

/** Keeps literal dataset types, so generated dataset module types can refer to them. */
export const defineConfig = <const Config extends EveSdeConfig>(config: Config): Config => config

const configFileNames = ['eve-sde.config.ts', 'eve-sde.config.mts', 'eve-sde.config.js', 'eve-sde.config.mjs']

export const resolveConfig = (config: EveSdeConfig, root: string, configFile?: string): ResolvedConfig => {
  const fromRoot = (path: string): string => (isAbsolute(path) ? path : resolve(root, path))
  const defaults = { client: config.defaults?.client ?? 'record', server: config.defaults?.server ?? 'record' }
  for (const mode of Object.values(defaults)) {
    if (mode !== 'record' && mode !== 'bulk') {
      throw new SdeError(`Default modes must be "record" or "bulk", got "${mode}"; list build tables in \`tables\`.`)
    }
  }
  for (const [table, tableConfig] of Object.entries(config.tables ?? {})) {
    if ((tableConfig?.client as ServerMode | undefined) === 'files') {
      throw new SdeError(`tables.${table}.client cannot be "files": browsers have no file system.`)
    }
  }
  return {
    root,
    configFile,
    lockfile: fromRoot(config.lockfile ?? defaultLockfilePath),
    cacheDir: fromRoot(config.cacheDir ?? '.cache/eve-sde'),
    defaults,
    tables: (config.tables ?? {}) as Record<string, TableConfig>,
    datasets: config.datasets ?? [],
    dts: config.dts && fromRoot(config.dts),
  }
}

export const tableModes = (config: ResolvedConfig, table: string): { client: ClientMode; server: ServerMode } => ({
  client: config.tables[table]?.client ?? config.defaults.client,
  server: config.tables[table]?.server ?? config.defaults.server,
})

/** Tables whose data ends up in build output: embedded, shipped as files, or read by datasets. */
export const buildTables = (config: ResolvedConfig): string[] => {
  const tables = new Set<string>()
  for (const table of Object.keys(config.tables)) {
    const { client, server } = tableModes(config, table)
    if (client === 'embed' || server === 'embed' || server === 'files') {
      tables.add(table)
    }
  }
  for (const dataset of orderDatasets(config.datasets)) {
    dataset.tables.forEach((table) => tables.add(table))
  }
  return [...tables].sort()
}

/**
 * Loads `eve-sde.config.{ts,mts,js,mjs}` from `root`, or `file` when given (its directory becomes the root); an empty
 * config when there is none.
 */
export const loadConfig = async (root: string, configFile?: string): Promise<ResolvedConfig> => {
  if (configFile) {
    return loadConfigFile(resolve(root, configFile))
  }
  const file = configFileNames.map((name) => join(root, name)).find((path) => existsSync(path))
  return file ? loadConfigFile(file) : resolveConfig({}, root)
}

/**
 * Imports through Vite's module runner when Vite is installed, so TypeScript configs may import extensionless modules;
 * otherwise through Node, which needs explicit extensions.
 */
const importConfig = async (file: string): Promise<{ default?: EveSdeConfig }> => {
  let vite: typeof import('vite') | undefined
  try {
    vite = await import('vite')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ERR_MODULE_NOT_FOUND') {
      throw error
    }
  }
  // runnerImport arrived in Vite 6.1; older Vite falls back to Node.
  if (vite?.runnerImport) {
    return (await vite.runnerImport<{ default?: EveSdeConfig }>(file, { configFile: false, logLevel: 'error' })).module
  }
  return (await import(pathToFileURL(file).href)) as { default?: EveSdeConfig }
}

const loadConfigFile = async (file: string): Promise<ResolvedConfig> => {
  const module = await importConfig(file)
  if (!module.default) {
    throw new SdeError(`${file} must default-export a config, e.g. \`export default defineConfig({...})\`.`)
  }
  return resolveConfig(module.default, dirname(file), file)
}
