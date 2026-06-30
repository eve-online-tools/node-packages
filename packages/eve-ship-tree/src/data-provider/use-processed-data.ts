import { useContext } from 'react'

import { ProcessedContext, type ProcessedContextValue } from './context'

export const useProcessedData = (): ProcessedContextValue => {
  const context = useContext(ProcessedContext)

  if (!context) {
    throw new Error('useProcessedData must be used within a DataProvider')
  }

  if (context.status !== 'ready' || !context.processed) {
    throw new Error('Ship tree data is not ready yet')
  }

  return context.processed
}
