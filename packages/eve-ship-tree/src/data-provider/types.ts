import type {
  CertificateRecord,
  CloneGradeRecord,
  MasteryRecord,
  RequiredSkillsRecord,
  ShipSizeRecord,
  ShipTreeElementRecord,
  ShipTreeFactionRecord,
  ShipTreeGroupRecord,
  ShipTypeRecord,
  SkillRecord,
  TypeBonusRecord,
  TypeElementsRecord,
} from './schema'

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

/** Tables used by tooltips and `FactionSummary`; missing ones leave those parts out. */
export type OptionalDataTables = {
  skills: Record<number, SkillRecord>
  shipTreeElements: Record<number, ShipTreeElementRecord>
  shipTreeFactions: Record<number, ShipTreeFactionRecord>
  typeBonus: Record<number, TypeBonusRecord>
  typeElements: Record<number, TypeElementsRecord>
}

/** All tables, as built by `shipTreeDataset()` and loaded by `loadShipTreeData`. */
export type Data = RequiredDataTables & OptionalDataTables

export type DataTableName = keyof Data

/** Accepted by `DataProvider` and `ShipTree.Root`: the tables the tree reads, the rest optional. */
export type PreloadedData = RequiredDataTables & Partial<OptionalDataTables>

/** The value of `eve-sde:dataset/eve-ship-tree:data`. */
export type ShipTreeDataSource = {
  /** URL of the emitted data file. */
  url: string
}

export type DataStatus = 'idle' | 'loading' | 'ready' | 'error'

export type LoadDataOptions = {
  fetch?: typeof fetch
  /** Request timeout in milliseconds. Defaults to 30_000. */
  timeoutMs?: number
}

export const LOAD_DATA_GENERIC_ERROR = 'Failed to load ship tree data. Check the console for details.'
