import { createContext } from 'react'
import { Identifier } from '../../data/identifiers/shipTreeFactions'

export type ShipTreeTheme = {
  // The faction of the ship tree
  faction: Identifier

  // Whether the tree root capsule uses the GA AU-79 color
  goldenCapsule: boolean

  // Whether the viewer has Omega
  isOmega: boolean

  // When enabled, the tree will try to adhere more to how the EVE client displays the tree, bugs included.
  strictMode: boolean
}

export type ThemeContextValue = {
  theme: ShipTreeTheme
}

export const ThemeContext = createContext<ThemeContextValue | null>(null)
ThemeContext.displayName = '@eve-online-tools/eve-ship-tree/ThemeContext'
