import type { SkillLevel } from '../skills-provider/context'

export type ShipTypeRecord = {
  shipTreeGroupID?: number
  factionID?: number
  metaGroupID?: number
  techLevel?: number
}

export type RequiredSkillsRecord = {
  requiredSkills?: Record<number, SkillLevel>
}

/** Text keyed by language code, for example `{ en: 'Frigate' }`. */
export type LocalizedString = Record<string, string>

export type ShipTreeGroupRecord = {
  name?: LocalizedString
  description?: LocalizedString
  elements?: Array<{ _key: number; _value: number }>
  preReqSkills?: Array<{
    _key: number
    skills: Array<{ _key: number; display: boolean; level: number }>
  }>
}

export type CloneGradeRecord = {
  skills?: Array<{ level: number; typeID: number }>
}

export type CertificateSkillTypeRecord = {
  _key: number
  basic: number
  standard: number
  improved: number
  advanced: number
  elite: number
}

export type CertificateRecord = {
  skillTypes?: CertificateSkillTypeRecord[]
}

export type MasteryEntryRecord = {
  _key: number
  _value?: number[]
}

export type MasteryRecord = MasteryEntryRecord[] | { _value?: MasteryEntryRecord[] }

export type ShipSizeRecord = {
  typeIDs: number[]
}

export type ShipTreeElementRecord = {
  name?: LocalizedString
  description?: LocalizedString
}

export type SkillRecord = {
  name?: LocalizedString
}
