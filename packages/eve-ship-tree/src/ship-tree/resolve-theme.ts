import { Identifier } from '../data/identifiers/shipTreeFactions'
import type { ShipTreeTheme } from './theme-provider/context'

export type ResolveShipTreeThemeOptions = {
  goldenCapsule?: boolean
  isOmega?: boolean
  strictMode?: boolean
}

export function resolveShipTreeTheme(
  faction: Identifier,
  { goldenCapsule = false, isOmega = false, strictMode = false }: ResolveShipTreeThemeOptions = {},
): ShipTreeTheme {
  return { faction, goldenCapsule, isOmega, strictMode }
}
