import type { FetchFn } from '../core/http'
import type { ReleaseManifest } from '../core/manifest'
import type { AnyKey, AnyRow, Projection } from '../core/types'

export type SourceContext = {
  fetch: FetchFn
  /** Manifest of the release the instance currently reads. */
  manifest: () => Promise<ReleaseManifest>
  /**
   * Call when a URL of `release` returned 404. Resolves `true` when the instance has since moved to a newer release
   * and the request should be retried against `manifest()`; `false` means the resource is missing.
   */
  releaseMissing: (release: string) => Promise<boolean>
}

/** Where rows come from. The first source of an instance that `has` a table serves it. */
export type SdeSource = {
  readonly name: string
  /** Serves the instance's current release and follows it when it moves. */
  readonly live?: boolean
  /** Table versions of data fixed at build time; compared with the latest release to detect stale data. */
  readonly versions?: Readonly<Record<string, string>>
  has: (table: string) => boolean
  /** Rows for the keys that exist; missing keys are absent from the map. */
  get: (
    ctx: SourceContext,
    table: string,
    keys: readonly AnyKey[],
    projection?: Projection,
  ) => Promise<Map<AnyKey, AnyRow>>
  list: (ctx: SourceContext, table: string, projection?: Projection) => AsyncIterable<AnyRow>
}
