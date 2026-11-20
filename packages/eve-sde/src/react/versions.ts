import { useSyncExternalStore } from 'react'
import type { Sde } from '../core/sde'

type TableVersions = {
  subscribe: (onChange: () => void) => () => void
  version: (table: string) => number
}

const stores = new WeakMap<Sde, TableVersions>()

const versionsFor = (sde: Sde): TableVersions => {
  let store = stores.get(sde)
  if (!store) {
    const versions = new Map<string, number>()
    const listeners = new Set<() => void>()
    // Lives as long as the instance; listeners are notified after versions are bumped.
    sde.on('change', ({ tables }) => {
      for (const table of tables) {
        versions.set(table, (versions.get(table) ?? 0) + 1)
      }
      for (const listener of listeners) {
        listener()
      }
    })
    store = {
      subscribe: (onChange) => {
        listeners.add(onChange)
        return () => {
          listeners.delete(onChange)
        }
      },
      version: (table) => versions.get(table) ?? 0,
    }
    stores.set(sde, store)
  }
  return store
}

/** Re-renders the caller when `table` moves to a new release. */
export const useTableVersion = (sde: Sde, table: string): number => {
  const store = versionsFor(sde)
  const snapshot = () => store.version(table)
  return useSyncExternalStore(store.subscribe, snapshot, snapshot)
}
