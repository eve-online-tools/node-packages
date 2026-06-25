import type { SdeJsonlRecord } from '../types'

export type ParsedSdeTable = Record<string | number, unknown>

export type ParseJsonlOptions = {
  onDuplicate?: 'throw' | 'last'
}

export const parseJsonlLine = (line: string): SdeJsonlRecord | null => {
  const trimmed = line.trim()
  if (!trimmed) {
    return null
  }

  const record = JSON.parse(trimmed) as Record<string, unknown>
  if (!('_key' in record)) {
    throw new Error('SDE JSONL record is missing _key.')
  }

  const key = record._key
  if (key === undefined || key === null) {
    throw new Error('SDE JSONL record has an invalid _key.')
  }

  if ('_value' in record && Object.keys(record).length === 2) {
    return { key: key as string | number, value: record._value, kind: 'value' }
  }

  const { _key: _ignored, ...value } = record
  return { key: key as string | number, value, kind: 'object' }
}

export const parseJsonlTable = (content: string, options: ParseJsonlOptions = {}): ParsedSdeTable => {
  const onDuplicate = options.onDuplicate ?? 'throw'
  const table: ParsedSdeTable = {}
  const lines = content.split('\n')

  for (let lineNumber = 1; lineNumber <= lines.length; lineNumber++) {
    const record = parseJsonlLine(lines[lineNumber - 1]!)
    if (!record) {
      continue
    }

    if (Object.hasOwn(table, record.key)) {
      if (onDuplicate === 'throw') {
        throw new Error(`Duplicate _key ${JSON.stringify(record.key)} at line ${lineNumber}.`)
      }
    }

    table[record.key] = record.value
  }

  return table
}
