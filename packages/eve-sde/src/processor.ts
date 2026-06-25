import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { resolveBuildNumber } from './build-resolver'
import { buildLockFile, shouldSkipProcessing, writeLockFile } from './fingerprint'
import { loadSdeTable } from './load-table'
import { getTableDumps, resolveOutputPath } from './plugin-core'
import { createJsonStreamWriter, createTextStreamWriter } from './stream-output'
import { loadSdeTableStream, readJsonLinesFile } from './stream-table'
import type { ParsedSdeTable } from './processors/parse-jsonl'
import type { ProcessSdeResult, ResolvedSdeOptions, SdeGeneratedEntry, SdeProcessorContext } from './types'

import { formatJson } from './json-format'

const writeJsonFile = async (path: string, data: unknown, jsonSpace?: number): Promise<void> => {
  await mkdir(join(path, '..'), { recursive: true })
  await writeFile(path, formatJson(data, jsonSpace), 'utf8')
}

const loadOptions = (options: ResolvedSdeOptions, buildNumber: string) => ({
  cacheDir: options.cacheDir,
  buildNumber,
  jsonSpace: options.jsonSpace,
})

const createProcessorContext = (
  options: ResolvedSdeOptions,
  buildNumber: string,
  memoryCache: Map<string, ParsedSdeTable>,
  generated: Map<string, SdeGeneratedEntry>,
  streamOutputs: string[],
): SdeProcessorContext => {
  const tableOptions = loadOptions(options, buildNumber)

  return {
    buildNumber,
    load: (tableName) => loadSdeTable(tableName, tableOptions, memoryCache),
    loadStream: (tableName) => loadSdeTableStream(tableName, tableOptions),
    generated: (name) => {
      const entry = generated.get(name)
      if (!entry) {
        const available = [...generated.keys()]
        throw new Error(
          `No generated data for processor "${name}".${available.length > 0 ? ` Available: ${available.join(', ')}.` : ' No processors have returned data yet.'}`,
        )
      }

      if (entry.value !== undefined) {
        return entry.value
      }

      if (entry.files.length > 0) {
        throw new Error(
          `Processor "${name}" only wrote streamed output (${entry.files.join(', ')}). Use generatedStream("${name}") instead.`,
        )
      }

      throw new Error(`Processor "${name}" did not return or stream any data.`)
    },
    generatedStream: (name, file) => {
      const entry = generated.get(name)
      if (!entry || entry.files.length === 0) {
        throw new Error(`No streamed output for processor "${name}".`)
      }

      const relativePath = file ?? entry.files[0]
      if (!entry.files.includes(relativePath)) {
        throw new Error(
          `Processor "${name}" did not write "${relativePath}". Available files: ${entry.files.join(', ')}.`,
        )
      }

      return readJsonLinesFile(resolveOutputPath(options.outputDir, relativePath))
    },
    resolve: (...segments) => resolveOutputPath(options.outputDir, ...segments),
    writeJson: async (relativePath, data) => {
      await writeJsonFile(resolveOutputPath(options.outputDir, relativePath), data, options.jsonSpace)
    },
    writeText: async (relativePath, content) => {
      const path = resolveOutputPath(options.outputDir, relativePath)
      await mkdir(join(path, '..'), { recursive: true })
      await writeFile(path, content, 'utf8')
    },
    streamJson: async (relativePath) => {
      streamOutputs.push(relativePath)
      return createJsonStreamWriter(resolveOutputPath(options.outputDir, relativePath))
    },
    streamText: async (relativePath) => {
      streamOutputs.push(relativePath)
      return createTextStreamWriter(resolveOutputPath(options.outputDir, relativePath))
    },
  }
}

export const runProcessors = async (
  options: ResolvedSdeOptions,
  buildNumber: string,
  memoryCache: Map<string, ParsedSdeTable>,
): Promise<number> => {
  const generated = new Map<string, SdeGeneratedEntry>()
  let filesWritten = 0

  const tableContext = createProcessorContext(options, buildNumber, memoryCache, generated, [])
  for (const dump of getTableDumps(options)) {
    const data = await tableContext.load(dump.tableName)
    await tableContext.writeJson(dump.outputFileName, data)
    filesWritten += 1
  }

  for (const processor of options.processors) {
    const streamOutputs: string[] = []
    const context = createProcessorContext(options, buildNumber, memoryCache, generated, streamOutputs)
    const result = await processor.run(context)

    generated.set(processor.id, {
      value: result,
      files: streamOutputs,
    })
  }

  return filesWritten
}

export const processSdeWithResolvedOptions = async (options: ResolvedSdeOptions): Promise<ProcessSdeResult> => {
  await mkdir(options.outputDir, { recursive: true })
  await mkdir(options.cacheDir, { recursive: true })

  const buildNumber = await resolveBuildNumber(options)
  const skipped = await shouldSkipProcessing(options.outputDir, buildNumber, options)

  if (skipped) {
    return {
      skipped: true,
      buildNumber,
      filesWritten: 0,
    }
  }

  const memoryCache = new Map<string, ParsedSdeTable>()
  const tableDumpCount = getTableDumps(options).length
  const filesWritten = await runProcessors(options, buildNumber, memoryCache)

  await writeLockFile(options.outputDir, buildLockFile(buildNumber, options))

  return {
    skipped: false,
    buildNumber,
    filesWritten: Math.max(filesWritten, tableDumpCount),
  }
}
