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

export type ShipTreeGroupRecord = {
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
