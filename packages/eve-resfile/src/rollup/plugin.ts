import type { Plugin } from 'rollup'

import { loadResfileIndexData } from '../index-loader'
import {
  formatRollupAssetModule,
  isVirtualResId,
  loadResfileAssetModule,
  resolveEveResfileOptions,
  resolveResfileId,
  resPathFromVirtualId,
} from '../plugin-core'
import type { EveResfileOptions, ResfileIndex, ResolvedEveResfileOptions } from '../types'

export const eveResfile = (options: EveResfileOptions = {}): Plugin => {
  const userOptions = resolveEveResfileOptions(options, options.root ?? process.cwd())
  const indexOptions: ResolvedEveResfileOptions = userOptions
  let indexPromise: Promise<ResfileIndex> | null = null
  let loadedIndex: ResfileIndex | null = null

  const ensureIndex = (): Promise<ResfileIndex> => {
    indexPromise ??= loadResfileIndexData(indexOptions).then((index) => {
      loadedIndex = index
      return index
    })
    return indexPromise
  }

  return {
    name: 'eve-resfile-rollup',

    async buildStart() {
      const index = await ensureIndex()
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
      const index = loadedIndex ?? (await ensureIndex())

      return loadResfileAssetModule({
        watchMode: this.meta.watchMode,
        assetOrigin: userOptions.assetOrigin,
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
    },
  }
}

export type { EveResfileOptions } from '../types'
