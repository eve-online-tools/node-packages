import type { Skills } from '../../skills-provider/context'
import type {
  CertificateRecord,
  MasteryEntryRecord,
  MasteryRecord,
  RequiredSkillsRecord,
  ShipTypeRecord,
} from '../schema'
import { Data } from '../types'

export type ShipTechLevel = 'T1' | 'T2' | 'T3' | 'navy'
export type ShipState = 'locked' | 'unlocked'

export type ShipTypeInfo = {
  // The certificates that apply to this ship, and the level of the certificate that is reached
  certificates: Record<number, number>

  // The masteries that apply to this ship, and the certificates for that mastery
  masteries: Record<number, number[]>

  // The highest level mastery reached
  masteryLevel: number

  techLevel: ShipTechLevel

  // Skills required to fly this ship.
  requiredSkills: Skills

  // Whether the pilot meets the ship's skill requirements.
  state: ShipState
}

const certificateLevels = ['basic', 'standard', 'improved', 'advanced', 'elite'] as const

const getShipTechLevel = (type: ShipTypeRecord | undefined): ShipTechLevel => {
  if (type?.metaGroupID === 4) {
    return 'navy'
  }

  switch (type?.techLevel) {
    case 1:
      return 'T1'
    case 2:
      return 'T2'
    case 3:
      return 'T3'
    default: {
      return 'T1'
    }
  }
}

const getShipState = (requiredSkills: Skills, currentSkills: Skills): ShipState => {
  const requiredSkillEntries = Object.entries(requiredSkills)

  if (requiredSkillEntries.length === 0) {
    return 'unlocked'
  }

  const meetsRequirements = requiredSkillEntries.every(
    ([skillId, requiredLevel]) => (currentSkills[Number(skillId)] ?? 0) >= requiredLevel,
  )

  return meetsRequirements ? 'unlocked' : 'locked'
}

const getMasteryEntries = (mastery: MasteryRecord): MasteryEntryRecord[] =>
  Array.isArray(mastery) ? mastery : (mastery._value ?? [])

const getCertificateLevel = (certificate: CertificateRecord, currentSkills: Skills): number => {
  let level = 0

  for (let index = 0; index < certificateLevels.length; index++) {
    const levelName = certificateLevels[index]
    const meetsRequirements = (certificate.skillTypes ?? []).every(
      (skill) => (currentSkills[skill._key] ?? 0) >= (skill[levelName] ?? 0),
    )

    if (!meetsRequirements) {
      break
    }

    level = index + 1
  }

  return level
}

const parseMasteryCertificates = (mastery: MasteryRecord): Record<number, number[]> => {
  const result: Record<number, number[]> = {}

  for (const entry of getMasteryEntries(mastery)) {
    result[entry._key + 1] = entry._value ?? []
  }

  return result
}

const getMasteryLevel = (
  masteryCertificates: Record<number, number[]>,
  certificateLevels: Record<number, number>,
): number => {
  let level = 0

  for (let masteryLevel = 1; masteryLevel <= 5; masteryLevel++) {
    const requiredCertificates = masteryCertificates[masteryLevel] ?? []
    const meetsRequirements = requiredCertificates.every(
      (certificateId) => (certificateLevels[certificateId] ?? 0) >= masteryLevel,
    )

    if (!meetsRequirements) {
      break
    }

    level = masteryLevel
  }

  return level
}

const buildShipTypeInfo = (
  typeId: number,
  currentSkills: Skills,
  types: Record<number, ShipTypeRecord>,
  requiredSkillsByType: Record<number, RequiredSkillsRecord>,
  certificates: Record<number, CertificateRecord>,
  masteries: Record<number, MasteryRecord>,
): ShipTypeInfo => {
  const masteryData = masteries[typeId]
  const masteryCertificates = masteryData ? parseMasteryCertificates(masteryData) : {}
  const certificateIds = new Set<number>()

  for (const requiredCertificates of Object.values(masteryCertificates)) {
    for (const certificateId of requiredCertificates) {
      certificateIds.add(certificateId)
    }
  }

  const certificateLevelsById: Record<number, number> = {}

  for (const certificateId of certificateIds) {
    const certificate = certificates[certificateId]

    if (certificate === undefined) {
      continue
    }

    certificateLevelsById[certificateId] = getCertificateLevel(certificate, currentSkills)
  }

  const requiredSkills = requiredSkillsByType[typeId]?.requiredSkills ?? {}

  return {
    certificates: certificateLevelsById,
    masteries: masteryCertificates,
    masteryLevel: masteryData ? getMasteryLevel(masteryCertificates, certificateLevelsById) : 0,
    techLevel: getShipTechLevel(types[typeId]),
    requiredSkills,
    state: getShipState(requiredSkills, currentSkills),
  }
}

export const shipTypesProcessor = (
  currentSkills: Skills,
  {
    types,
    requiredSkills,
    certificates,
    masteries,
  }: Pick<Data, 'types' | 'requiredSkills' | 'certificates' | 'masteries'>,
): Record<number, ShipTypeInfo> => {
  const shipTypes = {} as Record<number, ShipTypeInfo>

  for (const [typeId, type] of Object.entries(types)) {
    if (type.shipTreeGroupID === undefined) {
      continue
    }

    shipTypes[Number(typeId)] = buildShipTypeInfo(
      Number(typeId),
      currentSkills,
      types,
      requiredSkills,
      certificates,
      masteries,
    )
  }

  return shipTypes
}
