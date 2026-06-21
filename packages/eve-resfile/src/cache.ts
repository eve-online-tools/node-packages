import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export const buildCacheDir = (cacheDir: string, buildNumber: string): string => join(cacheDir, buildNumber)

export const buildIndexPath = (cacheDir: string, buildNumber: string): string =>
  join(buildCacheDir(cacheDir, buildNumber), 'build-index.txt')

export const resfileIndexPath = (cacheDir: string, buildNumber: string): string =>
  join(buildCacheDir(cacheDir, buildNumber), 'resfileindex.txt')

export const resfileMapPath = (cacheDir: string, buildNumber: string): string =>
  join(buildCacheDir(cacheDir, buildNumber), 'resfile-map.json')

export const readCachedText = async (path: string): Promise<string | null> => {
  if (!existsSync(path)) {
    return null
  }
  return readFile(path, 'utf8')
}

export const writeCachedText = async (path: string, content: string): Promise<void> => {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, content)
}

export const readCachedMap = async (path: string): Promise<Map<string, string> | null> => {
  if (!existsSync(path)) {
    return null
  }

  const parsed = JSON.parse(await readFile(path, 'utf8')) as Record<string, string>
  return new Map(Object.entries(parsed))
}

export const writeCachedMap = async (path: string, map: Map<string, string>): Promise<void> => {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, JSON.stringify(Object.fromEntries(map)))
}
