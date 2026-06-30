import { useContext } from 'react'

import { DataContext, type DataContextValue } from './context'

export const useData = (): DataContextValue => {
  const context = useContext(DataContext)

  if (!context) {
    throw new Error('useData must be used within a DataProvider')
  }

  return context
}

export const useDataStatus = (): Pick<DataContextValue, 'status' | 'error'> => {
  const { status, error } = useData()

  return { status, error }
}
