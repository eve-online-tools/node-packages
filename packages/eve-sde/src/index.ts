import { resolveSdeOptions } from './plugin-core'
import { processSdeWithResolvedOptions } from './processor'
import type { ProcessSdeResult, SdeOptions } from './types'

export const processSde = async (options: SdeOptions): Promise<ProcessSdeResult> => {
  const root = options.root ?? process.cwd()
  const resolvedOptions = resolveSdeOptions(options, root)
  return processSdeWithResolvedOptions(resolvedOptions)
}

export { loadSdeTable } from './load-table'
export { loadSdeTableStream } from './stream-table'
export { assertBareTableName } from './table-name'
export { resolveSdeOptions } from './plugin-core'
export { stripFields, parseJsonlLine, parseJsonlTable, formatSdeJsonlRecord, writeSdeRecord } from './processors'
export type { ParsedSdeTable } from './processors'
export { applyStripFields, isTranslationDict, stripTranslationDict } from './translation-dict'
export type { StripTranslationDictOptions } from './translation-dict'
export type {
  ProcessSdeResult,
  ResolvedSdeOptions,
  SdeGeneratedEntry,
  SdeJsonlRecord,
  SdeJsonStreamWriter,
  SdeLockFile,
  SdeOptions,
  SdeProcessor,
  SdeProcessorContext,
  SdeTextStreamWriter,
  StripFieldsOptions,
} from './types'
