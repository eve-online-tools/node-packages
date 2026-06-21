import type { Plugin } from 'rollup'

import { createEveResfileIntegration, type EveResfileIntegration } from '../integration-factory'
import type { EveResfileOptions } from '../types'
import { createRollupResfilePlugin } from './plugin'

export { createEveResfileIntegration, type EveResfileIntegration } from '../integration-factory'
export { createRollupResfilePlugin } from './plugin'
export type { EveResfileOptions } from '../types'

export const rollupPlugin = (integration: EveResfileIntegration): Plugin => createRollupResfilePlugin(integration.ctx)

/**
 * Rollup-only shorthand for JS `res:/` imports.
 * CSS `url(res:/…)` requires `postcssPlugin()` from `/postcss` with the same integration handle.
 */
export const eveResfile = (options: EveResfileOptions = {}): Plugin =>
  rollupPlugin(createEveResfileIntegration(options))
