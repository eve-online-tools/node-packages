import type { SkillLevel } from '../skills-provider/context'

/** Text keyed by language code, for example `{ en: 'Frigate' }`. */
export type LocalizedString = Record<string, string>

/** A position in an element list, as the SDE stores ship, group and faction elements. */
export type ElementPosition = { position: number; elementID: number }

export type ShipTypeRecord = {
  name?: LocalizedString
  shipTreeGroupID?: number
  factionID?: number
  metaGroupID?: number
  techLevel?: number
}

export type RequiredSkillsRecord = {
  requiredSkills?: Record<number, SkillLevel>
}

export type ShipTreeGroupPreReqSkill = { skillTypeID: number; display: boolean; level: number }

export type ShipTreeGroupRecord = {
  name?: LocalizedString
  description?: LocalizedString
  elements?: ElementPosition[]
  preReqSkills?: Array<{ factionID: number; skills: ShipTreeGroupPreReqSkill[] }>
}

export type CloneGradeRecord = {
  skills?: Array<{ level: number; typeID: number }>
}

export type CertificateSkillTypeRecord = {
  typeID: number
  basic: number
  standard: number
  improved: number
  advanced: number
  elite: number
}

export type CertificateRecord = {
  skillTypes?: CertificateSkillTypeRecord[]
}

export type MasteryRecord = {
  /** `level` is 0 to 4 for mastery levels I to V. */
  levels?: Array<{ level: number; certificateIDs: number[] }>
}

export type ShipSizeRecord = {
  typeIDs: number[]
}

export type ShipTreeElementRecord = {
  name?: LocalizedString
  description?: LocalizedString
}

export type ShipTreeFactionRecord = {
  description?: LocalizedString
  elements?: ElementPosition[]
}

export type SkillRecord = {
  name?: LocalizedString
}

export type TypeBonusEntry = {
  bonus?: number
  /** Text with `<a href=showinfo:ID>`, `<b>`, `<i>` and `<u>` markup. */
  bonusText?: LocalizedString
  importance?: number
  unitID?: number
}

export type TypeBonusRecord = {
  /** Bonuses per level of the skill `typeID`. */
  types?: Array<{ typeID: number; bonuses: TypeBonusEntry[] }>
  roleBonuses?: TypeBonusEntry[]
  miscBonuses?: TypeBonusEntry[]
}

export type TypeElementsRecord = {
  elements?: ElementPosition[]
}
