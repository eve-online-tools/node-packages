import { createResfileBuildContext, type ResfileBuildContext } from './context'
import type { EveResfileOptions } from './types'

/** Shared handle for wiring Vite, Rollup, and PostCSS plugins against one index and asset cache. */
export type EveResfileIntegration = {
  readonly ctx: ResfileBuildContext
  readonly options: EveResfileOptions
}

export const createEveResfileIntegration = (options: EveResfileOptions = {}): EveResfileIntegration => {
  const root = options.root ?? process.cwd()

  return {
    ctx: createResfileBuildContext(options, root),
    options,
  }
}
