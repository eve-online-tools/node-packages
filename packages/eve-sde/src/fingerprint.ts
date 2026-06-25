import { existsSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { lockFileName, lockSchemaVersion } from './constants'
import type { ResolvedSdeOptions, SdeLockFile, SdeLockTable } from './types'

export const lockFilePath = (outputDir: string): string => join(outputDir, lockFileName)

export const readLockFile = async (outputDir: string): Promise<SdeLockFile | null> => {
  const path = lockFilePath(outputDir)
  if (!existsSync(path)) {
    return null
  }

  return JSON.parse(await readFile(path, 'utf8')) as SdeLockFile
}

const buildLockTables = (options: ResolvedSdeOptions): SdeLockTable[] =>
  [...options.tables.entries()]
    .map(([name, outputFile]) => ({ name, outputFile }))
    .sort((left, right) => left.name.localeCompare(right.name))

export const buildLockFile = (buildNumber: string, options: ResolvedSdeOptions): SdeLockFile => ({
  lockSchemaVersion,
  buildNumber,
  tables: buildLockTables(options),
  jsonSpace: options.jsonSpace ?? null,
  processors: options.processors
    .map((processor) => ({
      id: processor.id,
      version: processor.version,
    }))
    .sort((left, right) => left.id.localeCompare(right.id)),
  generatedAt: new Date().toISOString(),
})

export const lockMatchesConfig = (lock: SdeLockFile, buildNumber: string, options: ResolvedSdeOptions): boolean => {
  const expected = buildLockFile(buildNumber, options)

  if (lock.lockSchemaVersion !== expected.lockSchemaVersion) {
    return false
  }

  if (lock.buildNumber !== expected.buildNumber) {
    return false
  }

  if (lock.jsonSpace !== expected.jsonSpace) {
    return false
  }

  if (JSON.stringify(lock.tables) !== JSON.stringify(expected.tables)) {
    return false
  }

  return JSON.stringify(lock.processors) === JSON.stringify(expected.processors)
}

export const writeLockFile = async (outputDir: string, lock: SdeLockFile): Promise<void> => {
  await writeFile(lockFilePath(outputDir), `${JSON.stringify(lock, null, 2)}\n`, 'utf8')
}

export const shouldSkipProcessing = async (
  outputDir: string,
  buildNumber: string,
  options: ResolvedSdeOptions,
): Promise<boolean> => {
  if (options.force) {
    return false
  }

  const lock = await readLockFile(outputDir)
  if (!lock) {
    return false
  }

  return lockMatchesConfig(lock, buildNumber, options)
}
