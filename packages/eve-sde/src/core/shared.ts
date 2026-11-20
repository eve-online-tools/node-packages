import type { Sde, SdeInternals, SdeOptions, SdeScope } from './sde'

/**
 * State shared by every copy of this package in one JavaScript realm. Vite SSR can load a library's copy from
 * node_modules next to the app's bundled copy; both must use the configured instance, its internals and one React
 * context. Keyed by major version, since internals may change shape between majors.
 */
type Shared = {
  internals: WeakMap<Sde | SdeScope, SdeInternals>
  /** Options from the copy the build plugin configured. */
  options?: () => SdeOptions
  instance?: Sde
  reactContext?: unknown
}

const key = Symbol.for('@eve-online-tools/eve-sde@1')
const realm = globalThis as typeof globalThis & { [key]?: Shared }

export const shared: Shared = (realm[key] ??= { internals: new WeakMap() })
