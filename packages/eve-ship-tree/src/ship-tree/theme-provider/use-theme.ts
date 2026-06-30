import { useContext } from 'react'

import { ThemeContext, type ShipTreeTheme } from './context'

export const useShipTreeTheme = (): Partial<ShipTreeTheme> => {
  const context = useContext(ThemeContext)

  return context?.theme ?? {}
}
