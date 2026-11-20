import { SdeError, SdeUnknownTableError } from './errors'
import { request, requestOk, type FetchFn } from './http'

export const sdeTenantUrl = 'https://sde.evetech.net/tranquility/'

export type TableInfo = {
  /** Changes only when the table's data changes. */
  version: string
  jsonlUrl: string
  fbUrl: string
  bfbsUrl: string
  /** Contains `{key}`. */
  recordUrlTemplate: string
}

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

const parseTable = (name: string, value: unknown): TableInfo => {
  const table = record(value, `tables.${name}`)
  const jsonl = record(table.jsonl, `tables.${name}.jsonl`)
  const flatbuffers = record(table.flatbuffers, `tables.${name}.flatbuffers`)
  const recordInfo = record(table.record, `tables.${name}.record`)
  return {
    version: string(table.version, `tables.${name}.version`),
    jsonlUrl: string(jsonl.url, `tables.${name}.jsonl.url`),
    fbUrl: string(flatbuffers.binaryUrl, `tables.${name}.flatbuffers.binaryUrl`),
    bfbsUrl: string(flatbuffers.binarySchemaUrl, `tables.${name}.flatbuffers.binarySchemaUrl`),
    recordUrlTemplate: string(recordInfo.urlTemplate, `tables.${name}.record.urlTemplate`),
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
      Object.entries(record(body.tables, 'tables')).map(([name, table]) => [name, parseTable(name, table)]),
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
