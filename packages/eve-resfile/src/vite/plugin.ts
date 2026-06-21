import type { Plugin } from 'vite'

import { ensureResfileIndex, type ResfileBuildContext } from '../context'
import { createFetchConcurrencyGate } from '../fetch-concurrency'
import { createDevProxyMiddleware } from '../dev-middleware'
import {
  asJsLoadResult,
  fetchOptionsFor,
  formatRollupAssetModule,
  isVirtualResId,
  loadResfileAssetModule,
  resetFetchFailureLog,
  resolveEveResfileOptions,
  resolveResfileId,
  resPathFromVirtualId,
  summarizeFetchFailures,
} from '../plugin-core'
import type { EveResfileOptions } from '../types'

const configNotResolvedError =
  '[eve-resfile] Vite configResolved must run before configureServer. Ensure the eve-resfile plugin is registered in vite.config plugins.'

export const createViteResfilePlugin = (ctx: ResfileBuildContext, options: EveResfileOptions = {}): Plugin => {
  let viteConfigResolved = false

  if (options.root) {
    ctx.options = resolveEveResfileOptions(options, options.root)
    ctx.packageRoot = options.root
    ctx.fetchConcurrencyGate = createFetchConcurrencyGate(ctx.options.fetchConcurrency)
  }

  return {
    name: 'eve-resfile-vite',
    enforce: 'pre',

    configResolved(config) {
      ctx.options = resolveEveResfileOptions(options, config.root)
      ctx.packageRoot = config.root
      ctx.fetchConcurrencyGate = createFetchConcurrencyGate(ctx.options.fetchConcurrency)
      viteConfigResolved = true
    },

    async buildStart() {
      resetFetchFailureLog()
      const index = await ensureResfileIndex(ctx)
      this.info(`Loaded EVE resfileindex (build ${index.buildNumber}, ${index.resPathToCdnPath.size} entries).`)
    },

    buildEnd() {
      if (!this.meta.watchMode) {
        summarizeFetchFailures(ctx.options.fetchConcurrency)
      }
    },

    configureServer: {
      order: 'pre',
      handler(server) {
        if (!viteConfigResolved) {
          throw new Error(configNotResolvedError)
        }

        server.middlewares.use(
          createDevProxyMiddleware(
            () => ensureResfileIndex(ctx),
            () => ctx.options.assetOrigin,
            () => ctx.options.missingResPath,
            () => ctx.options.fetchTimeoutMs,
          ),
        )
      },
    },

    resolveId(source) {
      return resolveResfileId(source)
    },

    async load(id) {
      if (!isVirtualResId(id)) {
        return null
      }

      if (!viteConfigResolved) {
        throw new Error(configNotResolvedError)
      }

      const index = ctx.index ?? (await ensureResfileIndex(ctx))
      const resPath = resPathFromVirtualId(id)

      const code = await loadResfileAssetModule({
        watchMode: this.meta.watchMode,
        assetOrigin: ctx.options.assetOrigin,
        index,
        resPath,
        missingResPath: ctx.options.missingResPath,
        fetchOptions: fetchOptionsFor(ctx.options, ctx.fetchConcurrencyGate),
        emitAsset: (name, source) =>
          this.emitFile({
            type: 'asset',
            name,
            source,
          }),
        formatAssetModule: formatRollupAssetModule,
      })

      return asJsLoadResult(code)
    },
  }
}

export type { EveResfileOptions } from '../types'
