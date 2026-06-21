import type { Client } from 'openapi-fetch'
import { createContext } from 'react'
import type { CombinedMiddlewareState, Middleware } from './types'

export type ProviderContext<Paths extends {}> = {
  client: Client<Paths, 'application/json'>
  middleware: Array<Middleware>
  state: CombinedMiddlewareState
}

export const context = createContext<ProviderContext<any> | null>(null)
