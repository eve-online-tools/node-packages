import { use } from 'react'
import type { Key, Row, TableName } from '../core/types'
import { useSdeReader } from './context'
import { rowLoaderFor } from './loader'
import { useTableVersion } from './versions'

/** Suspends until the row is loaded. `undefined` when the key does not exist. */
export const useSdeRow = <T extends TableName>(table: T, key: Key<T>): Row<T> | undefined => {
  const { sde, loadRow } = rowLoaderFor(useSdeReader())
  useTableVersion(sde, table)
  return use(loadRow(table, key)) as Row<T> | undefined
}

/** Suspends until all rows are loaded. Missing keys are absent. The map is stable for the same keys and release. */
export const useSdeRows = <T extends TableName>(table: T, keys: readonly Key<T>[]): Map<Key<T>, Row<T>> => {
  const { sde, loadRows } = rowLoaderFor(useSdeReader())
  const version = useTableVersion(sde, table)
  return use(loadRows(table, keys, version)) as Map<Key<T>, Row<T>>
}
