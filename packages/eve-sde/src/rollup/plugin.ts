import type { Plugin } from 'rollup'

import { processSdeWithResolvedOptions } from '../processor'
import { resolveSdeOptions } from '../plugin-core'
import type { ResolvedSdeOptions, SdeOptions } from '../types'

export const sde = (options: SdeOptions): Plugin => {
  let resolvedOptions: ResolvedSdeOptions | null = null

  return {
    name: 'eve-sde-rollup',

    async buildStart() {
      resolvedOptions ??= resolveSdeOptions(options, options.root ?? process.cwd())

      const result = await processSdeWithResolvedOptions(resolvedOptions)
      if (result.skipped) {
        this.info(
          `Skipped SDE processing (up-to-date, build ${result.buildNumber}). Bump processor version or use force: true to regenerate.`,
        )
        return
      }

      this.info(`Generated SDE artifacts (build ${result.buildNumber}, ${result.filesWritten} table dumps).`)
    },
  }
}

export type { SdeOptions } from '../types'
