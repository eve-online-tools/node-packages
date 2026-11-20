import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join, relative } from 'node:path'

import { resolveAssets } from '../core/dataset'
import { SdeError } from '../core/errors'
import type { FetchFn } from '../core/http'
import { fetchLatestManifest } from '../core/manifest'
import { createBlobStore } from './blob-store'
import { buildTables, type ResolvedConfig } from './config'
import { runDatasets } from './datasets'
import { writeDts } from './dts'
import { changedTables, createLockfile, readLockfile, writeLockfile, type Lockfile } from './lockfile'

export type CommandOptions = { config: ResolvedConfig; fetch?: FetchFn; log?: (line: string) => void }

export type UpdateResult = { from?: string; to: string; changed: string[]; written: boolean }

const fetchOf = (options: CommandOptions): FetchFn => options.fetch ?? ((input, init) => globalThis.fetch(input, init))

export const requireLockfile = async (config: ResolvedConfig): Promise<Lockfile> => {
  const lock = await readLockfile(config.lockfile)
  if (!lock) {
    throw new SdeError(`No lockfile at ${config.lockfile}. Run \`eve-sde update\` first.`)
  }
  return lock
}

const describeChanges = (result: UpdateResult): string =>
  result.changed.length === 0
    ? `No relevant changes since ${result.from ?? 'nothing'} (latest ${result.to}).`
    : `${result.from ?? 'nothing'} -> ${result.to}: ${result.changed.join(', ')} changed.`

const latestLock = async (options: CommandOptions): Promise<{ lock: Lockfile; result: UpdateResult }> => {
  const fetchFn = fetchOf(options)
  const previous = await readLockfile(options.config.lockfile)
  const lock = await createLockfile(fetchFn, await fetchLatestManifest(fetchFn))
  const changed = changedTables(previous, lock, buildTables(options.config))
  return { lock, result: { from: previous?.release, to: lock.release, changed, written: false } }
}

/** Locks the latest release. The lockfile is rewritten whenever the release moved; `changed` lists build tables only. */
export const update = async (options: CommandOptions): Promise<UpdateResult> => {
  const { lock, result } = await latestLock(options)
  if (result.from !== result.to) {
    await writeLockfile(options.config.lockfile, lock)
    result.written = true
  }
  options.log?.(describeChanges(result))
  return result
}

/** Like `update`, but read-only. */
export const check = async (options: CommandOptions): Promise<UpdateResult> => {
  const { result } = await latestLock(options)
  options.log?.(describeChanges(result))
  return result
}

/** Downloads the FlatBuffers files of build tables, or of every table with `all`. */
export const fetchBlobs = async (options: CommandOptions & { all?: boolean }): Promise<number> => {
  const lock = await requireLockfile(options.config)
  const store = createBlobStore({ dir: options.config.cacheDir, fetch: options.fetch })
  const tables = options.all ? Object.keys(lock.tables) : buildTables(options.config)
  await Promise.all(tables.flatMap((table) => [store.ensure(lock, table, 'fb'), store.ensure(lock, table, 'bfbs')]))
  options.log?.(`${tables.length} tables of release ${lock.release} cached in ${options.config.cacheDir}.`)
  return tables.length
}

/**
 * Runs the configured datasets without a bundler. Each value is written to `<outDir>/<id>.json` and its emitted files
 * under `<outDir>/<id>/`, with asset placeholders replaced by paths relative to `outDir`.
 */
export const build = async (options: CommandOptions & { outDir: string }): Promise<void> => {
  const lock = await requireLockfile(options.config)
  const results = await runDatasets({
    datasets: options.config.datasets,
    lockfile: lock,
    cacheDir: options.config.cacheDir,
    root: options.config.root,
  })
  for (const result of results.values()) {
    const name = encodeURIComponent(result.id)
    for (const [fileName, bytes] of result.assets) {
      const path = join(options.outDir, name, fileName)
      await mkdir(dirname(path), { recursive: true })
      await writeFile(path, bytes)
    }
    const value = resolveAssets(result.value, (fileName) => `${name}/${fileName}`)
    await mkdir(options.outDir, { recursive: true })
    await writeFile(join(options.outDir, `${name}.json`), `${JSON.stringify(value)}\n`)
  }
  options.log?.(`${results.size} datasets built into ${relative(options.config.root, options.outDir) || '.'}.`)
}

/** Writes row types for the locked release to `config.dts`, replacing the package's shipped types. */
export const types = async (options: CommandOptions): Promise<string> => {
  const lock = await requireLockfile(options.config)
  const { rows } = await writeDts(options.config, lock, fetchOf(options))
  options.log?.(`Row types for release ${lock.release} written to ${relative(options.config.root, rows)}.`)
  return rows
}
