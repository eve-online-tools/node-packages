import { createHash, randomUUID } from 'node:crypto'
import { access, mkdir, rename, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { SdeError, SdeHttpError } from '../core/errors'
import { request, type FetchFn } from '../core/http'
import { sdeTenantUrl } from '../core/manifest'
import type { Lockfile } from './lockfile'

export const sdeBlobUrl = 'https://sde.evetech.net/blobs/'

export type BlobKind = 'fb' | 'bfbs'

export type BlobStore = {
  readonly dir: string
  path: (id: string, kind: BlobKind) => string
  /** Local path of a locked table file, downloading it when missing. */
  ensure: (lock: Lockfile, table: string, kind: BlobKind) => Promise<string>
}

const sha256 = (bytes: Uint8Array): string => createHash('sha256').update(bytes).digest('hex')

const exists = async (path: string): Promise<boolean> => {
  try {
    await access(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

// Keyed by target path: stores over the same directory (dev client and SSR, tests) share downloads.
const inFlight = new Map<string, Promise<string>>()

/**
 * Content-addressed cache of table files. Downloads try the permanent blob URL first and the locked release second,
 * since releases expire after two newer ones while blobs usually stay on the CDN.
 */
export const createBlobStore = (options: { dir: string; fetch?: FetchFn; download?: boolean }): BlobStore => {
  const fetchFn = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
  const blobsDir = join(options.dir, 'blobs')
  const path = (id: string, kind: BlobKind): string => join(blobsDir, `${id}.${kind}`)

  const download = async (lock: Lockfile, table: string, kind: BlobKind, id: string): Promise<Uint8Array> => {
    for (const url of [`${sdeBlobUrl}${id}.${kind}`, `${sdeTenantUrl}${lock.release}/${table}.${kind}`]) {
      const response = await request(fetchFn, url).catch((error: unknown) => {
        // The blob path answers 403 rather than 404 for unknown ids.
        if (error instanceof SdeHttpError && error.status === 403) {
          return undefined
        }
        throw error
      })
      if (!response) {
        continue
      }
      const bytes = new Uint8Array(await response.arrayBuffer())
      if (sha256(bytes) !== id) {
        throw new SdeError(`Downloaded ${url} does not match its locked sha256 ${id}.`)
      }
      return bytes
    }
    throw new SdeError(
      `${table}.${kind} of release ${lock.release} is no longer available (blob ${id}). Run \`eve-sde update\` to lock a current release.`,
    )
  }

  const ensure = async (lock: Lockfile, table: string, kind: BlobKind): Promise<string> => {
    const locked = lock.tables[table]
    if (!locked) {
      throw new SdeError(`Table "${table}" is not in the lockfile for release ${lock.release}.`)
    }
    const id = locked[kind]
    if (!id) {
      throw new SdeError(`Table "${table}" has no FlatBuffers files in release ${lock.release}.`)
    }
    const target = path(id, kind)
    if (await exists(target)) {
      return target
    }
    if (options.download === false) {
      throw new SdeError(`${table}.${kind} (blob ${id}) is missing from ${blobsDir} and downloads are disabled.`)
    }

    const bytes = await download(lock, table, kind, id)
    await mkdir(blobsDir, { recursive: true })
    const temporary = `${target}.${randomUUID()}.tmp`
    await writeFile(temporary, bytes)
    await rename(temporary, target)
    return target
  }

  return {
    dir: options.dir,
    path,
    ensure: (lock, table, kind) => {
      const id = lock.tables[table]?.[kind]
      const key = id ? path(id, kind) : `${blobsDir}:${table}.${kind}`
      let pending = inFlight.get(key)
      if (!pending) {
        pending = ensure(lock, table, kind).finally(() => inFlight.delete(key))
        inFlight.set(key, pending)
      }
      return pending
    },
  }
}
