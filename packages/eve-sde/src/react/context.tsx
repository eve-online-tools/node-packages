import { createContext, use, type ReactNode } from 'react'
import type { Sde, SdeScope } from '../core/sde'
import { sde as globalSde } from '../global'

const SdeContext = createContext<Sde | SdeScope>(globalSde)

/** Provides the instance hooks read from. Pass a scope during SSR so `dehydrate(scope)` captures rendered rows. */
export const SdeProvider = ({ sde, children }: { sde: Sde | SdeScope; children: ReactNode }) => (
  <SdeContext value={sde}>{children}</SdeContext>
)

export const useSdeReader = (): Sde | SdeScope => use(SdeContext)
