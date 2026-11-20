import type { SdeOptions } from './core/sde'

/**
 * Options of the shared `sde` instance. Published as `@eve-online-tools/eve-sde/config`, which the build plugins
 * replace with a module generated from the project's config.
 */
const options: (() => SdeOptions) | undefined = undefined

export default options
