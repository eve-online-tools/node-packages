import type { SdeTables as ShippedTables } from '../schema/generated/tables'

/**
 * Augment with `{ tables: ... }` to replace the shipped table types, e.g. with types generated for a project's locked
 * release by `eve-sde types`. Augmenting `SdeTables` directly can't change existing tables' row types.
 */
// oxlint-disable-next-line typescript/no-empty-interface, typescript/no-empty-object-type
export interface SdeTypeRegistry {}

export type ActiveTables = SdeTypeRegistry extends { tables: infer Tables } ? Tables : ShippedTables

type TableEntry = { row: object; key: string | number }
type Entry<T extends TableName> = ActiveTables[T] extends TableEntry ? ActiveTables[T] : never

export type TableName = keyof ActiveTables & string
export type Row<T extends TableName> = Entry<T>['row']
export type Key<T extends TableName> = Entry<T>['key']
export type FieldName<T extends TableName> = keyof Row<T> & string

export type AnyKey = string | number
export type AnyRow = Record<string, unknown>

/** Top-level fields to return. `fields` and `omit` are mutually exclusive. */
export type Projection = { fields: readonly string[]; omit?: never } | { omit: readonly string[]; fields?: never }
