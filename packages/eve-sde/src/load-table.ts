import { readFile } from 'node:fs/promises'

import { parsedTablePath, readCachedJson, writeCachedText } from './cache'
import { formatJson } from './json-format'
import { parseJsonlTable, type ParsedSdeTable } from './processors/parse-jsonl'
import { assertBareTableName } from './table-name'
import { ensureRawTableFile } from './stream-table'
import type { LoadSdeTableOptions } from './types'

export const loadSdeTable = async (
  tableName: string,
  options: LoadSdeTableOptions,
  memoryCache = new Map<string, ParsedSdeTable>(),
): Promise<ParsedSdeTable> => {
  const bareName = assertBareTableName(tableName)
  const cachedInMemory = memoryCache.get(bareName)
  if (cachedInMemory) {
    return cachedInMemory
  }

  const parsedPath = parsedTablePath(options.cacheDir, options.buildNumber, bareName, options.jsonSpace)
  const cachedParsed = await readCachedJson<ParsedSdeTable>(parsedPath, { invalidateOnCorrupt: true })
  if (cachedParsed) {
    memoryCache.set(bareName, cachedParsed)
    return cachedParsed
  }

  const rawPath = await ensureRawTableFile(tableName, options)
  const rawContent = await readFile(rawPath, 'utf8')
  const parsed = parseJsonlTable(rawContent)
  await writeCachedText(parsedPath, formatJson(parsed, options.jsonSpace))
  memoryCache.set(bareName, parsed)
  return parsed
}
