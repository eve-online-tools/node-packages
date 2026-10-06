import { Identifier } from '../data/identifiers/shipTreeFactions'
import type { ShipPrices, ShipTreeTheme } from './theme-provider/context'

export type ResolveShipTreeThemeOptions = {
  goldenCapsule?: boolean
  isOmega?: boolean
  strictMode?: boolean
  prices?: ShipPrices
  locale?: string
}

export function resolveShipTreeTheme(
  faction: Identifier,
  { goldenCapsule = false, isOmega = false, strictMode = false, prices, locale }: ResolveShipTreeThemeOptions = {},
): ShipTreeTheme {
  return { faction, goldenCapsule, isOmega, strictMode, prices, locale }
}
