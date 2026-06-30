import { Identifier as GroupIdentifier } from '../../data/identifiers/shipTreeGroups'
import { Identifier as FactionIdentifier } from '../../data/identifiers/shipTreeFactions'
import type { ShipTypeRecord } from '../schema'
import { Data } from '../types'
import type { AlphaSkills } from './alpha-skills'
import type { SkillLevel, Skills } from '../../skills-provider/context'
import type { ShipTypeInfo } from './ship-types'

export type GroupStatus = 'locked' | 'unlocked'

export type PerFactionInfo = {
  // Skills that are displayed in the ship tree. Keyed by skill ID, values are required levels.
  displaySkills: Skills

  // Skills that are not displayed in the ship tree. Keyed by skill ID, values are required levels.
  otherSkills: Skills

  // Whether this group's required skills require Omega status
  omegaRestricted: boolean

  // Current resolved skill levels for all required skills (display and not displayed).
  currentSkills: Skills

  // The lowest active skill level for all required skills.
  currentMinimumLevel: SkillLevel

  // The highest active skill level for all required skills.
  currentMaximumLevel: SkillLevel

  // Whether this group is locked or unlocked, based on skills.
  status: GroupStatus

  // Whether all ships in this group are mastered.
  mastered: boolean

  // The ship types that are part of this group.
  shipTypes: number[]
}

export type ShipTreeGroup = {
  factions: Record<FactionIdentifier, PerFactionInfo>
  elements: number[]
}

export type GroupFactionKey = `${GroupIdentifier}:${FactionIdentifier}`

export type ShipsByGroupFaction = Map<GroupFactionKey, number[]>

const parseElements = (elements: Data['shipTreeGroups'][number]['elements']): number[] =>
  (elements ?? []).map((entry) => entry._value)

const collectRequiredSkills = (
  skills: NonNullable<Data['shipTreeGroups'][number]['preReqSkills']>[number]['skills'],
): {
  displaySkills: Skills
  otherSkills: Skills
  allSkills: RequiredSkill[]
} => {
  const displaySkills: Skills = {}
  const otherSkills: Skills = {}
  const allSkills: RequiredSkill[] = []

  for (const skill of skills ?? []) {
    const requiredLevel = skill.level as SkillLevel

    if (skill.display) {
      displaySkills[skill._key] = requiredLevel
    } else {
      otherSkills[skill._key] = requiredLevel
    }

    allSkills.push([skill._key, requiredLevel])
  }

  return { displaySkills, otherSkills, allSkills }
}

type RequiredSkill = [skillId: number, requiredLevel: SkillLevel]

const resolveGroupStatus = (allSkills: RequiredSkill[], currentSkills: Skills): GroupStatus => {
  if (allSkills.length === 0) {
    return 'unlocked'
  }

  const meetsRequirements = allSkills.every(
    ([skillId, requiredLevel]) => (currentSkills[skillId] ?? 0) >= requiredLevel,
  )

  return meetsRequirements ? 'unlocked' : 'locked'
}

export const buildShipsByGroupFactionIndex = (types: Record<number, ShipTypeRecord>): ShipsByGroupFaction => {
  const shipsByGroupFaction: ShipsByGroupFaction = new Map()

  for (const [id, type] of Object.entries(types)) {
    const { shipTreeGroupID, factionID } = type

    if (shipTreeGroupID == null || factionID == null) {
      continue
    }

    const key = `${shipTreeGroupID}:${factionID}` as GroupFactionKey
    const ships = shipsByGroupFaction.get(key)

    if (ships === undefined) {
      shipsByGroupFaction.set(key, [Number(id)])
    } else {
      ships.push(Number(id))
    }
  }

  return shipsByGroupFaction
}

export const shipTreeGroupsProcessor = (
  alphaSkills: AlphaSkills,
  currentSkills: Skills,
  shipTypes: Record<number, ShipTypeInfo>,
  shipsByGroupFaction: ShipsByGroupFaction,
  { shipTreeGroups }: Pick<Data, 'shipTreeGroups'>,
): Record<GroupIdentifier, ShipTreeGroup> => {
  const groups = {} as Record<GroupIdentifier, ShipTreeGroup>

  for (const [id, group] of Object.entries(shipTreeGroups)) {
    const groupId = Number(id) as GroupIdentifier
    const record = {
      elements: parseElements(group.elements),
      factions: {},
    } as ShipTreeGroup
    groups[groupId] = record

    for (const factionInfo of group.preReqSkills ?? []) {
      const factionId = factionInfo._key as FactionIdentifier
      const { displaySkills, otherSkills, allSkills } = collectRequiredSkills(factionInfo.skills)

      const resolvedCurrentSkills = Object.fromEntries(
        allSkills.map(([skillId]) => [skillId, (currentSkills[skillId] ?? -1) as SkillLevel]),
      ) as Skills

      const playerLevels = allSkills.map(([skillId]) => currentSkills[skillId] ?? -1)

      const ships = shipsByGroupFaction.get(`${groupId}:${factionId}` as GroupFactionKey) ?? []

      record.factions[factionId] = {
        displaySkills,
        otherSkills,
        omegaRestricted: allSkills.some(([skillId, requiredLevel]) => requiredLevel > (alphaSkills[skillId] ?? 0)),
        currentSkills: resolvedCurrentSkills,
        currentMinimumLevel: (playerLevels.length === 0 ? 0 : Math.min(...playerLevels)) as SkillLevel,
        currentMaximumLevel: (playerLevels.length === 0 ? 0 : Math.max(...playerLevels)) as SkillLevel,
        status: resolveGroupStatus(allSkills, currentSkills),
        shipTypes: ships,
        mastered: ships.every((typeId) => shipTypes[typeId]?.masteryLevel === 5),
      }
    }
  }

  return groups
}
