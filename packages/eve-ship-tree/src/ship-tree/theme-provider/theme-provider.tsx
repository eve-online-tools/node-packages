import { type PropsWithChildren, useMemo } from 'react'

import { ThemeContext, type ShipTreeTheme, type ThemeContextValue } from './context'

export type ThemeProviderProps = PropsWithChildren & {
  theme: ShipTreeTheme
}

export const ThemeProvider = ({ children, theme }: ThemeProviderProps) => {
  const value = useMemo((): ThemeContextValue => ({ theme }), [theme])

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}
