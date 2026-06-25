import { sdeLatestUrl } from './constants'
import { fetchText } from './fetch'
import type { ResolvedSdeOptions } from './types'

type LatestSdeRecord = {
  _key?: string
  buildNumber?: number | string
}

export const resolveBuildNumber = async (options: ResolvedSdeOptions): Promise<string> => {
  if (options.buildNumber !== undefined) {
    return String(options.buildNumber)
  }

  const latestText = await fetchText(sdeLatestUrl)
  const records = latestText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as LatestSdeRecord)

  const sdeRecord = records.find((record) => record._key === 'sde')
  if (!sdeRecord?.buildNumber) {
    throw new Error(`Missing SDE buildNumber in ${sdeLatestUrl}.`)
  }

  return String(sdeRecord.buildNumber)
}
