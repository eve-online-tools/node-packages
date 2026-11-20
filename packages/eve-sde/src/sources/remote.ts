import { SdeHttpError } from '../core/errors'
import { request } from '../core/http'
import { tableInfo, type ReleaseManifest } from '../core/manifest'
import { projectRow } from '../core/projection'
import type { AnyKey, AnyRow } from '../core/types'
import { openFbTable, type FbTable } from '../formats/fb'
import { parseJsonLines } from '../formats/jsonl'
import type { SdeSource, SourceContext } from './types'

export type RemoteOptions = {
  /**
   * `record`: one request per key (`<table>/<key>.json`), cheap for sparse lookups.
   * `bulk`: download the table's `.fb` once per table version and look keys up locally.
   */
  get?: 'record' | 'bulk'
  /** Serve only these tables, letting others fall through to the next source. Default: every table. */
  tables?: readonly string[]
}

const recordConcurrency = 16

/** Runs `attempt` against the current release, retrying once when the release turns out to have moved. */
const withRelease = async <T>(
  ctx: SourceContext,
  attempt: (manifest: ReleaseManifest) => Promise<T | undefined>,
): Promise<T | undefined> => {
  const manifest = await ctx.manifest()
  const result = await attempt(manifest)
  if (result !== undefined || !(await ctx.releaseMissing(manifest.release))) {
    return result
  }
  return attempt(await ctx.manifest())
}

const mapLimit = async <T>(items: readonly T[], limit: number, run: (item: T) => Promise<void>): Promise<void> => {
  let next = 0
  const worker = async (): Promise<void> => {
    while (next < items.length) {
      await run(items[next++]!)
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
}

const bytesOf = async (response: Response): Promise<Uint8Array> => new Uint8Array(await response.arrayBuffer())

/** Reads the SDE HTTP API at the instance's current release. */
export const remote = (options: RemoteOptions = {}): SdeSource => {
  const mode = options.get ?? 'record'
  const served = options.tables && new Set(options.tables)
  // Keyed by table version, so a release that leaves the table untouched reuses the download.
  const fbTables = new Map<string, Promise<FbTable | undefined>>()

  const loadFbTable = async (ctx: SourceContext, table: string): Promise<FbTable> => {
    const loaded = await withRelease(ctx, (manifest) => {
      const info = tableInfo(manifest, table)
      let pending = fbTables.get(info.version)
      if (!pending) {
        pending = Promise.all([request(ctx.fetch, info.fbUrl), request(ctx.fetch, info.bfbsUrl)]).then(
          async ([data, schema]) =>
            data && schema ? openFbTable(await bytesOf(data), await bytesOf(schema)) : undefined,
        )
        fbTables.set(info.version, pending)
        pending.then(
          (fb) => fb ?? fbTables.delete(info.version),
          () => fbTables.delete(info.version),
        )
      }
      return pending
    })
    if (!loaded) {
      throw new SdeHttpError(tableInfo(await ctx.manifest(), table).fbUrl, 404)
    }
    return loaded
  }

  const fetchRecord = (ctx: SourceContext, table: string, key: AnyKey): Promise<AnyRow | undefined> =>
    withRelease(ctx, async (manifest) => {
      const url = tableInfo(manifest, table).recordUrlTemplate.replace('{key}', encodeURIComponent(String(key)))
      const response = await request(ctx.fetch, url)
      return response ? ((await response.json()) as AnyRow) : undefined
    })

  return {
    name: 'remote',
    live: true,
    has: (table) => !served || served.has(table),
    get: async (ctx, table, keys, projection) => {
      const result = new Map<AnyKey, AnyRow>()
      if (mode === 'bulk') {
        const fb = await loadFbTable(ctx, table)
        for (const key of keys) {
          const row = fb.get(key, projection)
          if (row) {
            result.set(key, row)
          }
        }
        return result
      }

      await mapLimit(keys, recordConcurrency, async (key) => {
        const row = await fetchRecord(ctx, table, key)
        if (row) {
          result.set(key, projectRow(row, projection))
        }
      })
      return result
    },
    list: async function* (ctx, table, projection) {
      if (mode === 'bulk') {
        yield* (await loadFbTable(ctx, table)).rows(projection)
        return
      }

      const response = await withRelease(ctx, (manifest) => request(ctx.fetch, tableInfo(manifest, table).jsonlUrl))
      if (!response?.body) {
        throw new SdeHttpError(tableInfo(await ctx.manifest(), table).jsonlUrl, 404)
      }
      for await (const row of parseJsonLines(response.body)) {
        yield projectRow(row as AnyRow, projection)
      }
    },
  }
}
