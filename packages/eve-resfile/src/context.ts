import { createHash } from 'node:crypto'

import { cssPlaceholderPrefix, cssPlaceholderSuffix, jsAssetSentinelPrefix, jsAssetSentinelSuffix } from './constants'
import { createFetchConcurrencyGate, type FetchConcurrencyGate } from './fetch-concurrency'
import { loadResfileIndexData } from './index-loader'
import { resPathLookupKey } from './lookup'
import { resolveEveResfileOptions } from './plugin-core'
import type { EveResfileOptions, ResfileIndex, ResolvedEveResfileOptions } from './types'

export type ResolvedAsset = {
  /** e.g. assets/grid-zF6a-lMh.png — relative to dist/, or null when missing */
  distPath: string | null
}

export type ResfileBuildContext = {
  options: ResolvedEveResfileOptions
  packageRoot: string
  index: ResfileIndex | null
  indexPromise: Promise<ResfileIndex> | null
  resolvedAssets: Map<string, ResolvedAsset>
  fetchConcurrencyGate: FetchConcurrencyGate
  /** Placeholder token → normalized res path */
  cssPlaceholders: Map<string, string>
  /** Normalized res path → placeholder id (without prefix/suffix) */
  cssPlaceholderByResPath: Map<string, string>
}

export const createResfileBuildContext = (options: EveResfileOptions, packageRoot: string): ResfileBuildContext => {
  const resolvedOptions = resolveEveResfileOptions(options, packageRoot)

  return {
    options: resolvedOptions,
    packageRoot,
    index: null,
    indexPromise: null,
    resolvedAssets: new Map(),
    fetchConcurrencyGate: createFetchConcurrencyGate(resolvedOptions.fetchConcurrency),
    cssPlaceholders: new Map(),
    cssPlaceholderByResPath: new Map(),
  }
}

export const cssPlaceholderToken = (id: string): string => `${cssPlaceholderPrefix}${id}${cssPlaceholderSuffix}`

export const jsAssetSentinel = (resPath: string): string => `${jsAssetSentinelPrefix}${resPath}${jsAssetSentinelSuffix}`

export const registerCssPlaceholder = (ctx: ResfileBuildContext, resPath: string): string => {
  const lookupKey = resPathLookupKey(resPath)
  const existing = ctx.cssPlaceholderByResPath.get(lookupKey)

  if (existing !== undefined) {
    return existing
  }

  const id = createHash('sha256').update(lookupKey).digest('hex').slice(0, 12)
  ctx.cssPlaceholders.set(cssPlaceholderToken(id), lookupKey)
  ctx.cssPlaceholderByResPath.set(lookupKey, id)

  return id
}

export const ensureResfileIndex = (ctx: ResfileBuildContext): Promise<ResfileIndex> => {
  ctx.indexPromise ??= loadResfileIndexData(ctx.options, ctx.packageRoot).then((index) => {
    ctx.index = index
    return index
  })

  return ctx.indexPromise
}
