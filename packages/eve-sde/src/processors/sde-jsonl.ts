import type { SdeJsonStreamWriter, SdeJsonlRecord } from '../types'

export const formatSdeJsonlRecord = (record: SdeJsonlRecord, value: unknown): string => {
  const payload =
    record.kind === 'value' ? { _key: record.key, _value: value } : { _key: record.key, ...(value as object) }

  return `${JSON.stringify(payload)}\n`
}

export const writeSdeRecord = async (
  writer: SdeJsonStreamWriter,
  record: SdeJsonlRecord,
  value: unknown,
): Promise<void> => {
  await writer.write(JSON.parse(formatSdeJsonlRecord(record, value).trim()) as Record<string, unknown>)
}
