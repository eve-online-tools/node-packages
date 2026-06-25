// Cache directories and filenames
export const defaultCacheDir = '.cache/eve-sde'
export const archiveFileName = 'archive.zip'
export const lockFileName = '.sde-lock.json'
export const lockSchemaVersion = 2

// CCP static data download URLs
export const sdeOrigin = 'https://developers.eveonline.com'
export const sdeLatestUrl = `${sdeOrigin}/static-data/tranquility/latest.jsonl`
export const sdeZipUrl = (buildNumber: string): string =>
  `${sdeOrigin}/static-data/tranquility/eve-online-static-data-${buildNumber}-jsonl.zip`

// Built-in processor naming
export const stripFieldsIdPrefix = 'strip-fields:'

// HTTP download defaults
export const defaultFetchTimeoutMs = 60_000
export const defaultFetchRetries = 3
export const fetchRetryDelaysMs = [250, 1_000] as const
export const fetchRetryableStatus = new Set([502, 503, 504])
