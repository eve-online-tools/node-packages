import { createReadStream } from 'node:fs'
import { createInterface } from 'node:readline'

import { extractTableFromArchive } from './archive'
import { rawTablePath, readCachedText, writeCachedBuffer } from './cache'
import { parseJsonlLine } from './processors/parse-jsonl'
import { assertBareTableName, tableFileName } from './table-name'
import type { LoadSdeTableOptions, SdeJsonlRecord } from './types'

export const ensureRawTableFile = async (tableName: string, options: LoadSdeTableOptions): Promise<string> => {
  const bareName = assertBareTableName(tableName)
  const rawPath = rawTablePath(options.cacheDir, options.buildNumber, tableFileName(bareName))
  const cached = await readCachedText(rawPath)
  if (cached !== null) {
    return rawPath
  }

  const rawBuffer = await extractTableFromArchive(options.cacheDir, options.buildNumber, bareName)
  await writeCachedBuffer(rawPath, rawBuffer)
  return rawPath
}

export async function* loadSdeTableStream(
  tableName: string,
  options: LoadSdeTableOptions,
): AsyncGenerator<SdeJsonlRecord> {
  const rawPath = await ensureRawTableFile(tableName, options)
  const input = createReadStream(rawPath, { encoding: 'utf8' })
  const lines = createInterface({ input, crlfDelay: Infinity })

  try {
    for await (const line of lines) {
      const record = parseJsonlLine(line)
      if (record) {
        yield record
      }
    }
  } finally {
    input.destroy()
  }
}

export async function* readJsonLinesFile(path: string): AsyncGenerator<unknown> {
  const input = createReadStream(path, { encoding: 'utf8' })
  const lines = createInterface({ input, crlfDelay: Infinity })

  try {
    for await (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) {
        continue
      }

      yield JSON.parse(trimmed) as unknown
    }
  } finally {
    input.destroy()
  }
}
