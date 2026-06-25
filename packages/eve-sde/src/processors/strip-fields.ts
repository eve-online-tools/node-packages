import { writeSdeRecord } from './sde-jsonl'
import { stripFieldsIdPrefix } from '../constants'
import { assertBareTableName } from '../table-name'
import { applyStripFields } from '../translation-dict'
import type { SdeProcessor, StripFieldsOptions } from '../types'

export const stripFieldsProcessorId = (tableName: string): string =>
  `${stripFieldsIdPrefix}${assertBareTableName(tableName)}`

const validateStripFieldsOptions = (options: StripFieldsOptions): void => {
  if (options.languages && options.keepLanguages) {
    throw new Error('stripFields: set either "languages" or "keepLanguages", not both.')
  }

  if (options.keys && options.keepKeys) {
    throw new Error('stripFields: set either "keys" or "keepKeys", not both.')
  }

  if (options.keepLanguages && !options.fallbackLanguage) {
    throw new Error('stripFields: "fallbackLanguage" is required when "keepLanguages" is set.')
  }
}

const stableSerialize = (options: StripFieldsOptions): string => {
  const normalized = {
    fields: options.fields ? [...options.fields].sort() : undefined,
    languages: options.languages ? [...options.languages].sort() : undefined,
    keepLanguages: options.keepLanguages ? [...options.keepLanguages].sort() : undefined,
    fallbackLanguage: options.fallbackLanguage,
    keys: options.keys ? [...options.keys].map(String).sort() : undefined,
    keepKeys: options.keepKeys ? [...options.keepKeys].map(String).sort() : undefined,
  }

  return JSON.stringify(normalized)
}

const shouldSkipRow = (
  key: string | number,
  keysSet: Set<string | number> | undefined,
  keepKeysSet: Set<string | number> | undefined,
): boolean => {
  if (keysSet?.has(key)) {
    return true
  }

  if (keepKeysSet && !keepKeysSet.has(key)) {
    return true
  }

  return false
}

export const stripFields = (tableName: string, options: StripFieldsOptions): SdeProcessor => {
  validateStripFieldsOptions(options)

  const bareTableName = assertBareTableName(tableName)
  const keysSet = options.keys ? new Set(options.keys) : undefined
  const keepKeysSet = options.keepKeys ? new Set(options.keepKeys) : undefined

  return {
    id: stripFieldsProcessorId(bareTableName),
    version: stableSerialize(options),
    run: async ({ loadStream, streamJson }) => {
      const out = await streamJson(`${bareTableName}.jsonl`)

      for await (const record of loadStream(bareTableName)) {
        if (shouldSkipRow(record.key, keysSet, keepKeysSet)) {
          continue
        }

        const stripped = applyStripFields(record.value, options)
        await writeSdeRecord(out, record, stripped)
      }

      await out.close()
    },
  }
}
