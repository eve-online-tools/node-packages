import type { Plugin } from 'vite'

import { createEveResfileIntegration, type EveResfileIntegration } from '../integration-factory'
import type { EveResfileOptions } from '../types'
import { createViteResfilePlugin } from './plugin'

export { createEveResfileIntegration, type EveResfileIntegration } from '../integration-factory'
export { createViteResfilePlugin } from './plugin'
export type { EveResfileOptions } from '../types'

export const vitePlugin = (integration: EveResfileIntegration): Plugin =>
  createViteResfilePlugin(integration.ctx, integration.options)

/** JS-only Vite setup. For CSS `url(res:/…)`, use `vitePlugin(createEveResfileIntegration())` with `postcssPlugin` from `/postcss`. */
export const eveResfile = (options: EveResfileOptions = {}): Plugin => vitePlugin(createEveResfileIntegration(options))
