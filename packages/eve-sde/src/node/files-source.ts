import { readFile } from 'node:fs/promises'

import { SdeError } from '../core/errors'
import type { AnyKey, AnyRow } from '../core/types'
import { openFbTable, type FbTable } from '../formats/fb'
import type { SdeSource } from '../sources/types'
import { createBlobStore, type BlobStore } from './blob-store'
import type { Lockfile } from './lockfile'

export type FilesOptions = {
  lockfile: Lockfile
  /** Directory holding `blobs/`. */
  cacheDir?: string
  /** Explicit file locations per table, e.g. assets copied into a server build. Tables listed here never download. */
  paths?: Readonly<Record<string, { fb: string; bfbs: string }>>
  /** Download missing blobs. Default `true`; server bundles set `false` and ship the blobs they need. */
  download?: boolean
  /** Restrict to these tables; the rest fall through to the next source. Default: every locked table. */
  tables?: readonly string[]
}

/** Serves locked tables from local FlatBuffers files. Node only. */
export const files = (options: FilesOptions): SdeSource => {
  const store: BlobStore | undefined =
    options.cacheDir === undefined ? undefined : createBlobStore({ dir: options.cacheDir, download: options.download })
  const served = new Set(options.tables ?? Object.keys(options.paths ?? options.lockfile.tables))

  const pathOf = async (table: string, kind: 'fb' | 'bfbs'): Promise<string> => {
    const explicit = options.paths?.[table]?.[kind]
    if (explicit) {
      return explicit
    }
    if (!store) {
      throw new SdeError(`files(): no path for ${table}.${kind} and no cacheDir to download it into.`)
    }
    return store.ensure(options.lockfile, table, kind)
  }
  const opened = new Map<string, Promise<FbTable>>()

  const open = (table: string): Promise<FbTable> => {
    let pending = opened.get(table)
    if (!pending) {
      pending = Promise.all([
        pathOf(table, 'fb').then((path) => readFile(path)),
        pathOf(table, 'bfbs').then((path) => readFile(path)),
      ]).then(([data, schema]) => openFbTable(data, schema))
      pending.catch(() => opened.delete(table))
      opened.set(table, pending)
    }
    return pending
  }

  return {
    name: 'files',
    versions: Object.fromEntries([...served].map((table) => [table, options.lockfile.tables[table]?.version ?? ''])),
    has: (table) => served.has(table),
    get: async (_ctx, table, keys, projection) => {
      const fb = await open(table)
      const rows = new Map<AnyKey, AnyRow>()
      for (const key of keys) {
        const row = fb.get(key, projection)
        if (row) {
          rows.set(key, row)
        }
      }
      return rows
    },
    list: async function* (_ctx, table, projection) {
      yield* (await open(table)).rows(projection)
    },
  }
}
