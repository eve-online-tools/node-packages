import { readFile, writeFile } from 'node:fs/promises'

import { SdeError } from '../core/errors'
import type { FetchFn } from '../core/http'
import { sdeTenantUrl, type ReleaseManifest } from '../core/manifest'

export const lockfileVersion = 1
export const defaultLockfilePath = 'eve-sde.lock.json'

/** Blob ids are the sha256 of the file; `version` changes only when the table's data changes. */
export type LockedTable = { version: string; fb: string; bfbs: string }

export type Lockfile = {
  lockfileVersion: typeof lockfileVersion
  release: string
  buildNumber: number
  releaseDate: string
  tables: Record<string, LockedTable>
}

const blobPattern = /\/blobs\/([0-9a-f]{64})\.\w+$/

/** Resolves the content-addressed blob id a release file URL redirects to. */
const resolveBlobId = async (fetchFn: FetchFn, url: string): Promise<string> => {
  const response = await fetchFn(url, { redirect: 'manual' })
  await response.body?.cancel()
  const id = blobPattern.exec(response.headers.get('location') ?? '')?.[1]
  if (!id) {
    throw new SdeError(`Expected ${url} to redirect to a blob, got HTTP ${response.status}.`)
  }
  return id
}

const mapLimit = async <T, R>(items: readonly T[], limit: number, run: (item: T) => Promise<R>): Promise<R[]> => {
  const results = new Array<R>(items.length)
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      const index = next++
      results[index] = await run(items[index]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

/** Builds a lockfile for a release, resolving the blob ids of every table's FlatBuffers files. */
export const createLockfile = async (fetchFn: FetchFn, manifest: ReleaseManifest): Promise<Lockfile> => {
  const names = Object.keys(manifest.tables).sort()
  const tables = await mapLimit(names, 16, async (name): Promise<[string, LockedTable]> => {
    const info = manifest.tables[name]!
    const [fb, bfbs] = await Promise.all([resolveBlobId(fetchFn, info.fbUrl), resolveBlobId(fetchFn, info.bfbsUrl)])
    return [name, { version: info.version, fb, bfbs }]
  })
  return {
    lockfileVersion,
    release: manifest.release,
    buildNumber: manifest.buildNumber,
    releaseDate: manifest.releaseDate,
    tables: Object.fromEntries(tables),
  }
}

const isLockedTable = (value: unknown): value is LockedTable => {
  const table = value as Partial<LockedTable> | null
  return typeof table?.version === 'string' && typeof table.fb === 'string' && typeof table.bfbs === 'string'
}

export const parseLockfile = (json: unknown, source = 'lockfile'): Lockfile => {
  const lock = json as Partial<Lockfile> | null
  if (lock?.lockfileVersion !== lockfileVersion) {
    throw new SdeError(`${source}: unsupported lockfileVersion ${JSON.stringify(lock?.lockfileVersion)}.`)
  }
  if (
    typeof lock.release !== 'string' ||
    typeof lock.buildNumber !== 'number' ||
    typeof lock.releaseDate !== 'string'
  ) {
    throw new SdeError(`${source}: release, buildNumber or releaseDate is missing.`)
  }
  const tables = lock.tables ?? {}
  const invalid = Object.entries(tables).find(([, table]) => !isLockedTable(table))
  if (invalid) {
    throw new SdeError(`${source}: table "${invalid[0]}" needs version, fb and bfbs.`)
  }
  return lock as Lockfile
}

/** Returns `undefined` when the file does not exist. */
export const readLockfile = async (path: string): Promise<Lockfile | undefined> => {
  let text: string
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
  return parseLockfile(JSON.parse(text), path)
}

export const writeLockfile = async (path: string, lock: Lockfile): Promise<void> => {
  await writeFile(path, `${JSON.stringify(lock, null, 2)}\n`, 'utf8')
}

/** Manifest for the locked release, built offline. Its URLs stop working once the release expires. */
export const lockfileManifest = (lock: Lockfile): ReleaseManifest => {
  const base = `${sdeTenantUrl}${lock.release}/`
  return {
    release: lock.release,
    buildNumber: lock.buildNumber,
    releaseDate: lock.releaseDate,
    tables: Object.fromEntries(
      Object.entries(lock.tables).map(([name, { version }]) => [
        name,
        {
          version,
          jsonlUrl: `${base}${name}.jsonl`,
          fbUrl: `${base}${name}.fb`,
          bfbsUrl: `${base}${name}.bfbs`,
          recordUrlTemplate: `${base}${name}/{key}.json`,
        },
      ]),
    ),
  }
}

/** Tables whose data differs between two lockfiles, limited to `relevant` when given. */
export const changedTables = (from: Lockfile | undefined, to: Lockfile, relevant?: Iterable<string>): string[] => {
  const scope = relevant ? new Set(relevant) : undefined
  return Object.keys(to.tables)
    .filter((name) => !scope || scope.has(name))
    .filter((name) => from?.tables[name]?.version !== to.tables[name]!.version)
    .sort()
}
