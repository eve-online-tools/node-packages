import { LOAD_DATA_GENERIC_ERROR } from './types'

export const sanitizeLoadError = (error: unknown): Error => {
  /* oxlint-disable-next-line no-console -- intentional diagnostics for fetch failures */
  console.error('[eve-ship-tree] Failed to load ship tree data:', error)

  return new Error(LOAD_DATA_GENERIC_ERROR)
}
