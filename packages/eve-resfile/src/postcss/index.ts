import type { EveResfileIntegration } from '../integration-factory'
import { createResfilePostcssPlugin, type ResfilePostcssOptions } from './plugin'

export { createEveResfileIntegration, type EveResfileIntegration } from '../integration-factory'
export { createResfilePostcssPlugin, type ResfilePostcssOptions } from './plugin'
export type { EveResfileOptions } from '../types'

export const postcssPlugin = (integration: EveResfileIntegration, postcssOptions?: ResfilePostcssOptions) =>
  createResfilePostcssPlugin(integration.ctx, postcssOptions)
