import { createContext, use, type Context, type ReactNode } from 'react'
import type { Sde, SdeScope } from '../core/sde'
import { shared } from '../core/shared'
import { sde as globalSde } from '../global'

// Shared so a provider from the app's copy reaches hooks in a library's copy of this package.
const SdeContext = (shared.reactContext ??= createContext<Sde | SdeScope>(globalSde)) as Context<Sde | SdeScope>

/** Provides the instance hooks read from. Pass a scope during SSR so `dehydrate(scope)` captures rendered rows. */
export const SdeProvider = ({ sde, children }: { sde: Sde | SdeScope; children: ReactNode }) => (
  <SdeContext value={sde}>{children}</SdeContext>
)

export const useSdeReader = (): Sde | SdeScope => use(SdeContext)
