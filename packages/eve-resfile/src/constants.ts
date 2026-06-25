/** EVE CDN origins and index file names */
export const defaultIndexOrigin = 'https://binaries.eveonline.com'
export const defaultAssetOrigin = 'https://resources.eveonline.com'
export const defaultAllowedHosts = ['binaries.eveonline.com', 'resources.eveonline.com'] as const
export const eveClientManifest = 'eveclient_TQ.json'
export const resfileIndexPath = 'app:/resfileindex.txt'

/** Default plugin paths and timeouts */
export const defaultCacheDir = '.cache/eve-resfile'
export const defaultDistDir = 'dist'
export const defaultAssetsDir = 'dist/assets'
export const defaultFetchTimeoutMs = 30_000

/** `res:/` import syntax and virtual module ids */
export const resImportPrefix = 'res:/'
export const virtualPrefix = '\0res:'

/** Vite dev-server proxy path prefix */
export const devProxyPrefix = '/__eve_res__/'

/** Rollup `writeBundle` placeholder tokens for CSS and JS */
export const cssPlaceholderPrefix = '__EVE_RESFILE_'
export const cssPlaceholderSuffix = '__'
export const jsAssetSentinelPrefix = '__EVE_RESFILE_ASSET__'
export const jsAssetSentinelSuffix = '__'

/** On-disk cache file schema */
export const cacheSchemaVersion = 1

/** `warn-and-empty` emitted JS module value */
export const emptyResfileUrl = ''

/** CDN fetch retry policy */
export const maxFetchRetries = 3
export const initialFetchBackoffMs = 250
export const maxRetryAfterMs = 30_000

/** Max parallel CDN asset fetches during a build */
export const defaultFetchConcurrency = 8
