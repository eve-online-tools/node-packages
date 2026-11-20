import { createLazySde } from './core/sde'
// Imported by package name so build plugins can replace it with the project's generated config.
import runtimeOptions from '@eve-online-tools/eve-sde/config'

/** Shared default instance. Build plugins configure it; without one it reads the latest release remotely. */
export const sde = createLazySde(() => runtimeOptions?.() ?? {})
