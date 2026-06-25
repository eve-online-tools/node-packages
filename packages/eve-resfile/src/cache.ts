import { existsSync } from 'node:fs'
import { mkdir, readFile, rename, unlink, writeFile } from 'node:fs/promises'
import { basename, dirname, join } from 'node:path'

import { resPathLookupKey } from './lookup'

import { cacheSchemaVersion } from './constants'

export const buildCacheDir = (cacheDir: string, buildNumber: string): string => join(cacheDir, buildNumber)

export const buildIndexPath = (cacheDir: string, buildNumber: string): string =>
  join(buildCacheDir(cacheDir, buildNumber), 'build-index.txt')

export const resfileIndexPath = (cacheDir: string, buildNumber: string): string =>
  join(buildCacheDir(cacheDir, buildNumber), 'resfileindex.txt')

export const resfileMapPath = (cacheDir: string, buildNumber: string): string =>
  join(buildCacheDir(cacheDir, buildNumber), 'resfile-map.json')

type CachedResfileMapFile = {
  version: number
  buildNumber: string
  entries: Record<string, string>
}

const warnCacheCorruption = (path: string, reason: string): void => {
  process.stderr.write(`[eve-resfile] Ignoring corrupt cache file ${path}: ${reason}\n`)
}

const deleteCorruptCacheFile = async (path: string, reason: string): Promise<void> => {
  warnCacheCorruption(path, reason)

  if (existsSync(path)) {
    await unlink(path).catch(() => undefined)
  }
}

const writeFileAtomic = async (path: string, content: string): Promise<void> => {
  const directory = dirname(path)
  await mkdir(directory, { recursive: true })

  const tmpPath = join(directory, `.${basename(path)}.${process.pid}.tmp`)
  try {
    await writeFile(tmpPath, content, 'utf8')
    await rename(tmpPath, path)
  } catch (error) {
    await unlink(tmpPath).catch(() => undefined)
    throw error
  }
}

const isCachedResfileMapFile = (value: unknown): value is CachedResfileMapFile => {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const candidate = value as CachedResfileMapFile
  return (
    candidate.version === cacheSchemaVersion &&
    typeof candidate.buildNumber === 'string' &&
    typeof candidate.entries === 'object' &&
    candidate.entries !== null &&
    !Array.isArray(candidate.entries)
  )
}

export const readCachedText = async (path: string): Promise<string | null> => {
  if (!existsSync(path)) {
    return null
  }

  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    await deleteCorruptCacheFile(path, reason)
    return null
  }
}

export const writeCachedText = async (path: string, content: string): Promise<void> => {
  await writeFileAtomic(path, content)
}

export const readCachedMap = async (path: string, buildNumber: string): Promise<Map<string, string> | null> => {
  if (!existsSync(path)) {
    return null
  }

  try {
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'))

    if (!isCachedResfileMapFile(parsed)) {
      await deleteCorruptCacheFile(path, 'invalid cache schema')
      return null
    }

    if (parsed.buildNumber !== buildNumber) {
      await deleteCorruptCacheFile(path, `buildNumber mismatch (expected ${buildNumber}, got ${parsed.buildNumber})`)
      return null
    }

    return new Map(Object.entries(parsed.entries).map(([resPath, cdnPath]) => [resPathLookupKey(resPath), cdnPath]))
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error)
    await deleteCorruptCacheFile(path, reason)
    return null
  }
}

export const writeCachedMap = async (path: string, buildNumber: string, map: Map<string, string>): Promise<void> => {
  const payload: CachedResfileMapFile = {
    version: cacheSchemaVersion,
    buildNumber,
    entries: Object.fromEntries(map),
  }

  await writeFileAtomic(path, JSON.stringify(payload))
}
