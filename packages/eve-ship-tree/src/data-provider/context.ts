import { createContext } from 'react'

import type { Data, DataStatus } from './types'
import type { Identifier as GroupIdentifier } from '../data/identifiers/shipTreeGroups'
import type { AlphaSkills } from './processors'
import type { ShipTreeGroup } from './processors/ship-tree-groups'
import type { ShipTypeInfo } from './processors/ship-types'

export type DataContextValue = {
  data: Data | null
  status: DataStatus
  error: Error | null
}

export const DataContext = createContext<DataContextValue | null>(null)
DataContext.displayName = '@eve-online-tools/eve-ship-tree/DataContext'

export type ProcessedContextValue = {
  alphaSkills: AlphaSkills
  shipTreeGroups: Record<GroupIdentifier, ShipTreeGroup>
  shipTypes: Record<number, ShipTypeInfo>
  shipSizeByTypeId: Record<number, number>
}

export type ProcessedContextState =
  | { status: 'loading' | 'error'; processed: null }
  | { status: 'ready'; processed: ProcessedContextValue }

export const ProcessedContext = createContext<ProcessedContextState | null>(null)
ProcessedContext.displayName = '@eve-online-tools/eve-ship-tree/ProcessedContext'
