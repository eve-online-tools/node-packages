import { Identifier } from '../../data/identifiers/shipTreeFactions'
import { useShipTreeTheme } from './use-theme'

export const useFaction = (): Identifier => {
  const { faction } = useShipTreeTheme()

  if (faction === undefined) {
    throw new Error('useFaction must be used within a ThemeProvider')
  }

  return faction
}
