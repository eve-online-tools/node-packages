import { queryOptions, type QueryClient } from '@tanstack/react-query'
import type { Sde, SdeReader } from '../core/sde'
import type { Key, Row, TableName } from '../core/types'
import { sde as globalSde } from '../global'

const rootKey = 'eve-sde'

/** Query option factories. Results use `null` for missing rows because query results must not be `undefined`. */
export const sdeQueries = (sde: SdeReader = globalSde) => ({
  row: <T extends TableName>(table: T, key: Key<T>) =>
    queryOptions({
      queryKey: [rootKey, table, key] as const,
      queryFn: async (): Promise<Row<T> | null> => (await sde.table(table).get(key)) ?? null,
      staleTime: Infinity,
    }),
  /** Rows that exist, in key order. */
  rows: <T extends TableName>(table: T, keys: readonly Key<T>[]) =>
    queryOptions({
      queryKey: [rootKey, table, keys] as const,
      queryFn: async (): Promise<Row<T>[]> => {
        const rows = await sde.table(table).getMany(keys)
        return keys.flatMap((key) => rows.get(key) ?? [])
      },
      staleTime: Infinity,
    }),
})

/** Invalidates SDE queries of tables that moved to a new release. Returns the unsubscribe function. */
export const connectQueryClient = (sde: Sde, queryClient: QueryClient): (() => void) =>
  sde.on('change', ({ tables }) => {
    for (const table of tables) {
      void queryClient.invalidateQueries({ queryKey: [rootKey, table] })
    }
  })
