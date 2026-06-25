import type { Plugin } from 'vite'

import { processSdeWithResolvedOptions } from '../processor'
import { resolveSdeOptions } from '../plugin-core'
import type { SdeOptions, ResolvedSdeOptions } from '../types'

export const sde = (options: SdeOptions): Plugin => {
  let resolvedOptions: ResolvedSdeOptions | null = null

  return {
    name: 'eve-sde-vite',
    enforce: 'pre',

    configResolved(config) {
      resolvedOptions = resolveSdeOptions(options, config.root)
    },

    async buildStart() {
      if (!resolvedOptions) {
        throw new Error('@eve-online-tools/eve-sde/vite: configResolved has not run yet.')
      }

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
