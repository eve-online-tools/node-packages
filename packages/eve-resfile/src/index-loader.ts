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
import { EVE_CLIENT_MANIFEST } from './constants'
import { fetchText } from './fetch'
import { findResfileIndexCdnPath, parseResfileIndex } from './parse'
import type { EveClientManifest, ResfileIndex, ResolvedEveResfileOptions } from './types'

const resolveBuildNumber = async (options: ResolvedEveResfileOptions): Promise<string> => {
  if (options.buildNumber !== undefined) {
    return String(options.buildNumber)
  }

  const manifestUrl = `${options.indexOrigin}/${EVE_CLIENT_MANIFEST}`
  const manifest = JSON.parse(await fetchText(manifestUrl)) as EveClientManifest

  if (!manifest.buildNumber) {
    throw new Error(`Missing buildNumber in ${manifestUrl}.`)
  }

  return manifest.buildNumber
}

const loadBuildIndex = async (options: ResolvedEveResfileOptions, buildNumber: string): Promise<string> => {
  const cachedPath = buildIndexPath(options.cacheDir, buildNumber)
  const cached = await readCachedText(cachedPath)
  if (cached) {
    return cached
  }

  const buildIndexUrl = `${options.indexOrigin}/eveonline_${buildNumber}.txt`
  const content = await fetchText(buildIndexUrl)
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
  const content = await fetchText(resfileIndexUrl)
  await writeCachedText(cachedPath, content)
  return content
}

export const loadResfileIndexData = async (options: ResolvedEveResfileOptions): Promise<ResfileIndex> => {
  const { cacheDir } = options

  const buildNumber = await resolveBuildNumber(options)
  await mkdir(buildCacheDir(cacheDir, buildNumber), { recursive: true })

  const cachedMap = await readCachedMap(resfileMapPath(cacheDir, buildNumber))
  if (cachedMap) {
    return { buildNumber, resPathToCdnPath: cachedMap }
  }

  const buildIndex = await loadBuildIndex(options, buildNumber)
  const resfileIndexCdnPath = findResfileIndexCdnPath(buildIndex)
  const resfileIndex = await loadResfileIndex(options, buildNumber, resfileIndexCdnPath)
  const resPathToCdnPath = parseResfileIndex(resfileIndex)

  await writeCachedMap(resfileMapPath(cacheDir, buildNumber), resPathToCdnPath)

  return { buildNumber, resPathToCdnPath }
}
