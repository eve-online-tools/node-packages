import { type PropsWithChildren, useEffect, useMemo, useState } from 'react'

import { DataContext, ProcessedContext, type DataContextValue } from './context'
import { loadShipTreeData } from './loader'
import { sanitizeLoadError } from './sanitize-load-error'
import type { Data, DataStatus } from './types'
import {
  alphaSkillsProcessor,
  buildShipsByGroupFactionIndex,
  buildTypeIdToSizeClass,
  shipTreeGroupsProcessor,
  shipTypesProcessor,
} from './processors'
import { useSkills } from '../skills-provider'

export type DataProviderProps = PropsWithChildren &
  ({ data: Data; baseUrl?: never; fetch?: never } | { baseUrl: string; data?: never; fetch?: typeof fetch })

export const DataProvider = (props: DataProviderProps) => {
  const { children, fetch = globalThis.fetch } = props
  const inlineData = 'data' in props ? props.data : undefined
  const baseUrl = 'baseUrl' in props ? props.baseUrl : undefined
  const [fetchedData, setFetchedData] = useState<Data | null>(null)
  const [status, setStatus] = useState<DataStatus>(inlineData !== undefined ? 'ready' : 'loading')
  const [error, setError] = useState<Error | null>(null)

  useEffect(() => {
    if (baseUrl === undefined) {
      return
    }

    let cancelled = false
    let requestId = 0

    const load = async () => {
      const currentRequestId = ++requestId

      setStatus('loading')
      setError(null)
      setFetchedData(null)

      try {
        const data = await loadShipTreeData({ baseUrl, fetch })

        if (cancelled || currentRequestId !== requestId) {
          return
        }

        setFetchedData(data)
        setStatus('ready')
      } catch (loadError) {
        if (cancelled || currentRequestId !== requestId) {
          return
        }

        setError(sanitizeLoadError(loadError))
        setStatus('error')
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [baseUrl, fetch])

  const value = useMemo((): DataContextValue => {
    if (baseUrl !== undefined) {
      return {
        data: fetchedData,
        status,
        error,
      }
    }

    return {
      data: inlineData ?? null,
      status: 'ready',
      error: null,
    }
  }, [baseUrl, inlineData, fetchedData, status, error])

  const currentSkills = useSkills()

  const sourceData = baseUrl !== undefined ? fetchedData : inlineData

  const shipsByGroupFaction = useMemo(() => {
    if (!sourceData) {
      return null
    }

    return buildShipsByGroupFactionIndex(sourceData.types)
  }, [sourceData])

  const processedState = useMemo(() => {
    if (!sourceData || status !== 'ready' || shipsByGroupFaction === null) {
      return {
        status: status === 'error' ? ('error' as const) : ('loading' as const),
        processed: null,
      }
    }

    const alphaSkills = alphaSkillsProcessor(sourceData)
    const shipTypes = shipTypesProcessor(currentSkills, sourceData)
    const shipTreeGroups = shipTreeGroupsProcessor(
      alphaSkills,
      currentSkills,
      shipTypes,
      shipsByGroupFaction,
      sourceData,
    )

    const shipSizeByTypeId = buildTypeIdToSizeClass(sourceData.shipSizes as Record<number, { typeIDs: number[] }>)

    return {
      status: 'ready' as const,
      processed: {
        alphaSkills,
        shipTreeGroups,
        shipTypes,
        shipSizeByTypeId,
      },
    }
  }, [sourceData, status, currentSkills, shipsByGroupFaction])

  return (
    <DataContext.Provider value={value}>
      <ProcessedContext.Provider value={processedState}>{children}</ProcessedContext.Provider>
    </DataContext.Provider>
  )
}
DataProvider.displayName = '@eve-online-tools/eve-ship-tree/DataProvider'
