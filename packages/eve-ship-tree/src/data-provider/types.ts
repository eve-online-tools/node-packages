import type { filenames } from '../data/generated'
import type {
  CertificateRecord,
  CloneGradeRecord,
  MasteryRecord,
  RequiredSkillsRecord,
  ShipTreeGroupRecord,
  ShipTypeRecord,
} from './schema'

type StripJsonlExtension<T extends string> = T extends `${infer Name}.jsonl` ? Name : never

export type DataTableName = StripJsonlExtension<(typeof filenames)[number]>

type GenericTable = Record<number, unknown>

type TypedDataTables = {
  types: Record<number, ShipTypeRecord>
  requiredSkills: Record<number, RequiredSkillsRecord>
  certificates: Record<number, CertificateRecord>
  masteries: Record<number, MasteryRecord>
  cloneGrades: Record<number, CloneGradeRecord>
  shipTreeGroups: Record<number, ShipTreeGroupRecord>
}

export type Data = TypedDataTables & {
  [K in Exclude<DataTableName, keyof TypedDataTables>]: GenericTable
}

export type DataStatus = 'idle' | 'loading' | 'ready' | 'error'

export type LoadDataOptions = {
  baseUrl: string
  fetch?: typeof fetch
  /** Reject unsafe origins when loading in Node (SSRF mitigation). */
  validateBaseUrl?: boolean
  /** Per-request timeout in milliseconds. Defaults to 30_000. */
  timeoutMs?: number
  /** Maximum bytes per JSONL file before aborting. Defaults to 50 MiB. */
  maxBytesPerFile?: number
}

export const LOAD_DATA_GENERIC_ERROR = 'Failed to load ship tree data. Check the console for details.'
