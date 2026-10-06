import type { filenames } from '../data/generated'
import type {
  CertificateRecord,
  CloneGradeRecord,
  MasteryRecord,
  RequiredSkillsRecord,
  ShipSizeRecord,
  ShipTreeElementRecord,
  ShipTreeGroupRecord,
  ShipTypeRecord,
  SkillRecord,
  TypeBonusRecord,
  TypeElementsRecord,
} from './schema'

type StripJsonlExtension<T extends string> = T extends `${infer Name}.jsonl` ? Name : never

export type DataTableName = StripJsonlExtension<(typeof filenames)[number]>

type GenericTable = Record<number, unknown>

/** Tables the tree reads. Other loaders must produce these; see README "Data tables". */
export type RequiredDataTables = {
  types: Record<number, ShipTypeRecord>
  requiredSkills: Record<number, RequiredSkillsRecord>
  certificates: Record<number, CertificateRecord>
  masteries: Record<number, MasteryRecord>
  cloneGrades: Record<number, CloneGradeRecord>
  shipTreeGroups: Record<number, ShipTreeGroupRecord>
  shipSizes: Record<number, ShipSizeRecord>
}

/** Optional tables with a known shape, used by tooltips. */
export type TypedOptionalDataTables = {
  skills: Record<number, SkillRecord>
  shipTreeElements: Record<number, ShipTreeElementRecord>
  typeBonus: Record<number, TypeBonusRecord>
  typeElements: Record<number, TypeElementsRecord>
}

type OtherDataTables = {
  [K in Exclude<DataTableName, keyof RequiredDataTables | keyof TypedOptionalDataTables>]: GenericTable
} & TypedOptionalDataTables

/** All tables as loaded by `loadShipTreeData`. */
export type Data = RequiredDataTables & OtherDataTables

/** Accepted by `DataProvider` and `ShipTree.Root`: the tables the tree reads, the rest optional. */
export type PreloadedData = RequiredDataTables & Partial<OtherDataTables>

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
