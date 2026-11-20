import type { Plugin } from 'rollup'

import { createPluginCore, type Environment, type SdePluginOptions } from '../plugin/core'

export type RollupSdeOptions = SdePluginOptions & {
  /** Project root for the config file and relative paths. Default: the working directory. */
  root?: string
  /** Which environment this bundle runs in. Default `client`. */
  environment?: Environment
}

/** Rollup counterpart of the Vite plugin for a single environment. */
export const sde = (options: RollupSdeOptions = {}): Plugin => {
  const { root, environment = 'client', ...config } = options
  const hasConfig = Object.keys(config).length > 0
  const core = createPluginCore(hasConfig ? (config as SdePluginOptions) : undefined)

  return {
    name: 'eve-sde',
    buildStart: async function () {
      await core.init(root ?? process.cwd(), (message) => this.info(message))
    },
    resolveId: (id) => core.resolveId(id),
    renderChunk: (code, chunk) => core.renderChunk(code, chunk.fileName),
    writeBundle: async (outputOptions) => {
      if (outputOptions.dir) {
        await core.writeServerFiles(outputOptions.dir)
      }
    },
    load: async function (id) {
      return core.load(id, environment, 'build', (fileName, source) => {
        const reference = this.emitFile({ type: 'asset', name: fileName.split('/').pop(), source })
        return `import.meta.ROLLUP_FILE_URL_${reference}`
      })
    },
  }
}
