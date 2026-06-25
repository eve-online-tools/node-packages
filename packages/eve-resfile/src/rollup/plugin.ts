import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import type { Plugin } from 'rollup'

import {
  ensureResfileAssetWritten,
  relativeAssetUrl,
  replaceCssPlaceholderUrls,
  rewriteJsAssetSentinels,
} from '../asset-emit'
import { ensureResfileIndex, jsAssetSentinel, type ResfileBuildContext } from '../context'
import {
  asJsLoadResult,
  emptyResfileModule,
  isVirtualResId,
  resetFetchFailureLog,
  resolveResfileId,
  resPathFromVirtualId,
  summarizeFetchFailures,
} from '../plugin-core'
import { devProxyUrl } from '../lookup'
import { jsAssetSentinelPrefix } from '../constants'
import { assertRollupOutputDir } from './output-layout'

const readSource = (source: string | Uint8Array | Buffer | undefined): string | null => {
  if (typeof source === 'string') {
    return source
  }

  if (source instanceof Uint8Array) {
    return Buffer.from(source).toString('utf8')
  }

  return null
}

export const rewriteCssPlaceholders = async (
  ctx: ResfileBuildContext,
  cssFileName: string,
  code: string,
  outputDirName: string,
): Promise<string> => {
  if (ctx.cssPlaceholders.size === 0) {
    return code
  }

  const index = ctx.index ?? (await ensureResfileIndex(ctx))
  let nextCode = code

  for (const [token, resPath] of ctx.cssPlaceholders) {
    if (!nextCode.includes(token)) {
      continue
    }

    const distPath = await ensureResfileAssetWritten(ctx, index, resPath)
    if (distPath === null) {
      nextCode = replaceCssPlaceholderUrls(nextCode, token, '')
      continue
    }

    const url = relativeAssetUrl(cssFileName, distPath, outputDirName)
    nextCode = replaceCssPlaceholderUrls(nextCode, token, url)
  }

  return nextCode
}

export const createRollupResfilePlugin = (ctx: ResfileBuildContext): Plugin => ({
  name: 'eve-resfile-rollup',

  async buildStart() {
    resetFetchFailureLog()
    const index = await ensureResfileIndex(ctx)
    this.info(`Loaded EVE resfileindex (build ${index.buildNumber}, ${index.resPathToCdnPath.size} entries).`)
  },

  resolveId(source) {
    return resolveResfileId(source)
  },

  async load(id) {
    if (!isVirtualResId(id)) {
      return null
    }

    const resPath = resPathFromVirtualId(id)

    if (this.meta.watchMode) {
      return asJsLoadResult(`export default ${JSON.stringify(devProxyUrl(resPath))}`)
    }

    const index = ctx.index ?? (await ensureResfileIndex(ctx))
    const distPath = await ensureResfileAssetWritten(ctx, index, resPath)

    if (distPath === null) {
      return asJsLoadResult(emptyResfileModule())
    }

    return asJsLoadResult(`export default ${JSON.stringify(jsAssetSentinel(resPath))}`)
  },

  async writeBundle(options, bundle) {
    // Post-hoc rewrite: see ARCHITECTURE.md. Plugin ordering matters — place before PostCSS extract.
    if (!options.dir) {
      return
    }

    assertRollupOutputDir(ctx.options.distDir, options.dir)

    const outputDirName = options.dir.split(/[/\\]/).pop() ?? ''

    for (const [fileName, chunk] of Object.entries(bundle)) {
      if (chunk.type === 'asset' && fileName.endsWith('.css')) {
        const code = readSource(chunk.source)
        if (code === null) {
          continue
        }

        const nextCode = await rewriteCssPlaceholders(ctx, fileName, code, outputDirName)
        if (nextCode !== code) {
          await writeFile(join(options.dir, fileName), nextCode)
        }
        continue
      }

      if (chunk.type !== 'chunk') {
        continue
      }

      const code = readSource(chunk.code)
      if (code === null || !code.includes(jsAssetSentinelPrefix)) {
        continue
      }

      const nextCode = rewriteJsAssetSentinels(ctx, fileName, code, options.format, outputDirName)
      if (nextCode !== code) {
        const outputPath = join(options.dir, fileName)
        await mkdir(dirname(outputPath), { recursive: true })
        await writeFile(outputPath, nextCode)
      }
    }

    summarizeFetchFailures(ctx.options.fetchConcurrency)
  },
})
