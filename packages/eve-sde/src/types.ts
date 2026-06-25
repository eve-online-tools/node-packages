export type SdeJsonlRecord = {
  key: string | number
  value: unknown
  /** 'object' = {_key, ...fields}; 'value' = {_key, _value} only */
  kind: 'object' | 'value'
}

export type SdeJsonStreamWriter = {
  write: (value: unknown) => Promise<void>
  close: () => Promise<void>
}

export type SdeTextStreamWriter = {
  write: (chunk: string) => Promise<void>
  close: () => Promise<void>
}

export type SdeGeneratedEntry = {
  value?: unknown
  files: string[]
}

export type SdeProcessorContext = {
  buildNumber: string
  load: (tableName: string) => Promise<unknown>
  loadStream: (tableName: string) => AsyncGenerator<SdeJsonlRecord>
  /** Data returned by a processor that ran earlier (keyed by processor id) */
  generated: (name: string) => unknown
  /** Stream records from a prior processor's streamed output file */
  generatedStream: (name: string, file?: string) => AsyncGenerator<unknown>
  resolve: (...segments: string[]) => string
  writeJson: (relativePath: string, data: unknown) => Promise<void>
  writeText: (relativePath: string, content: string) => Promise<void>
  streamJson: (relativePath: string) => Promise<SdeJsonStreamWriter>
  streamText: (relativePath: string) => Promise<SdeTextStreamWriter>
}

export type SdeProcessor = {
  id: string
  /** Bump when `run` logic changes so the lock fingerprint invalidates. */
  version: string
  run: (ctx: SdeProcessorContext) => void | unknown | Promise<void | unknown>
}

export type SdeOptions = {
  outputDir: string
  buildNumber?: number | string
  cacheDir?: string
  root?: string
  tables?: string[] | Record<string, string>
  processors?: SdeProcessor[]
  force?: boolean
  jsonSpace?: number
}

export type ResolvedSdeOptions = {
  outputDir: string
  buildNumber?: number | string
  cacheDir: string
  tables: Map<string, string>
  processors: SdeProcessor[]
  force: boolean
  jsonSpace?: number
}

export type SdeLockTable = {
  name: string
  outputFile: string
}

export type SdeLockFile = {
  lockSchemaVersion: 2
  buildNumber: string
  tables: SdeLockTable[]
  jsonSpace: number | null
  processors: Array<{ id: string; version: string }>
  generatedAt: string
}

export type SdeTableDump = {
  tableName: string
  outputFileName: string
}

export type LoadSdeTableOptions = {
  cacheDir: string
  buildNumber: string
  jsonSpace?: number
}

export type ProcessSdeResult = {
  skipped: boolean
  buildNumber: string
  filesWritten: number
}

export type StripFieldsOptions = {
  /** Dot paths of fields to delete from each row (e.g. `icon`, `field.subfield`). No-op when unset. */
  fields?: readonly string[]
  /** Remove these locale keys from all translation dicts in the row. */
  languages?: readonly string[]
  /** Keep only these locale keys; missing kept locales filled from `fallbackLanguage`. */
  keepLanguages?: readonly string[]
  /** Required when `keepLanguages` is set. */
  fallbackLanguage?: string
  /** Skip rows whose `_key` is in this set. */
  keys?: readonly (string | number)[]
  /** Only emit rows whose `_key` is in this set. */
  keepKeys?: readonly (string | number)[]
}
