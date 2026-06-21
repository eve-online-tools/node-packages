export type MissingResPathBehavior = 'throw' | 'warn-and-empty'

export type EveResfileOptions = {
  /** Pin to a specific client build; omit to fetch latest from eveclient_TQ.json (numeric literals are coerced to strings) */
  buildNumber?: number | string
  /** Override index CDN (default: https://binaries.eveonline.com) */
  indexOrigin?: string
  /** Override asset CDN (default: https://resources.eveonline.com) */
  assetOrigin?: string
  /** Allowed CDN hostnames for indexOrigin and assetOrigin (default: EVE production hosts) */
  allowedHosts?: readonly string[]
  /** Cache dir relative to project root, or an absolute path (default: .cache/eve-resfile) */
  cacheDir?: string
  /** Project root for resolving cacheDir (Rollup, or when not using the Vite plugin) */
  root?: string
  /** Rollup dist root relative to project root (default: dist) */
  distDir?: string
  /** Rollup asset output directory relative to project root (default: dist/assets) */
  assetsDir?: string
  /** When a res path is missing from the index or CDN fetch fails (default: warn-and-empty) */
  missingResPath?: MissingResPathBehavior
  /** Per-request CDN fetch timeout in ms (default: 30000) */
  fetchTimeoutMs?: number
  /** Max parallel CDN asset fetches during a build (default: 8) */
  fetchConcurrency?: number
}

export type ResolvedEveResfileOptions = {
  buildNumber?: string
  indexOrigin: string
  assetOrigin: string
  allowedHosts: readonly string[]
  /** Absolute cache directory path */
  cacheDir: string
  /** Absolute Rollup dist root (output.dir must be a subdirectory) */
  distDir: string
  /** Absolute directory where fetched Rollup assets are written */
  assetsDir: string
  /** URL path prefix relative to distDir (for example assets) */
  assetsUrlPrefix: string
  missingResPath: MissingResPathBehavior
  fetchTimeoutMs: number
  fetchConcurrency: number
}

export type ResfileIndex = {
  buildNumber: string
  resPathToCdnPath: Map<string, string>
}

export type EveClientManifest = {
  buildNumber: string
}
