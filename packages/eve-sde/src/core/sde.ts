import { remote } from '../sources/remote'
import type { SdeSource, SourceContext } from '../sources/types'
import { sdeTableKeys } from '../schema/generated/tables'
import { SdeError, SdeRowNotFoundError, SdeUnknownTableError } from './errors'
import type { FetchFn } from './http'
import { fetchLatestManifest, fetchReleaseManifest, type ReleaseManifest } from './manifest'
import { projectRow } from './projection'
import { shared } from './shared'
import { fulfilled, track } from './thenable'
import type { AnyKey, AnyRow, FieldName, Key, Projection, Row, TableName } from './types'

export type SdeEvents = {
  /**
   * Tables read at runtime moved to a newer release, or build-time tables switched to the HTTP API by
   * `onStale: 'remote'`. Their cached rows were dropped.
   */
  change: { release: string; tables: string[] }
  /** Build-time data differs from the latest release. */
  stale: { release: string; tables: string[] }
  /** A background release check failed. It is retried at the next interval. */
  error: { error: unknown }
}

export type SdeOptions = {
  /**
   * `latest` (default) follows new releases. A release id or manifest pins the instance: it only moves to latest once
   * the pinned release has expired upstream.
   */
  release?: string | ReleaseManifest
  /** Tried in order; the first source that has a table serves it. Default: `[remote()]`. */
  sources?: SdeSource[]
  fetch?: FetchFn
  /**
   * `lazy` (default): a read more than `updateIntervalMs` after the last check starts a background check.
   * `watch`: additionally check on a timer. `off`: never check for updates.
   */
  updates?: 'lazy' | 'watch' | 'off'
  updateIntervalMs?: number
  /** What to do when build-time data of a table is stale: keep serving it (default) or switch the table to remote. */
  onStale?: Partial<Record<TableName, 'keep' | 'remote'>>
}

type Pick_<T extends TableName, F extends FieldName<T>> = Pick<Row<T>, F>
type Omit_<T extends TableName, F extends FieldName<T>> = Omit<Row<T>, F>

export type SdeTable<T extends TableName> = {
  get: {
    (key: Key<T>): Promise<Row<T> | undefined>
    <F extends FieldName<T>>(key: Key<T>, projection: { fields: readonly F[] }): Promise<Pick_<T, F> | undefined>
    <F extends FieldName<T>>(key: Key<T>, projection: { omit: readonly F[] }): Promise<Omit_<T, F> | undefined>
  }
  getOrThrow: (key: Key<T>) => Promise<Row<T>>
  /** Rows for the keys that exist. Requests made in the same tick are batched. */
  getMany: (keys: Iterable<Key<T>>) => Promise<Map<Key<T>, Row<T>>>
  list: {
    (): AsyncIterable<Row<T>>
    <F extends FieldName<T>>(projection: { fields: readonly F[] }): AsyncIterable<Pick_<T, F>>
    <F extends FieldName<T>>(projection: { omit: readonly F[] }): AsyncIterable<Omit_<T, F>>
  }
  /**
   * Loads rows into the cache so later reads, and React hooks, resolve without waiting. Without keys it loads the whole
   * table through the source's cheapest path, and keys missing from it resolve to `undefined` without a request.
   */
  preload: (keys?: Iterable<Key<T>>) => Promise<void>
}

export type SdeReader = {
  table: <T extends TableName>(name: T) => SdeTable<T>
}

export type Sde = SdeReader & {
  /** Manifest of the release runtime reads currently use. */
  manifest: () => Promise<ReleaseManifest>
  /** Compares the current release with latest and emits `change` / `stale`. */
  checkForUpdates: () => Promise<void>
  on: <E extends keyof SdeEvents>(event: E, handler: (event: SdeEvents[E]) => void) => () => void
  /** A view that shares this instance's cache and records which rows it read, for SSR dehydration. */
  scope: () => SdeScope
}

export type SdeScope = SdeReader & {
  readonly parent: Sde
  reads: () => ReadonlyArray<readonly [table: string, key: AnyKey]>
}

export type SdeInternals = {
  /** Cached promise per key, stable across calls until the row is invalidated; for React `use()`. */
  loadRow: (table: string, key: AnyKey) => Promise<AnyRow | undefined>
  cachedRow: (table: string, key: AnyKey) => Promise<AnyRow | undefined> | undefined
  seedRow: (table: string, key: AnyKey, row: AnyRow | undefined) => void
  /** Drops seeded rows of tables whose version here differs, once that version is known. */
  seedVersions?: (versions: Record<string, string>) => void
  /** Version of the table data this instance serves, for dehydration. */
  tableVersion?: (table: string) => Promise<string | undefined>
  /** Adopts the server's release for hydration, unless this instance already resolved one. */
  adoptRelease: (release: string) => void
  currentRelease: () => string | undefined
}

const internals = shared.internals

/** For a scope, `loadRow` also records the read. */
export const getInternals = (reader: Sde | SdeScope): SdeInternals => {
  const found = internals.get(reader)
  if (!found) {
    throw new SdeError('Not an instance created by createSde().')
  }
  return found
}

const defaultUpdateIntervalMs = 5 * 60_000
// How long a confirmed release counts as alive when its URLs return 404.
const releaseMissingRecheckMs = 60_000

type Deferred = { resolve: (row: AnyRow | undefined) => void; reject: (error: unknown) => void }

export const createSde = (options: SdeOptions = {}): Sde => {
  const fetchFn = options.fetch ?? ((input, init) => globalThis.fetch(input, init))
  const sources = options.sources ?? [remote()]
  const updates = options.updates ?? 'lazy'
  const updateIntervalMs = options.updateIntervalMs ?? defaultUpdateIntervalMs
  const checksUseful = sources.some((source) => source.live || source.versions)
  const pinned = (options.release ?? 'latest') !== 'latest'

  let releaseOption = options.release ?? 'latest'
  let currentManifest: ReleaseManifest | undefined
  let manifestPromise: Promise<ReleaseManifest> | undefined
  let resolvedRelease: string | undefined
  let lastCheckAt = 0
  let checking: Promise<boolean> | undefined
  let watchTimer: ReturnType<typeof setInterval> | undefined
  const remoteTables = new Set<string>()
  const reportedStale = new Set<string>()
  let fallbackRemote: SdeSource | undefined

  const listeners: { [E in keyof SdeEvents]: Set<(event: SdeEvents[E]) => void> } = {
    change: new Set(),
    stale: new Set(),
    error: new Set(),
  }
  const emit = <E extends keyof SdeEvents>(event: E, payload: SdeEvents[E]): void => {
    for (const handler of listeners[event]) {
      try {
        handler(payload)
      } catch (error) {
        // A throwing listener must not abort the check that emitted the event.
        if (event !== 'error') {
          emit('error', { error })
        }
      }
    }
  }

  const seededVersions = new Map<string, string>()

  /** `undefined` while it depends on a manifest that is not resolved yet, or when the source has no versions. */
  const servedVersion = (table: string): string | undefined => {
    const source = servingSource(table)
    return source?.versions?.[table] ?? (source?.live ? currentManifest?.tables[table]?.version : undefined)
  }

  const verifySeeds = (): void => {
    const mismatched: string[] = []
    for (const [table, version] of seededVersions) {
      const served = servedVersion(table)
      if (served === undefined && servingSource(table)?.live && !currentManifest) {
        continue
      }
      seededVersions.delete(table)
      if (served !== undefined && served !== version) {
        mismatched.push(table)
        cache.delete(table)
      }
    }
    if (mismatched.length > 0 && resolvedRelease) {
      emit('change', { release: resolvedRelease, tables: mismatched })
    }
  }

  const setManifest = (manifest: ReleaseManifest): ReleaseManifest => {
    resolvedRelease = manifest.release
    currentManifest = manifest
    manifestPromise = Promise.resolve(manifest)
    verifySeeds()
    return manifest
  }

  const resolveInitialManifest = async (): Promise<ReleaseManifest> => {
    if (typeof releaseOption !== 'string') {
      return releaseOption
    }
    if (releaseOption !== 'latest') {
      const pinned = await fetchReleaseManifest(fetchFn, releaseOption)
      if (pinned) {
        return pinned
      }
    }
    lastCheckAt = Date.now()
    return fetchLatestManifest(fetchFn)
  }

  const manifest = (): Promise<ReleaseManifest> => {
    manifestPromise ??= resolveInitialManifest().then(setManifest, (error: unknown) => {
      manifestPromise = undefined
      throw error
    })
    return manifestPromise
  }

  /** `undefined` when no source serves the table. */
  const servingSource = (table: string): SdeSource | undefined => {
    if (remoteTables.has(table)) {
      return sources.find((source) => source.live && source.has(table)) ?? (fallbackRemote ??= remote())
    }
    return sources.find((candidate) => candidate.has(table))
  }

  const sourceFor = (table: string): SdeSource => {
    const source = servingSource(table)
    if (!source) {
      throw new SdeError(`No source serves SDE table "${table}". Sources: ${sources.map((s) => s.name).join(', ')}.`)
    }
    return source
  }

  const cache = new Map<string, Map<AnyKey, Promise<AnyRow | undefined>>>()
  // Keyed by the table's cache map, so an invalidated table forgets that it was preloaded.
  const tablePreloads = new WeakMap<Map<AnyKey, Promise<AnyRow | undefined>>, Promise<void>>()
  const completeTables = new WeakSet<Map<AnyKey, Promise<AnyRow | undefined>>>()
  const tableCache = (table: string): Map<AnyKey, Promise<AnyRow | undefined>> => {
    let rows = cache.get(table)
    if (!rows) {
      rows = new Map()
      cache.set(table, rows)
    }
    return rows
  }

  /**
   * Resolves `true` when the release moved. A pinned instance only reports `stale` unless `follow` is set, which an
   * expired release forces.
   */
  const check = (follow = !pinned): Promise<boolean> => {
    checking ??= (async () => {
      try {
        // Resolving `latest` for the first time already is the check; fetching it again would be a duplicate request.
        const fresh = !manifestPromise && releaseOption === 'latest'
        const current = await manifest()
        const latest = fresh ? current : await fetchLatestManifest(fetchFn)
        lastCheckAt = Date.now()

        const moved = follow && latest.release !== current.release
        const changed = moved
          ? [...new Set([...Object.keys(latest.tables), ...Object.keys(current.tables)])].filter(
              (table) => current.tables[table]?.version !== latest.tables[table]?.version,
            )
          : []
        const liveChanged = changed.filter((table) => servingSource(table)?.live)
        const stale = sources
          .flatMap((source) => Object.entries(source.versions ?? {}))
          .filter(([table, version]) => latest.tables[table]?.version !== version)
          .map(([table]) => table)
          .filter((table) => !reportedStale.has(`${table}\0${latest.tables[table]?.version}`))
        const switched = stale.filter(
          (table) => latest.tables[table] && options.onStale?.[table as TableName] === 'remote',
        )

        if (moved) {
          setManifest(latest)
        }
        for (const table of stale) {
          reportedStale.add(`${table}\0${latest.tables[table]?.version}`)
        }
        for (const table of switched) {
          remoteTables.add(table)
        }
        const changedTables = [...new Set([...liveChanged, ...switched])]
        for (const table of changedTables) {
          cache.delete(table)
        }
        if (changedTables.length > 0) {
          emit('change', { release: latest.release, tables: changedTables })
        }
        if (stale.length > 0) {
          emit('stale', { release: latest.release, tables: stale })
        }

        return moved
      } finally {
        checking = undefined
      }
    })()
    return checking
  }

  const backgroundCheck = (): void => {
    check().catch((error: unknown) => {
      lastCheckAt = Date.now()
      emit('error', { error })
    })
  }

  const onRead = (): void => {
    if (updates === 'off' || !checksUseful || pinned) {
      return
    }
    if (updates === 'watch' && !watchTimer) {
      watchTimer = setInterval(backgroundCheck, updateIntervalMs)
      // Node: the watcher must not keep the process alive.
      ;(watchTimer as { unref?: () => void }).unref?.()
    }
    if (Date.now() - lastCheckAt >= updateIntervalMs && !checking) {
      // Set before the async check so concurrent reads don't start their own.
      lastCheckAt = Date.now()
      backgroundCheck()
    }
  }

  // A 404 within the API's two-release window is a missing row, so the release is confirmed instead of checking latest.
  const releaseChecks = new Map<string, { at: number; alive: Promise<boolean> }>()
  const releaseAlive = (release: string): Promise<boolean> => {
    const known = releaseChecks.get(release)
    if (known && Date.now() - known.at < releaseMissingRecheckMs) {
      return known.alive
    }
    const alive = fetchReleaseManifest(fetchFn, release).then((found) => found !== undefined)
    const entry = { at: Date.now(), alive }
    releaseChecks.set(release, entry)
    alive.catch(() => {
      if (releaseChecks.get(release) === entry) {
        releaseChecks.delete(release)
      }
    })
    return alive
  }

  const ctx: SourceContext = {
    fetch: fetchFn,
    manifest,
    releaseMissing: async (release) => {
      if (checking) {
        // Its failure is reported through `error`; this read only needs the outcome.
        await checking.catch(() => undefined)
      }
      if (resolvedRelease !== release) {
        return true
      }
      if (await releaseAlive(release)) {
        return false
      }
      // Only an expired release moves the instance, whatever `updates` says: its URLs no longer serve anything.
      await check(true)
      return resolvedRelease !== release
    },
  }

  const pending = new Map<string, Map<AnyKey, Deferred[]>>()
  const flush = (table: string): void => {
    const batch = pending.get(table)
    pending.delete(table)
    if (!batch) {
      return
    }
    const keys = [...batch.keys()]
    Promise.resolve()
      .then(() => sourceFor(table).get(ctx, table, keys))
      .then(
        (rows) => {
          for (const [key, deferreds] of batch) {
            for (const deferred of deferreds) {
              deferred.resolve(rows.get(key))
            }
          }
        },
        (error: unknown) => {
          for (const deferreds of batch.values()) {
            for (const deferred of deferreds) {
              deferred.reject(error)
            }
          }
        },
      )
  }

  const loadRow = (table: string, key: AnyKey): Promise<AnyRow | undefined> => {
    const rows = tableCache(table)
    const cached = rows.get(key)
    if (cached) {
      return cached
    }
    if (completeTables.has(rows)) {
      const missing = fulfilled(undefined)
      rows.set(key, missing)
      return missing
    }

    const promise = new Promise<AnyRow | undefined>((resolve, reject) => {
      let batch = pending.get(table)
      if (!batch) {
        batch = new Map()
        pending.set(table, batch)
        queueMicrotask(() => flush(table))
      }
      batch.set(key, [...(batch.get(key) ?? []), { resolve, reject }])
    })
    rows.set(key, track(promise))
    promise.catch(() => {
      if (rows.get(key) === promise) {
        rows.delete(key)
      }
    })
    return promise
  }

  const preloadTable = (table: string): Promise<void> => {
    const rows = tableCache(table)
    let preload = tablePreloads.get(rows)
    if (!preload) {
      const keyField = (sdeTableKeys as Record<string, string>)[table]
      if (!keyField) {
        return Promise.reject(new SdeUnknownTableError(table))
      }
      preload = (async () => {
        for await (const row of sourceFor(table).list(ctx, table)) {
          const key = row[keyField] as AnyKey
          // Keeps promises already handed out, so React sees a stable promise per row.
          if (!rows.has(key)) {
            rows.set(key, fulfilled(row))
          }
        }
        completeTables.add(rows)
      })()
      tablePreloads.set(rows, preload)
      preload.catch(() => {
        if (tablePreloads.get(rows) === preload) {
          tablePreloads.delete(rows)
        }
      })
    }
    return preload
  }

  const createReader = (recordRead?: (table: string, key: AnyKey) => void): SdeReader => ({
    table: <T extends TableName>(name: T): SdeTable<T> => {
      const get = async (key: AnyKey, projection?: Projection): Promise<AnyRow | undefined> => {
        onRead()
        recordRead?.(name, key)
        // Projections read the cached full row, so they batch, deduplicate and dehydrate like plain reads.
        const row = await loadRow(name, key)
        return row && projection ? projectRow(row, projection) : row
      }

      const table = {
        get,
        getOrThrow: async (key: AnyKey) => {
          const row = await get(key)
          if (!row) {
            throw new SdeRowNotFoundError(name, key)
          }
          return row
        },
        getMany: async (keys: Iterable<AnyKey>) => {
          onRead()
          const unique = [...new Set(keys)]
          const rows = await Promise.all(
            unique.map((key) => {
              recordRead?.(name, key)
              return loadRow(name, key)
            }),
          )
          const result = new Map<AnyKey, AnyRow>()
          unique.forEach((key, i) => {
            if (rows[i]) {
              result.set(key, rows[i])
            }
          })
          return result
        },
        preload: async (keys?: Iterable<AnyKey>) => {
          onRead()
          if (keys === undefined) {
            return preloadTable(name)
          }
          await Promise.all([...new Set(keys)].map((key) => loadRow(name, key)))
        },
        list: (projection?: Projection): AsyncIterable<AnyRow> => ({
          [Symbol.asyncIterator]: () => {
            onRead()
            return sourceFor(name).list(ctx, name, projection)[Symbol.asyncIterator]()
          },
        }),
      }
      return table as unknown as SdeTable<T>
    },
  })

  const reader = createReader()
  const sde: Sde = {
    ...reader,
    manifest,
    checkForUpdates: async () => {
      await check()
    },
    on: (event, handler) => {
      listeners[event].add(handler)
      return () => {
        listeners[event].delete(handler)
      }
    },
    scope: () => {
      const reads: Array<readonly [string, AnyKey]> = []
      const seen = new Set<string>()
      // Hooks call loadRow on every render, so reads are recorded once per row.
      const record = (table: string, key: AnyKey): void => {
        const id = `${table}\0${typeof key}\0${key}`
        if (!seen.has(id)) {
          seen.add(id)
          reads.push([table, key])
        }
      }
      const scope: SdeScope = { ...createReader(record), parent: sde, reads: () => reads }
      const parent = getInternals(sde)
      internals.set(scope, {
        ...parent,
        loadRow: (table, key) => {
          record(table, key)
          return parent.loadRow(table, key)
        },
      })
      return scope
    },
  }

  internals.set(sde, {
    loadRow: (table, key) => {
      onRead()
      return loadRow(table, key)
    },
    cachedRow: (table, key) => cache.get(table)?.get(key),
    seedRow: (table, key, row) => {
      tableCache(table).set(key, fulfilled(row))
    },
    seedVersions: (versions) => {
      for (const [table, version] of Object.entries(versions)) {
        seededVersions.set(table, version)
      }
      verifySeeds()
    },
    tableVersion: async (table) => {
      const source = servingSource(table)
      return source?.versions?.[table] ?? (source?.live ? (await manifest()).tables[table]?.version : undefined)
    },
    adoptRelease: (release) => {
      if (!manifestPromise) {
        releaseOption = release
      }
    },
    currentRelease: () => resolvedRelease,
  })

  return sde
}

/**
 * A facade over an instance resolved on first use. Lets a module export an instance whose options come from a module
 * that may import this package itself, without an evaluation-order cycle.
 */
export const createLazySde = (resolve: () => Sde): Sde => {
  let instance: Sde | undefined
  const get = (): Sde => (instance ??= resolve())
  const facade: Sde = {
    table: (name) => get().table(name),
    manifest: () => get().manifest(),
    checkForUpdates: () => get().checkForUpdates(),
    on: (event, handler) => get().on(event, handler),
    scope: () => get().scope(),
  }
  internals.set(facade, {
    loadRow: (table, key) => getInternals(get()).loadRow(table, key),
    cachedRow: (table, key) => getInternals(get()).cachedRow(table, key),
    seedRow: (table, key, row) => getInternals(get()).seedRow(table, key, row),
    seedVersions: (versions) => getInternals(get()).seedVersions?.(versions),
    tableVersion: async (table) => getInternals(get()).tableVersion?.(table),
    adoptRelease: (release) => getInternals(get()).adoptRelease(release),
    currentRelease: () => getInternals(get()).currentRelease(),
  })
  return facade
}
