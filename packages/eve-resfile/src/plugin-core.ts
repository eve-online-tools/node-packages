import { basename, isAbsolute, resolve } from 'node:path'

import {
  DEFAULT_ASSET_ORIGIN,
  DEFAULT_CACHE_DIR,
  DEFAULT_INDEX_ORIGIN,
  RES_IMPORT_PREFIX,
  VIRTUAL_PREFIX,
} from './constants'
import { fetchBuffer } from './fetch'
import { devProxyUrl, lookupCdnPath, normalizeResPath } from './lookup'
import type { EveResfileOptions, ResfileIndex, ResolvedEveResfileOptions } from './types'

export const resolveEveResfileOptions = (options: EveResfileOptions = {}, root: string): ResolvedEveResfileOptions => {
  const cacheDir = options.cacheDir ?? DEFAULT_CACHE_DIR

  return {
    buildNumber: options.buildNumber,
    indexOrigin: options.indexOrigin ?? DEFAULT_INDEX_ORIGIN,
    assetOrigin: options.assetOrigin ?? DEFAULT_ASSET_ORIGIN,
    cacheDir: isAbsolute(cacheDir) ? cacheDir : resolve(root, cacheDir),
  }
}

export const isVirtualResId = (id: string): boolean => id.startsWith(VIRTUAL_PREFIX)

export const virtualIdForResPath = (resPath: string): string => `${VIRTUAL_PREFIX}${resPath}`

export const resPathFromVirtualId = (id: string): string => id.slice(VIRTUAL_PREFIX.length)

export const lookupOrThrow = (index: ResfileIndex, resPath: string): string => {
  const cdnPath = lookupCdnPath(index.resPathToCdnPath, resPath)
  if (!cdnPath) {
    throw new Error(`${resPath} not found in resfileindex (build ${index.buildNumber}).`)
  }
  return cdnPath
}

export const resolveResfileId = (source: string): string | null => {
  if (!source.startsWith(RES_IMPORT_PREFIX)) {
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
  emitAsset: (name: string, source: Buffer) => string
  formatAssetModule: (assetRef: string) => string
}

export const loadResfileAssetModule = async ({
  watchMode,
  assetOrigin,
  index,
  resPath,
  emitAsset,
  formatAssetModule,
}: LoadResfileAssetOptions): Promise<string> => {
  const cdnPath = lookupOrThrow(index, resPath)

  if (watchMode) {
    return `export default ${JSON.stringify(devProxyUrl(resPath))}`
  }

  const buffer = await fetchBuffer(`${assetOrigin}/${cdnPath}`)
  const assetRef = emitAsset(basename(resPath), buffer)
  return formatAssetModule(assetRef)
}
