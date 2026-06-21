import type { Plugin } from 'vite'

import { DEFAULT_ASSET_ORIGIN } from '../constants'
import { createDevProxyMiddleware } from '../dev-middleware'
import { loadResfileIndexData } from '../index-loader'
import {
  asJsLoadResult,
  formatRollupAssetModule,
  isVirtualResId,
  loadResfileAssetModule,
  resolveEveResfileOptions,
  resolveResfileId,
  resPathFromVirtualId,
} from '../plugin-core'
import type { EveResfileOptions, ResfileIndex, ResolvedEveResfileOptions } from '../types'

export const eveResfile = (options: EveResfileOptions = {}): Plugin => {
  let resolvedOptions: ResolvedEveResfileOptions | null = null
  let indexPromise: Promise<ResfileIndex> | null = null
  let loadedIndex: ResfileIndex | null = null

  const ensureIndex = (): Promise<ResfileIndex> => {
    if (!resolvedOptions) {
      throw new Error('@eve-online-tools/eve-resfile/vite: configResolved has not run yet.')
    }

    indexPromise ??= loadResfileIndexData(resolvedOptions).then((index) => {
      loadedIndex = index
      return index
    })
    return indexPromise
  }

  return {
    name: 'eve-resfile-vite',
    enforce: 'pre',

    configResolved(config) {
      resolvedOptions = resolveEveResfileOptions(options, config.root)
    },

    async buildStart() {
      const index = await ensureIndex()
      this.info(`Loaded EVE resfileindex (build ${index.buildNumber}, ${index.resPathToCdnPath.size} entries).`)
    },

    configureServer: {
      order: 'pre',
      handler(server) {
        server.middlewares.use(
          createDevProxyMiddleware(ensureIndex, resolvedOptions?.assetOrigin ?? DEFAULT_ASSET_ORIGIN),
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
      if (!resolvedOptions) {
        throw new Error('@eve-online-tools/eve-resfile/vite: configResolved has not run yet.')
      }

      const resPath = resPathFromVirtualId(id)
      const index = loadedIndex ?? (await ensureIndex())

      const code = await loadResfileAssetModule({
        watchMode: this.meta.watchMode,
        assetOrigin: resolvedOptions.assetOrigin,
        index,
        resPath,
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
