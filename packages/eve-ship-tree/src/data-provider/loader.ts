import type { Data, LoadDataOptions, RequiredDataTables, ShipTreeDataSource } from './types'

const DEFAULT_TIMEOUT_MS = 30_000

const requiredTables: ReadonlyArray<keyof RequiredDataTables> = [
  'types',
  'requiredSkills',
  'certificates',
  'masteries',
  'cloneGrades',
  'shipTreeGroups',
  'shipSizes',
]

/** Loads the file emitted by `shipTreeDataset()`. */
export const loadShipTreeData = async (
  source: ShipTreeDataSource,
  { fetch: fetchImpl = fetch, timeoutMs = DEFAULT_TIMEOUT_MS }: LoadDataOptions = {},
): Promise<Data> => {
  const response = await fetchImpl(source.url, { signal: AbortSignal.timeout(timeoutMs) })

  if (!response.ok) {
    throw new Error(`Failed to load ship tree data from "${source.url}": ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as Data
  const missing = requiredTables.filter((table) => typeof data?.[table] !== 'object')

  if (missing.length > 0) {
    throw new Error(`Ship tree data from "${source.url}" is missing tables: ${missing.join(', ')}.`)
  }

  return data
}
