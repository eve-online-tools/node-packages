import { identifiers as shipTreeGroups } from '../data/identifiers/shipTreeGroups'
import type { SkillLevel, Skills } from '../skills-provider/context'

/** Dogma attribute value by attribute ID. */
export type DogmaAttributes = ReadonlyMap<number, number>

export const dogmaAttributeIds = {
  requiredSkill1: 182,
  requiredSkill2: 183,
  requiredSkill3: 184,
  requiredSkill1Level: 277,
  requiredSkill2Level: 278,
  requiredSkill3Level: 279,
  requiredSkill4: 1285,
  requiredSkill4Level: 1286,
  requiredSkill5Level: 1287,
  requiredSkill5: 1289,
  techLevel: 422,
  rigSize: 1547,
} as const

const requiredSkillPairs = [
  [dogmaAttributeIds.requiredSkill1, dogmaAttributeIds.requiredSkill1Level],
  [dogmaAttributeIds.requiredSkill2, dogmaAttributeIds.requiredSkill2Level],
  [dogmaAttributeIds.requiredSkill3, dogmaAttributeIds.requiredSkill3Level],
  [dogmaAttributeIds.requiredSkill4, dogmaAttributeIds.requiredSkill4Level],
  [dogmaAttributeIds.requiredSkill5, dogmaAttributeIds.requiredSkill5Level],
] as const

const freighterGroupIds = new Set<number>([shipTreeGroups.freighter, shipTreeGroups.jumpFreighters])

export const dogmaAttributes = (attributes: ReadonlyArray<{ attributeID: number; value: number }> = []) =>
  new Map(attributes.map(({ attributeID, value }) => [attributeID, value]))

/** Skill pairs whose skill is missing or 0 are skipped; a missing level is 0. */
export const requiredSkills = (attributes: DogmaAttributes): Skills => {
  const skills: Skills = {}
  for (const [skillAttributeId, levelAttributeId] of requiredSkillPairs) {
    const skillId = attributes.get(skillAttributeId)
    if (skillId) {
      skills[skillId] = (attributes.get(levelAttributeId) ?? 0) as SkillLevel
    }
  }
  return skills
}

/** The type's own `techLevel`, else dogma attribute 422, else 1. */
export const techLevel = (typeTechLevel: number | undefined, attributes: DogmaAttributes): number =>
  typeTechLevel ?? attributes.get(dogmaAttributeIds.techLevel) ?? 1

/** Freighters have no rig slots but sit with the capital-size hulls in the tree. */
export const rigSize = (shipTreeGroupID: number | undefined, attributes: DogmaAttributes): number =>
  shipTreeGroupID !== undefined && freighterGroupIds.has(shipTreeGroupID)
    ? 4
    : (attributes.get(dogmaAttributeIds.rigSize) ?? 0)
