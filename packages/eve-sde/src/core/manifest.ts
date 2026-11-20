import { SdeError, SdeUnknownTableError } from './errors'
import { request, requestOk, type FetchFn } from './http'

export const sdeTenantUrl = 'https://sde.evetech.net/tranquility/'

/** URLs are absent when a release does not offer that format for the table. */
export type TableInfo = {
  /** Changes only when the table's data changes. */
  version: string
  jsonlUrl?: string
  fbUrl?: string
  bfbsUrl?: string
  /** Contains `{key}`. */
  recordUrlTemplate?: string
}

export type TableUrl = 'jsonlUrl' | 'fbUrl' | 'bfbsUrl' | 'recordUrlTemplate'

export type ReleaseManifest = {
  release: string
  buildNumber: number
  releaseDate: string
  tables: Readonly<Record<string, TableInfo>>
}

const fail = (message: string): never => {
  throw new SdeError(`Invalid SDE release manifest: ${message}`)
}

const record = (value: unknown, path: string): Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : fail(`${path} is not an object.`)

const string = (value: unknown, path: string): string =>
  typeof value === 'string' ? value : fail(`${path} is not a string.`)

const optionalString = (value: unknown): string | undefined => (typeof value === 'string' ? value : undefined)

const field = (value: unknown, key: string): unknown =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>)[key] : undefined

/**
 * Tables are parsed leniently so a future table with fewer formats, or a malformed entry, only affects reads of that
 * table. Entries without a version are skipped: nothing can be cached or locked without one.
 */
const parseTable = (value: unknown): TableInfo | undefined => {
  const version = optionalString(field(value, 'version'))
  if (version === undefined) {
    return undefined
  }
  const flatbuffers = field(value, 'flatbuffers')
  return {
    version,
    jsonlUrl: optionalString(field(field(value, 'jsonl'), 'url')),
    fbUrl: optionalString(field(flatbuffers, 'binaryUrl')),
    bfbsUrl: optionalString(field(flatbuffers, 'binarySchemaUrl')),
    recordUrlTemplate: optionalString(field(field(value, 'record'), 'urlTemplate')),
  }
}

/** Parses the body of `/tranquility/<release>/`. */
export const parseManifest = (json: unknown): ReleaseManifest => {
  const body = record(json, 'body')
  const buildNumber = body.buildNumber
  if (typeof buildNumber !== 'number') {
    fail('buildNumber is not a number.')
  }
  return {
    release: string(body.release, 'release'),
    buildNumber: buildNumber as number,
    releaseDate: string(body.releaseDate, 'releaseDate'),
    tables: Object.fromEntries(
      Object.entries(record(body.tables, 'tables')).flatMap(([name, table]) => {
        const info = parseTable(table)
        return info ? [[name, info]] : []
      }),
    ),
  }
}

export const fetchLatestManifest = async (fetchFn: FetchFn): Promise<ReleaseManifest> =>
  parseManifest(await (await requestOk(fetchFn, `${sdeTenantUrl}latest/`)).json())

/** Returns `undefined` when the release no longer exists; only the current and previous release are kept. */
export const fetchReleaseManifest = async (fetchFn: FetchFn, release: string): Promise<ReleaseManifest | undefined> => {
  if (!/^\d{8}T\d{6}Z$/.test(release)) {
    throw new SdeError(`Invalid SDE release id "${release}".`)
  }
  const response = await request(fetchFn, `${sdeTenantUrl}${release}/`)
  return response ? parseManifest(await response.json()) : undefined
}

export const tableInfo = (manifest: ReleaseManifest, table: string): TableInfo => {
  const info = manifest.tables[table]
  if (!info) {
    throw new SdeUnknownTableError(table)
  }
  return info
}

const formatNames: Record<TableUrl, string> = {
  jsonlUrl: 'JSONL file',
  fbUrl: 'FlatBuffers file',
  bfbsUrl: 'FlatBuffers schema',
  recordUrlTemplate: 'record endpoint',
}

/** A table's URL of one format, or an error naming what the release lacks. */
export const tableUrl = (manifest: ReleaseManifest, table: string, kind: TableUrl): string => {
  const url = tableInfo(manifest, table)[kind]
  if (!url) {
    throw new SdeError(`Table "${table}" has no ${formatNames[kind]} in SDE release ${manifest.release}.`)
  }
  return url
}
