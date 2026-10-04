import type { StorybookConfig } from '@storybook/react-vite'
import { createEveResfileIntegration } from '@eve-online-tools/eve-resfile/integration'
import { vitePlugin } from '@eve-online-tools/eve-resfile/vite'
import { postcssPlugin } from '@eve-online-tools/eve-resfile/postcss'
import { mapDataProcessor } from '@eve-online-tools/eve-map/sde'
import { sde } from '@eve-online-tools/eve-sde/vite'
import { createWorkspaceAliases, mergeAliases } from '../../../internal/vite-config/workspace-aliases'
import { mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const storybookDir = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.resolve(storybookDir, '../../../')
const resfile = createEveResfileIntegration({ root: monorepoRoot })
// Filled by the SDE plugin on startup; must exist before Storybook resolves staticDirs.
const eveMapDataDir = path.resolve(storybookDir, '../generated/eve-map')
mkdirSync(eveMapDataDir, { recursive: true })

function getAbsolutePath(value: string): string {
  return path.dirname(require.resolve(path.join(value, 'package.json')))
}

const config: StorybookConfig = {
  stories: ['../../../packages/*/src/**/*.story.@(js|jsx|mjs|ts|tsx)'],
  staticDirs: [
    {
      from: path.join(monorepoRoot, 'packages/eve-ship-tree/src/data/generated'),
      to: '/ship-tree-data',
    },
    { from: eveMapDataDir, to: '/eve-map' },
  ],
  addons: [],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },
  docs: {
    autodocs: false,
  },
  async viteFinal(config) {
    config.plugins = [
      sde({
        outputDir: eveMapDataDir,
        cacheDir: path.join(monorepoRoot, 'apps/storybook/.cache/eve-sde'),
        buildNumber: 3569502,
        processors: [mapDataProcessor()],
      }),
      vitePlugin(resfile),
      ...(config.plugins ?? []),
    ]

    config.css = {
      ...config.css,
      postcss: {
        ...(typeof config.css?.postcss === 'object' ? config.css.postcss : {}),
        plugins: [
          ...(Array.isArray(config.css?.postcss?.plugins) ? config.css.postcss.plugins : []),
          postcssPlugin(resfile, { target: 'dev-proxy' }),
        ],
      },
    }

    config.resolve = config.resolve ?? {}
    config.resolve.alias = mergeAliases(config.resolve.alias, createWorkspaceAliases(monorepoRoot))

    config.build = {
      ...config.build,
      // Storybook's manager and preview bundles exceed Vite's default 500 kB limit.
      chunkSizeWarningLimit: 1200,
      rolldownOptions: {
        ...config.build?.rolldownOptions,
        onLog(level, log, defaultHandler) {
          // `'use client'` directives in dependencies are irrelevant outside React Server Components.
          if (log.code === 'MODULE_LEVEL_DIRECTIVE') {
            return
          }

          defaultHandler(level, log)
        },
      },
    }

    return config
  },
}

export default config
