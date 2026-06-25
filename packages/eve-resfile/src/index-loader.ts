import { mkdir } from 'node:fs/promises'

import {
  buildCacheDir,
  buildIndexPath,
  readCachedMap,
  readCachedText,
  resfileIndexPath,
  resfileMapPath,
  writeCachedMap,
  writeCachedText,
} from './cache'
import { eveClientManifest } from './constants'
import { fetchText } from './fetch'
import { resPathLookupKey } from './lookup'
import { fetchOptionsFor, resolveEveResfileOptions } from './plugin-core'
import { findResfileIndexCdnPath, parseEveClientManifest, parseResfileIndex } from './parse'
import type { EveResfileOptions, ResfileIndex, ResolvedEveResfileOptions } from './types'

const resolveBuildNumber = async (options: ResolvedEveResfileOptions): Promise<string> => {
  if (options.buildNumber !== undefined) {
    return options.buildNumber
  }

  const manifestUrl = `${options.indexOrigin}/${eveClientManifest}`
  const manifestHost = new URL(manifestUrl).host
  const manifest = parseEveClientManifest(
    JSON.parse(await fetchText(manifestUrl, fetchOptionsFor(options))),
    manifestHost,
  )

  return manifest.buildNumber
}

const loadBuildIndex = async (options: ResolvedEveResfileOptions, buildNumber: string): Promise<string> => {
  const cachedPath = buildIndexPath(options.cacheDir, buildNumber)
  const cached = await readCachedText(cachedPath)
  if (cached) {
    return cached
  }

  const buildIndexUrl = `${options.indexOrigin}/eveonline_${buildNumber}.txt`
  const content = await fetchText(buildIndexUrl, fetchOptionsFor(options))
  await writeCachedText(cachedPath, content)
  return content
}

const loadResfileIndex = async (
  options: ResolvedEveResfileOptions,
  buildNumber: string,
  cdnPath: string,
): Promise<string> => {
  const cachedPath = resfileIndexPath(options.cacheDir, buildNumber)
  const cached = await readCachedText(cachedPath)
  if (cached) {
    return cached
  }

  const resfileIndexUrl = `${options.indexOrigin}/${cdnPath}`
  const content = await fetchText(resfileIndexUrl, fetchOptionsFor(options))
  await writeCachedText(cachedPath, content)
  return content
}

const normalizeResfileIndexMap = (map: Map<string, string>): Map<string, string> => {
  const normalized = new Map<string, string>()

  for (const [resPath, cdnPath] of map) {
    normalized.set(resPathLookupKey(resPath), cdnPath)
  }

  return normalized
}

export const loadResfileIndexData = async (
  options: EveResfileOptions = {},
  root: string = process.cwd(),
): Promise<ResfileIndex> => {
  const resolved = resolveEveResfileOptions(options, root)
  const { cacheDir } = resolved

  const buildNumber = await resolveBuildNumber(resolved)
  await mkdir(buildCacheDir(cacheDir, buildNumber), { recursive: true })

  const cachedMap = await readCachedMap(resfileMapPath(cacheDir, buildNumber), buildNumber)
  if (cachedMap) {
    return { buildNumber, resPathToCdnPath: normalizeResfileIndexMap(cachedMap) }
  }

  const buildIndex = await loadBuildIndex(resolved, buildNumber)
  const resfileIndexCdnPath = findResfileIndexCdnPath(buildIndex)
  const resfileIndex = await loadResfileIndex(resolved, buildNumber, resfileIndexCdnPath)
  const resPathToCdnPath = parseResfileIndex(resfileIndex)

  await writeCachedMap(resfileMapPath(cacheDir, buildNumber), buildNumber, resPathToCdnPath)

  return { buildNumber, resPathToCdnPath }
}
