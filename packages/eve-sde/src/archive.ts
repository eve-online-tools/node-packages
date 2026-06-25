import { existsSync } from 'node:fs'
import { mkdir, unlink } from 'node:fs/promises'

import { Unzip, UnzipInflate } from 'fflate'

import { archivePath, readCachedBuffer, writeCachedBuffer } from './cache'
import { sdeZipUrl } from './constants'
import { fetchBuffer } from './fetch'
import { tableFileName } from './table-name'

// ZIP file signature bytes (PK\x03\x04). Kept here so browser-safe processor bundles
// do not pull in Node's Buffer via shared constants.
const zipMagic = Buffer.from([0x50, 0x4b, 0x03, 0x04])

const archiveEntryCache = new Map<string, string[]>()
let listZipEntriesInvocations = 0

const archiveEntryCacheKey = (cacheDir: string, buildNumber: string): string => `${cacheDir}\0${buildNumber}`

export const isValidZipBuffer = (buffer: Buffer): boolean =>
  buffer.length >= 4 && buffer.subarray(0, 4).equals(zipMagic)

export const clearArchiveEntryCache = (): void => {
  archiveEntryCache.clear()
  listZipEntriesInvocations = 0
}

export const getListZipEntriesInvocations = (): number => listZipEntriesInvocations

const listZipEntries = async (zipData: Uint8Array): Promise<string[]> => {
  listZipEntriesInvocations += 1
  return listZipEntriesInner(zipData)
}

const listZipEntriesInner = async (zipData: Uint8Array): Promise<string[]> =>
  new Promise((resolve, reject) => {
    const entries: string[] = []
    const unzipper = new Unzip()

    unzipper.register(UnzipInflate)
    unzipper.onfile = (file) => {
      entries.push(file.name)
    }

    try {
      unzipper.push(zipData, true)
      queueMicrotask(() => resolve(entries))
    } catch (error) {
      reject(error)
    }
  })

const getArchiveEntries = async (cacheDir: string, buildNumber: string, zipBuffer: Buffer): Promise<string[]> => {
  const cacheKey = archiveEntryCacheKey(cacheDir, buildNumber)
  const cached = archiveEntryCache.get(cacheKey)
  if (cached) {
    return cached
  }

  const entries = await listZipEntries(new Uint8Array(zipBuffer))
  archiveEntryCache.set(cacheKey, entries)
  return entries
}

const extractZipEntry = async (zipData: Uint8Array, entryName: string): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    let found = false
    const unzipper = new Unzip()

    unzipper.register(UnzipInflate)
    unzipper.onfile = (file) => {
      if (file.name !== entryName) {
        return
      }

      found = true
      const chunks: Uint8Array[] = []

      file.ondata = (error, data, final) => {
        if (error) {
          reject(error)
          return
        }

        chunks.push(data)
        if (final) {
          resolve(Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))))
        }
      }

      file.start()
    }

    try {
      unzipper.push(zipData, true)
      queueMicrotask(() => {
        if (!found) {
          reject(new Error(`Entry "${entryName}" not found in SDE archive.`))
        }
      })
    } catch (error) {
      reject(error)
    }
  })

const resolveArchiveEntryName = (entries: string[], fileName: string): string => {
  if (entries.includes(fileName)) {
    return fileName
  }

  const nestedMatch = entries.find((entry) => entry.endsWith(`/${fileName}`))
  if (nestedMatch) {
    return nestedMatch
  }

  throw new Error(
    `Table file "${fileName}" not found in SDE archive. Available entries include: ${entries.slice(0, 10).join(', ')}${entries.length > 10 ? ', ...' : ''}`,
  )
}

const removeCachedArchive = async (cacheDir: string, buildNumber: string): Promise<void> => {
  const cachedPath = archivePath(cacheDir, buildNumber)
  archiveEntryCache.delete(archiveEntryCacheKey(cacheDir, buildNumber))
  if (existsSync(cachedPath)) {
    await unlink(cachedPath)
  }
}

export const ensureArchive = async (cacheDir: string, buildNumber: string): Promise<Buffer> => {
  const cachedPath = archivePath(cacheDir, buildNumber)
  const cached = await readCachedBuffer(cachedPath)
  if (cached && isValidZipBuffer(cached)) {
    return cached
  }

  if (cached) {
    await removeCachedArchive(cacheDir, buildNumber)
  }

  const zipUrl = sdeZipUrl(buildNumber)
  const zipBuffer = await fetchBuffer(zipUrl)
  if (!isValidZipBuffer(zipBuffer)) {
    throw new Error(`Downloaded SDE archive from ${zipUrl} is not a valid ZIP file.`)
  }

  await mkdir(cachedPath.replace(/[/\\][^/\\]+$/, ''), { recursive: true })
  await writeCachedBuffer(cachedPath, zipBuffer)
  return zipBuffer
}

export const extractTableFromArchive = async (
  cacheDir: string,
  buildNumber: string,
  tableName: string,
): Promise<Buffer> => {
  const fileName = tableFileName(tableName)
  const cachedPath = archivePath(cacheDir, buildNumber)

  try {
    const zipBuffer = await ensureArchive(cacheDir, buildNumber)
    const entries = await getArchiveEntries(cacheDir, buildNumber, zipBuffer)
    const entryName = resolveArchiveEntryName(entries, fileName)
    return extractZipEntry(new Uint8Array(zipBuffer), entryName)
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found in SDE archive')) {
      throw error
    }

    await removeCachedArchive(cacheDir, buildNumber)
    throw new Error(
      `Failed to extract "${tableName}" from SDE archive. Corrupt cache removed at ${cachedPath}; retry the build.`,
      { cause: error },
    )
  }
}

export const listArchiveTableNames = async (cacheDir: string, buildNumber: string): Promise<string[]> => {
  const zipBuffer = await ensureArchive(cacheDir, buildNumber)
  const entries = await getArchiveEntries(cacheDir, buildNumber, zipBuffer)
  return entries
    .map((entry) => entry.split('/').pop() ?? entry)
    .filter((entry) => entry.endsWith('.jsonl'))
    .map((entry) => entry.slice(0, -'.jsonl'.length))
}
