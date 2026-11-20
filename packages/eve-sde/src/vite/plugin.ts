import type { Plugin, ViteDevServer } from 'vite'

import { datasetPrefix, createPluginCore, type SdePluginOptions } from '../plugin/core'

const packageName = '@eve-online-tools/eve-sde'
const devAssetPrefix = '/@eve-sde/'

/**
 * Configures the shared `sde` instance per environment (client, server), embeds tables, ships FlatBuffers files with
 * server builds and serves datasets as `eve-sde:dataset/<id>` modules. Without options it reads `eve-sde.config.*`.
 */
export const sde = (options?: SdePluginOptions): Plugin => {
  let root = process.cwd()
  let command: 'build' | 'serve' = 'build'
  const devAssets = new Map<string, Uint8Array>()
  let devServer: ViteDevServer | undefined
  let watching = false
  const core = createPluginCore(options)

  return {
    name: 'eve-sde',
    enforce: 'pre',
    // The config module must go through this plugin: dependency pre-bundling and SSR externals would load the
    // package's default config instead.
    config: () => ({
      optimizeDeps: { exclude: [packageName] },
      ssr: { noExternal: [packageName] },
    }),
    configResolved: (resolved) => {
      root = resolved.root
      command = resolved.command
    },
    configureServer: (server) => {
      devServer = server
      server.middlewares.use((req, res, next) => {
        const bytes = req.url?.startsWith(devAssetPrefix) ? devAssets.get(req.url) : undefined
        if (!bytes) {
          next()
          return
        }
        res.setHeader('content-type', 'application/octet-stream')
        res.end(bytes)
      })
    },
    buildStart: async function () {
      const { config } = await core.init(root, (message) => this.info(message))
      const server = devServer
      if (server && !watching) {
        watching = true
        // Tables, datasets and the release are resolved once per server; changes need a restart to take effect.
        const files = [config.configFile, config.lockfile].filter((file): file is string => file !== undefined)
        server.watcher.add(files)
        server.watcher.on('change', (file) => {
          if (files.includes(file)) {
            void server.restart()
          }
        })
      }
    },
    resolveId: (id) => core.resolveId(id),
    renderChunk: (code, chunk) => core.renderChunk(code, chunk.fileName),
    writeBundle: async (outputOptions) => {
      if (outputOptions.dir) {
        await core.writeServerFiles(outputOptions.dir)
      }
    },
    load: async function (id) {
      const environment = this.environment?.config.consumer ?? 'client'
      return core.load(id, environment, command, (fileName, source) => {
        if (command === 'serve') {
          const owner = id.startsWith(`\0${datasetPrefix}`)
            ? encodeURIComponent(id.slice(datasetPrefix.length + 1))
            : 'files'
          const url = `${devAssetPrefix}${owner}/${fileName}`
          devAssets.set(url, source)
          return JSON.stringify(url)
        }
        const reference = this.emitFile({ type: 'asset', name: fileName.split('/').pop(), source })
        return `import.meta.ROLLUP_FILE_URL_${reference}`
      })
    },
  }
}
