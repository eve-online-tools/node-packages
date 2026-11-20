import { createLazySde, createSde } from './core/sde'
import { shared } from './core/shared'
// Imported by package name so build plugins can replace it with the project's generated config.
import runtimeOptions from '@eve-online-tools/eve-sde/config'

if (runtimeOptions) {
  shared.options ??= runtimeOptions
}

/**
 * Shared default instance, one per realm even when several copies of the package are loaded. Build plugins configure
 * it; without one it reads the latest release remotely.
 */
export const sde = createLazySde(() => (shared.instance ??= createSde(shared.options?.() ?? {})))
