import { createHash } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import { basename, dirname, extname, join, relative } from 'node:path'

import { fetchBuffer } from './fetch'
import { jsAssetSentinelPrefix } from './constants'
import type { ResfileBuildContext } from './context'
import { resPathLookupKey } from './lookup'
import { fetchOptionsFor, lookupResPath, warnMissingResPath } from './plugin-core'
import type { ResfileIndex } from './types'

export const createAssetFileName = (resPath: string, buffer: Buffer): string => {
  const hash = createHash('sha256').update(buffer).digest('base64url').slice(0, 8)
  const name = basename(resPath)
  const extension = extname(name)
  const base = extension ? name.slice(0, -extension.length) : name

  return `${base}-${hash}${extension}`
}

export const createDistAssetPath = (resPath: string, buffer: Buffer, assetsUrlPrefix = 'assets'): string => {
  const fileName = createAssetFileName(resPath, buffer)
  return join(assetsUrlPrefix, fileName).replace(/\\/g, '/')
}

export const ensureResfileAssetWritten = async (
  ctx: ResfileBuildContext,
  index: ResfileIndex,
  resPath: string,
): Promise<string | null> => {
  const lookupKey = resPathLookupKey(resPath)
  const cached = ctx.resolvedAssets.get(lookupKey)
  if (cached !== undefined) {
    return cached.distPath
  }

  const lookup = lookupResPath(index, lookupKey, ctx.options.missingResPath)
  if (!lookup.ok) {
    ctx.resolvedAssets.set(lookupKey, { distPath: null })
    return null
  }

  const cdnUrl = `${ctx.options.assetOrigin}/${lookup.cdnPath}`

  try {
    const buffer = await fetchBuffer(cdnUrl, fetchOptionsFor(ctx.options, ctx.fetchConcurrencyGate))
    const fileName = createAssetFileName(lookupKey, buffer)
    const distPath = join(ctx.options.assetsUrlPrefix, fileName).replace(/\\/g, '/')

    await mkdir(ctx.options.assetsDir, { recursive: true })
    await writeFile(join(ctx.options.assetsDir, fileName), buffer)
    ctx.resolvedAssets.set(lookupKey, { distPath })

    return distPath
  } catch (error) {
    if (ctx.options.missingResPath === 'warn-and-empty') {
      warnMissingResPath(lookupKey, index.buildNumber, 'Failed to fetch resfile from CDN', {
        error,
        cdnUrl,
      })
      ctx.resolvedAssets.set(lookupKey, { distPath: null })
      return null
    }

    throw error
  }
}

export const relativeAssetUrl = (fromFileName: string, assetDistPath: string, outputDirName: string): string => {
  const fileDir = dirname(fromFileName).replace(/\\/g, '/')
  const fromPath = fileDir && fileDir !== '.' ? join(outputDirName, fileDir).replace(/\\/g, '/') : outputDirName

  const relativePath = relative(fromPath, assetDistPath).replace(/\\/g, '/')
  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

export const replaceCssPlaceholderUrls = (code: string, token: string, url: string): string =>
  code
    .replaceAll(`"${token}"`, `"${url}"`)
    .replaceAll(`'${token}'`, `'${url}'`)
    .replaceAll(`url(${token})`, `url("${url}")`)

/** Matches sentinels emitted via JSON.stringify(jsAssetSentinel(path)) or equivalent single-quoted literals. */
const jsAssetSentinelPattern = /(['"])__EVE_RESFILE_ASSET__(res:\/[^'"]+)__\1/g

export const rewriteJsAssetSentinels = (
  ctx: ResfileBuildContext,
  chunkFileName: string,
  code: string,
  format: string | undefined,
  outputDirName: string,
): string => {
  let replacementCount = 0

  const next = code.replace(jsAssetSentinelPattern, (_match, _quote: string, resPath: string) => {
    replacementCount++
    const resolved = ctx.resolvedAssets.get(resPathLookupKey(resPath))

    if (resolved === undefined) {
      throw new Error(`Missing resolved asset for ${resPath}`)
    }

    if (resolved.distPath === null) {
      return JSON.stringify('')
    }

    const relativePath = relativeAssetUrl(chunkFileName, resolved.distPath, outputDirName)

    if (format === 'cjs') {
      return `require("url").pathToFileURL(require("path").join(__dirname, ${JSON.stringify(relativePath)})).href`
    }

    return `new URL(${JSON.stringify(relativePath)}, import.meta.url).href`
  })

  if (code.includes(jsAssetSentinelPrefix) && (replacementCount === 0 || next.includes(jsAssetSentinelPrefix))) {
    throw new Error(
      `[eve-resfile] Found JS asset sentinels in ${chunkFileName} but could not rewrite them. ` +
        'Sentinels must appear as double- or single-quoted string literals.',
    )
  }

  return next
}
