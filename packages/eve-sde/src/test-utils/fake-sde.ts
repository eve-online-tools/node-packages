import type { AnyRow } from '../core/types'
import { sdeTableKeys } from '../schema/generated/tables'

const base = 'https://sde.evetech.net/tranquility/'

type FakeRelease = { release: string; tables: Record<string, AnyRow[]> }

/**
 * In-memory SDE HTTP API serving manifests, records and JSONL. Releases are published newest last; only the newest
 * `retained` releases resolve, like the real API. FlatBuffers files are served once added with `serveFlatBuffers`.
 */
export const createFakeSde = (options: { retained?: number } = {}) => {
  const releases: FakeRelease[] = []
  const requests: string[] = []
  const retained = options.retained ?? 2
  const binaries = new Map<string, Uint8Array>()

  // FNV-1a over the JSON, so any content change yields a new version.
  const versionOf = (rows: AnyRow[]): string => {
    let hash = 0x811c9dc5
    for (const char of JSON.stringify(rows)) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0
    }
    return `v${hash.toString(16)}`
  }
  const live = () => releases.slice(-retained)
  const find = (release: string) => live().find((candidate) => candidate.release === release)

  const manifestOf = ({ release, tables }: FakeRelease) => ({
    release,
    buildNumber: 1,
    releaseDate: '2026-11-19T00:00:00Z',
    tables: Object.fromEntries(
      Object.entries(tables).map(([name, rows]) => [
        name,
        {
          version: versionOf(rows),
          jsonl: { url: `${base}${release}/${name}.jsonl`, recordSchemaUrl: `${base}${release}/${name}.schema.json` },
          flatbuffers: {
            binaryUrl: `${base}${release}/${name}.fb`,
            schemaUrl: `${base}${release}/${name}.fbs`,
            binarySchemaUrl: `${base}${release}/${name}.bfbs`,
          },
          record: { urlTemplate: `${base}${release}/${name}/{key}.json` },
        },
      ]),
    ),
  })

  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
  const notFound = () => new Response('{"error":"Not found"}', { status: 404 })

  const fetch: typeof globalThis.fetch = async (input) => {
    const url = String(input)
    requests.push(url)
    if (!url.startsWith(base)) {
      throw new Error(`Fake SDE does not serve ${url}`)
    }
    const [releaseId, rest = ''] = url.slice(base.length).split(/\/(.*)/s)
    const release = releaseId === 'latest' ? releases.at(-1) : find(releaseId!)
    if (!release) {
      return notFound()
    }
    if (rest === '') {
      return json(manifestOf(release))
    }

    const jsonl = /^(\w+)\.jsonl$/.exec(rest)
    if (jsonl) {
      const rows = release.tables[jsonl[1]!]
      return rows ? new Response(rows.map((row) => JSON.stringify(row)).join('\n')) : notFound()
    }

    if (/^\w+\.(fb|bfbs)$/.test(rest)) {
      const bytes = binaries.get(`${release.release}/${rest}`)
      return bytes ? new Response(bytes) : notFound()
    }

    const record = /^(\w+)\/(.+)\.json$/.exec(rest)
    if (record) {
      const [, table, key] = record
      const keyField = (sdeTableKeys as Record<string, string>)[table!]!
      const row = release.tables[table!]?.find((candidate) => String(candidate[keyField]) === decodeURIComponent(key!))
      return row ? json(row) : notFound()
    }

    throw new Error(`Fake SDE does not serve ${url}`)
  }

  return {
    fetch,
    requests,
    publish: (release: string, tables: Record<string, AnyRow[]>) => {
      releases.push({ release, tables })
    },
    serveFlatBuffers: (release: string, table: string, files: { fb: Uint8Array; bfbs: Uint8Array }) => {
      binaries.set(`${release}/${table}.fb`, files.fb)
      binaries.set(`${release}/${table}.bfbs`, files.bfbs)
    },
    versionOf,
  }
}
