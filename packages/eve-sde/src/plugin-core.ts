import { isAbsolute, resolve, sep } from 'node:path'

import { defaultCacheDir, stripFieldsIdPrefix } from './constants'
import { assertBareTableName } from './table-name'
import type { SdeOptions, SdeTableDump, ResolvedSdeOptions } from './types'

export const resolveSdeOptions = (options: SdeOptions, root: string): ResolvedSdeOptions => {
  if (!options.outputDir) {
    throw new Error('SdeOptions.outputDir is required.')
  }

  const tables = normalizeTables(options.tables)
  const processors = options.processors ?? []

  if (tables.size === 0 && processors.length === 0) {
    throw new Error('At least one of SdeOptions.tables or SdeOptions.processors must be set.')
  }

  const processorIds = new Set<string>()
  const stripFieldsTables = new Set(
    processors
      .filter((processor) => processor.id.startsWith(stripFieldsIdPrefix))
      .map((processor) => processor.id.slice(stripFieldsIdPrefix.length)),
  )

  for (const processor of processors) {
    if (processorIds.has(processor.id)) {
      throw new Error(`Duplicate SdeProcessor id "${processor.id}".`)
    }
    if (!processor.id.startsWith(stripFieldsIdPrefix) && stripFieldsTables.has(processor.id)) {
      throw new Error(
        `SdeProcessor "${processor.id}" conflicts with stripFields("${processor.id}"). Custom processor ids must not match SDE table names used by stripFields; reference stripFields output via generated("${stripFieldsIdPrefix}${processor.id}").`,
      )
    }
    if (!processor.version) {
      throw new Error(
        `SdeProcessor "${processor.id}" is missing required "version". Bump version when changing run logic.`,
      )
    }
    processorIds.add(processor.id)
  }

  const cacheDir = options.cacheDir ?? defaultCacheDir

  return {
    outputDir: isAbsolute(options.outputDir) ? options.outputDir : resolve(root, options.outputDir),
    buildNumber: options.buildNumber,
    cacheDir: isAbsolute(cacheDir) ? cacheDir : resolve(root, cacheDir),
    tables,
    processors,
    force: options.force ?? false,
    jsonSpace: options.jsonSpace,
  }
}

export const normalizeTables = (tables: SdeOptions['tables']): Map<string, string> => {
  if (!tables) {
    return new Map()
  }

  if (Array.isArray(tables)) {
    return new Map(
      tables.map((tableName) => {
        const bareName = assertBareTableName(tableName)
        return [bareName, `${bareName}.json`]
      }),
    )
  }

  return new Map(
    Object.entries(tables).map(([tableName, outputFileName]) => {
      const bareName = assertBareTableName(tableName)
      return [bareName, outputFileName]
    }),
  )
}

export const getTableDumps = (options: ResolvedSdeOptions): SdeTableDump[] =>
  [...options.tables.entries()].map(([tableName, outputFileName]) => ({
    tableName,
    outputFileName,
  }))

export const resolveOutputPath = (outputDir: string, ...segments: string[]): string => {
  for (const segment of segments) {
    if (segment === '..' || segment.includes('..')) {
      throw new Error(`Output path escapes outputDir: ${segments.join('/')}`)
    }
  }

  const resolvedOutputDir = resolve(outputDir)
  const resolved = resolve(resolvedOutputDir, ...segments)

  if (resolved !== resolvedOutputDir && !resolved.startsWith(resolvedOutputDir + sep)) {
    throw new Error(`Output path escapes outputDir: ${segments.join('/')}`)
  }

  return resolved
}
