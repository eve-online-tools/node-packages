import { getInternals, type Sde, type SdeScope } from './sde'
import type { AnyKey, AnyRow } from './types'

/** Serializable rows read by a scope, for sending server-rendered data to the client. */
export type DehydratedSde = {
  release?: string
  /** `null` marks a key that was looked up and does not exist. */
  rows: Record<string, Array<[AnyKey, AnyRow | null]>>
}

export const dehydrate = async (scope: SdeScope): Promise<DehydratedSde> => {
  const parent = getInternals(scope.parent)
  const rows: DehydratedSde['rows'] = {}
  const seen = new Set<string>()

  for (const [table, key] of scope.reads()) {
    const id = `${table}\0${String(key)}`
    const cached = parent.cachedRow(table, key)
    if (seen.has(id) || !cached) {
      continue
    }
    seen.add(id)
    const row = await cached.catch(() => undefined)
    ;(rows[table] ??= []).push([key, row ?? null])
  }

  return { release: parent.currentRelease(), rows }
}

/** Seeds an instance with dehydrated rows and the server's release, so hydration does not refetch. */
export const hydrate = (sde: Sde, state: DehydratedSde): void => {
  const internals = getInternals(sde)
  if (state.release) {
    internals.adoptRelease(state.release)
  }
  for (const [table, entries] of Object.entries(state.rows)) {
    for (const [key, row] of entries) {
      internals.seedRow(table, key, row ?? undefined)
    }
  }
}
