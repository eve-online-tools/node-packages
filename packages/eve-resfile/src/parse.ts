import { eveClientManifest, resfileIndexPath } from './constants'
import { resPathLookupKey } from './lookup'
import type { EveClientManifest } from './types'

export const parseEveClientManifest = (json: unknown, host: string): EveClientManifest => {
  if (typeof json !== 'object' || json === null) {
    throw new Error(`Invalid ${eveClientManifest} from ${host}: expected an object.`)
  }

  const buildNumber = (json as { buildNumber?: unknown }).buildNumber

  if (buildNumber === undefined || buildNumber === null) {
    throw new Error(`Invalid ${eveClientManifest} from ${host}: missing buildNumber.`)
  }

  if (typeof buildNumber !== 'string' && typeof buildNumber !== 'number') {
    throw new Error(`Invalid ${eveClientManifest} from ${host}: buildNumber must be a string or number.`)
  }

  return { buildNumber: String(buildNumber) }
}

export const parseFirstTwoColumns = (line: string): [string, string] | null => {
  const commaIndex = line.indexOf(',')
  if (commaIndex === -1) {
    return null
  }

  const path = line.slice(0, commaIndex)
  const remainder = line.slice(commaIndex + 1)
  const secondComma = remainder.indexOf(',')
  const cdnPath = secondComma === -1 ? remainder : remainder.slice(0, secondComma)

  if (!path || !cdnPath) {
    return null
  }
  return [path, cdnPath]
}

export const parseResfileIndex = (content: string): Map<string, string> => {
  const map = new Map<string, string>()

  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    const parsed = parseFirstTwoColumns(trimmed)
    if (!parsed) {
      continue
    }

    const [resPath, cdnPath] = parsed
    map.set(resPathLookupKey(resPath), cdnPath)
  }

  return map
}

export const findResfileIndexCdnPath = (buildIndex: string): string => {
  for (const line of buildIndex.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) {
      continue
    }

    const parsed = parseFirstTwoColumns(trimmed)
    if (!parsed) {
      continue
    }

    const [path, cdnPath] = parsed
    if (path === resfileIndexPath) {
      return cdnPath
    }
  }

  throw new Error(`${resfileIndexPath} not found in build index.`)
}
