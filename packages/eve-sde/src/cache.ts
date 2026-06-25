import { existsSync } from 'node:fs'
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { archiveFileName } from './constants'

export const buildCacheDir = (cacheDir: string, buildNumber: string): string => join(cacheDir, buildNumber)

export const archivePath = (cacheDir: string, buildNumber: string): string =>
  join(buildCacheDir(cacheDir, buildNumber), archiveFileName)

export const rawTablePath = (cacheDir: string, buildNumber: string, tableFileName: string): string =>
  join(buildCacheDir(cacheDir, buildNumber), 'raw', tableFileName)

export const parsedTableFormatKey = (jsonSpace?: number): string =>
  jsonSpace === undefined ? 'compact' : `s${jsonSpace}`

export const parsedTablePath = (cacheDir: string, buildNumber: string, tableName: string, jsonSpace?: number): string =>
  join(buildCacheDir(cacheDir, buildNumber), 'parsed', `${tableName}.${parsedTableFormatKey(jsonSpace)}.json`)

export const readCachedText = async (path: string): Promise<string | null> => {
  if (!existsSync(path)) {
    return null
  }

  return readFile(path, 'utf8')
}

export const readCachedBuffer = async (path: string): Promise<Buffer | null> => {
  if (!existsSync(path)) {
    return null
  }

  return readFile(path)
}

export const writeCachedText = async (path: string, content: string): Promise<void> => {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content, 'utf8')
}

export const writeCachedBuffer = async (path: string, content: Buffer): Promise<void> => {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content)
}

export type ReadCachedJsonOptions = {
  /** Delete corrupt cache files and return null so callers can rebuild from source. */
  invalidateOnCorrupt?: boolean
}

export const readCachedJson = async <T>(path: string, options: ReadCachedJsonOptions = {}): Promise<T | null> => {
  const content = await readCachedText(path)
  if (content === null) {
    return null
  }

  try {
    return JSON.parse(content) as T
  } catch (error) {
    if (options.invalidateOnCorrupt) {
      await unlink(path).catch(() => {})
      return null
    }

    throw new Error(`Corrupt SDE cache at ${path}. Delete the file or run with force: true.`, { cause: error })
  }
}

export const writeCachedJson = async (path: string, data: unknown, space: number): Promise<void> => {
  await writeCachedText(path, `${JSON.stringify(data, null, space)}\n`)
}
