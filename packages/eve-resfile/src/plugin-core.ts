import { basename, isAbsolute, relative, resolve } from 'node:path'

import {
  defaultAllowedHosts,
  defaultAssetOrigin,
  defaultAssetsDir,
  defaultCacheDir,
  defaultDistDir,
  defaultFetchConcurrency,
  defaultFetchTimeoutMs,
  defaultIndexOrigin,
  emptyResfileUrl,
  resImportPrefix,
  virtualPrefix,
} from './constants'
import { fetchBuffer, type FetchOptions } from './fetch'
import type { FetchConcurrencyGate } from './fetch-concurrency'
import { warnMissingResPath } from './fetch-failures'
import { devProxyUrl, lookupCdnPath, normalizeResPath } from './lookup'
import { assertAllowedOrigin } from './origin-validation'
import type { EveResfileOptions, MissingResPathBehavior, ResfileIndex, ResolvedEveResfileOptions } from './types'

export { resetFetchFailureLog, summarizeFetchFailures, warnMissingResPath } from './fetch-failures'
export type { MissingResPathWarnContext } from './fetch-failures'

export const isEmptyResfileUrl = (url: string): boolean => url === emptyResfileUrl

export const emptyResfileModule = (): string => `export default ${JSON.stringify(emptyResfileUrl)}`

export type ResPathLookupResult = { ok: true; cdnPath: string } | { ok: false }

export const lookupResPath = (
  index: ResfileIndex,
  resPath: string,
  missingResPath: MissingResPathBehavior,
): ResPathLookupResult => {
  const cdnPath = lookupCdnPath(index.resPathToCdnPath, resPath)
  if (cdnPath !== undefined) {
    return { ok: true, cdnPath }
  }

  if (missingResPath === 'throw') {
    throw new Error(`${resPath} not found in resfileindex (build ${index.buildNumber}).`)
  }

  warnMissingResPath(resPath, index.buildNumber, 'Res path not found in resfileindex')
  return { ok: false }
}

export const normalizeBuildNumber = (value: number | string): string => {
  const normalized = String(value)

  if (!/^\d+$/.test(normalized)) {
    throw new Error(
      `[eve-resfile] Invalid buildNumber: must be a numeric client build id, got ${JSON.stringify(value)}`,
    )
  }

  return normalized
}

export const resolveEveResfileOptions = (options: EveResfileOptions = {}, root: string): ResolvedEveResfileOptions => {
  const cacheDir = options.cacheDir ?? defaultCacheDir
  const distDirRelative = options.distDir ?? defaultDistDir
  const assetsDirRelative = options.assetsDir ?? defaultAssetsDir
  const allowedHosts = options.allowedHosts ?? defaultAllowedHosts

  const distDir = isAbsolute(distDirRelative) ? distDirRelative : resolve(root, distDirRelative)
  const assetsDir = isAbsolute(assetsDirRelative) ? assetsDirRelative : resolve(root, assetsDirRelative)
  const assetsUrlPrefix = relative(distDir, assetsDir).replace(/\\/g, '/')

  if (!assetsUrlPrefix || assetsUrlPrefix.startsWith('..')) {
    throw new Error(
      `[eve-resfile] assetsDir must be inside distDir. Got distDir=${distDirRelative} and assetsDir=${assetsDirRelative}.`,
    )
  }

  return {
    buildNumber: options.buildNumber !== undefined ? normalizeBuildNumber(options.buildNumber) : undefined,
    indexOrigin: assertAllowedOrigin(options.indexOrigin ?? defaultIndexOrigin, 'indexOrigin', allowedHosts),
    assetOrigin: assertAllowedOrigin(options.assetOrigin ?? defaultAssetOrigin, 'assetOrigin', allowedHosts),
    allowedHosts,
    cacheDir: isAbsolute(cacheDir) ? cacheDir : resolve(root, cacheDir),
    distDir,
    assetsDir,
    assetsUrlPrefix,
    missingResPath: options.missingResPath ?? 'warn-and-empty',
    fetchTimeoutMs: options.fetchTimeoutMs ?? defaultFetchTimeoutMs,
    fetchConcurrency: options.fetchConcurrency ?? defaultFetchConcurrency,
  }
}

export const fetchOptionsFor = (
  options: ResolvedEveResfileOptions,
  concurrencyGate?: FetchConcurrencyGate,
): FetchOptions => ({
  timeoutMs: options.fetchTimeoutMs,
  concurrencyGate,
})

export const isVirtualResId = (id: string): boolean => id.startsWith(virtualPrefix)

export const virtualIdForResPath = (resPath: string): string => `${virtualPrefix}${resPath}`

export const resPathFromVirtualId = (id: string): string => id.slice(virtualPrefix.length)

export const lookupOrThrow = (index: ResfileIndex, resPath: string): string => {
  const lookup = lookupResPath(index, resPath, 'throw')
  if (!lookup.ok) {
    throw new Error(`${resPath} not found in resfileindex (build ${index.buildNumber}).`)
  }

  return lookup.cdnPath
}

export const resolveResfileId = (source: string): string | null => {
  if (!source.startsWith(resImportPrefix)) {
    return null
  }
  return virtualIdForResPath(normalizeResPath(source))
}

export const formatRollupAssetModule = (referenceId: string): string =>
  `export default import.meta.ROLLUP_FILE_URL_${referenceId}`

/** Rolldown (Vite 8+) needs an explicit JS module type when the virtual id has a non-JS extension. */
export const asJsLoadResult = (code: string): { code: string; moduleType: 'js' } => ({
  code,
  moduleType: 'js',
})

export type LoadResfileAssetOptions = {
  watchMode: boolean
  assetOrigin: string
  index: ResfileIndex
  resPath: string
  missingResPath: MissingResPathBehavior
  fetchOptions: FetchOptions
  emitAsset: (name: string, source: Buffer) => string
  formatAssetModule: (assetRef: string) => string
}

export const loadResfileAssetModule = async ({
  watchMode,
  assetOrigin,
  index,
  resPath,
  missingResPath,
  fetchOptions,
  emitAsset,
  formatAssetModule,
}: LoadResfileAssetOptions): Promise<string> => {
  const lookup = lookupResPath(index, resPath, missingResPath)
  if (!lookup.ok) {
    return emptyResfileModule()
  }

  if (watchMode) {
    return `export default ${JSON.stringify(devProxyUrl(resPath))}`
  }

  const cdnUrl = `${assetOrigin}/${lookup.cdnPath}`

  try {
    const buffer = await fetchBuffer(cdnUrl, fetchOptions)
    const assetRef = emitAsset(basename(resPath), buffer)
    return formatAssetModule(assetRef)
  } catch (error) {
    if (missingResPath === 'warn-and-empty') {
      warnMissingResPath(resPath, index.buildNumber, 'Failed to fetch resfile from CDN', { error, cdnUrl })
      return emptyResfileModule()
    }

    throw error
  }
}
