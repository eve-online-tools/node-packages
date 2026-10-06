import { createContext } from 'react'
import { Identifier } from '../../data/identifiers/shipTreeFactions'

/** Ship prices in ISK by type id, or a lookup returning `undefined` for unknown ships. */
export type ShipPrices = Record<number, number> | ((typeId: number) => number | undefined)

export type ShipTreeTheme = {
  // The faction of the ship tree
  faction: Identifier

  // Whether the tree root capsule uses the GA AU-79 color
  goldenCapsule: boolean

  // Whether the viewer has Omega
  isOmega: boolean

  // When enabled, the tree will try to adhere more to how the EVE client displays the tree, bugs included.
  strictMode: boolean

  // Shown in ship tooltips when set
  prices?: ShipPrices

  // Number format locale for tooltips; defaults to the reader's locale
  locale?: string
}

export type ThemeContextValue = {
  theme: ShipTreeTheme
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
ThemeContext.displayName = '@eve-online-tools/eve-ship-tree/ThemeContext'
