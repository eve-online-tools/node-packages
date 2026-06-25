import type { StorybookConfig } from '@storybook/react-vite'
import { createEveResfileIntegration } from '@eve-online-tools/eve-resfile/integration'
import { vitePlugin } from '@eve-online-tools/eve-resfile/vite'
import { postcssPlugin } from '@eve-online-tools/eve-resfile/postcss'
import { createWorkspaceAliases, mergeAliases } from '../../../internal/vite-config/workspace-aliases'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const storybookDir = path.dirname(fileURLToPath(import.meta.url))
const monorepoRoot = path.resolve(storybookDir, '../../../')
const resfile = createEveResfileIntegration({ root: monorepoRoot })

function getAbsolutePath(value: string): string {
  return path.dirname(require.resolve(path.join(value, 'package.json')))
}

const config: StorybookConfig = {
  stories: ['../../../packages/*/src/**/*.story.@(js|jsx|mjs|ts|tsx)'],
  addons: [getAbsolutePath('@storybook/addon-essentials')],
  framework: {
    name: getAbsolutePath('@storybook/react-vite'),
    options: {},
  },
  docs: {
    autodocs: false,
  },
  async viteFinal(config) {
    config.plugins = [vitePlugin(resfile), ...(config.plugins ?? [])]

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
      // Mantine + Storybook essentials routinely exceed Vite's default 500 kB limit.
      chunkSizeWarningLimit: 800,
      rolldownOptions: {
        ...config.build?.rolldownOptions,
        onLog(level, log, defaultHandler) {
          // Storybook core ships dead telejson eval code that Rolldown warns on.
          if (log.code === 'EVAL' && log.id?.includes('@storybook/core')) {
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
