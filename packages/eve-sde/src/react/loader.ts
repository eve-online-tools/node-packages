import { getInternals, type Sde, type SdeScope } from '../core/sde'
import { fulfilled, settledValue, track } from '../core/thenable'
import type { AnyKey, AnyRow } from '../core/types'

type RowsEntry = { version: number; promise: Promise<Map<AnyKey, AnyRow>> }

export type RowLoader = {
  sde: Sde
  /** Stable promise per (table, key) until a `change` drops it. */
  loadRow: (table: string, key: AnyKey) => Promise<AnyRow | undefined>
  /** Stable promise per (table, keys, version), resolving to rows that exist in key order. */
  loadRows: (table: string, keys: readonly AnyKey[], version: number) => Promise<Map<AnyKey, AnyRow>>
}

const isScope = (reader: Sde | SdeScope): reader is SdeScope => 'parent' in reader

const createRowLoader = (reader: Sde | SdeScope): RowLoader => {
  const sde = isScope(reader) ? reader.parent : reader
  const { loadRow } = getInternals(reader)

  const rowsCache = new Map<string, RowsEntry>()
  const loadRows: RowLoader['loadRows'] = (table, keys, version) => {
    const id = JSON.stringify([table, keys])
    const cached = rowsCache.get(id)
    if (cached?.version === version) {
      return cached.promise
    }
    const toMap = (rows: readonly (AnyRow | undefined)[]): Map<AnyKey, AnyRow> => {
      const map = new Map<AnyKey, AnyRow>()
      keys.forEach((key, i) => {
        if (rows[i]) {
          map.set(key, rows[i])
        }
      })
      return map
    }
    const promises = keys.map((key) => loadRow(table, key))
    const settled = promises.map(settledValue)
    const promise = settled.every((row) => row !== undefined)
      ? fulfilled(toMap(settled.map((row) => row!.value)))
      : track(Promise.all(promises).then(toMap))
    const entry = { version, promise }
    rowsCache.set(id, entry)
    promise.catch(() => {
      if (rowsCache.get(id) === entry) {
        rowsCache.delete(id)
      }
    })
    return promise
  }

  return { sde, loadRow, loadRows }
}

const loaders = new WeakMap<Sde | SdeScope, RowLoader>()

export const rowLoaderFor = (reader: Sde | SdeScope): RowLoader => {
  let loader = loaders.get(reader)
  if (!loader) {
    loader = createRowLoader(reader)
    loaders.set(reader, loader)
  }
  return loader
}
