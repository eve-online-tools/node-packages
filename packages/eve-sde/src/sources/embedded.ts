import { SdeError, SdeUnknownTableError } from '../core/errors'
import { projectRow } from '../core/projection'
import type { AnyKey, AnyRow, Row, TableName } from '../core/types'
import { sdeTableKeys } from '../schema/generated/tables'
import type { SdeSource } from './types'

type KeyField<T extends TableName> = (typeof sdeTableKeys)[T] & keyof Row<T>

/** Rows per table, or a loader for them, e.g. a dynamic import of a bundled JSON chunk. */
export type EmbeddedData = { readonly [T in TableName]?: readonly Row<T>[] | (() => Promise<readonly Row<T>[]>) }

/** Test rows: only the key field is required. */
export type FixtureData = {
  readonly [T in TableName]?: readonly (Partial<Row<T>> & Pick<Row<T>, KeyField<T>>)[]
}

export type EmbeddedOptions = {
  /** Versions of the release the data was taken from, for stale detection. */
  versions?: Readonly<Record<string, string>>
}

const keyFieldOf = (table: string): string => {
  const keyField = (sdeTableKeys as Record<string, string>)[table]
  if (!keyField) {
    throw new SdeUnknownTableError(table)
  }
  return keyField
}

const indexRows = (table: string, rows: readonly AnyRow[]): Map<AnyKey, AnyRow> => {
  const keyField = keyFieldOf(table)
  const index = new Map<AnyKey, AnyRow>()
  for (const row of rows) {
    const key = row[keyField] as AnyKey | undefined
    if (key === undefined) {
      throw new SdeError(`Row in "${table}" is missing its key field "${keyField}".`)
    }
    if (index.has(key)) {
      throw new SdeError(`Duplicate key ${JSON.stringify(key)} in "${table}".`)
    }
    index.set(key, row)
  }
  return index
}

type RowsData = Readonly<Record<string, readonly AnyRow[] | (() => Promise<readonly AnyRow[]>) | undefined>>

const createRowsSource = (name: string, data: RowsData, versions?: Readonly<Record<string, string>>): SdeSource => {
  const indexes = new Map<string, Promise<Map<AnyKey, AnyRow>>>()
  const indexFor = (table: string): Promise<Map<AnyKey, AnyRow>> => {
    let index = indexes.get(table)
    if (!index) {
      const rows = data[table] ?? []
      index = (typeof rows === 'function' ? rows() : Promise.resolve(rows)).then((loaded) => indexRows(table, loaded))
      index.catch(() => indexes.delete(table))
      indexes.set(table, index)
    }
    return index
  }

  return {
    name,
    versions,
    has: (table) => data[table] !== undefined,
    get: async (_ctx, table, keys, projection) => {
      const index = await indexFor(table)
      const result = new Map<AnyKey, AnyRow>()
      for (const key of keys) {
        const row = index.get(key)
        if (row) {
          result.set(key, projectRow(row, projection))
        }
      }
      return result
    },
    list: async function* (_ctx, table, projection) {
      for (const row of (await indexFor(table)).values()) {
        yield projectRow(row, projection)
      }
    },
  }
}

/** Rows held in memory, typically bundled at build time. */
export const embedded = (data: EmbeddedData, options: EmbeddedOptions = {}): SdeSource =>
  createRowsSource('embedded', data as RowsData, options.versions)

/** In-memory rows for tests. Rows may be partial; only the key field is required. */
export const fixture = (data: FixtureData): SdeSource => createRowsSource('fixture', data as RowsData)
