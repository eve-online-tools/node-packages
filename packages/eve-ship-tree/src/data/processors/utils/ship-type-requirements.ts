import type { SkillLevel, Skills } from '../../../skills-provider/context'

export type TypeDogmaAttribute = [attribute: number, value: number]

export type ShipTypeRequirementsInput = {
  techLevel?: number
}

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
} as const

export const shipTypeRequirementAttributeIds = new Set<number>(Object.values(dogmaAttributeIds))

const requiredSkillPairs = [
  [dogmaAttributeIds.requiredSkill1, dogmaAttributeIds.requiredSkill1Level],
  [dogmaAttributeIds.requiredSkill2, dogmaAttributeIds.requiredSkill2Level],
  [dogmaAttributeIds.requiredSkill3, dogmaAttributeIds.requiredSkill3Level],
  [dogmaAttributeIds.requiredSkill4, dogmaAttributeIds.requiredSkill4Level],
  [dogmaAttributeIds.requiredSkill5, dogmaAttributeIds.requiredSkill5Level],
] as const

const requiredSkillAttributeIds = new Set<number>(
  requiredSkillPairs.flatMap(([skillId, levelId]) => [skillId, levelId]),
)

export const extractRequiredSkills = (attributes: TypeDogmaAttribute[] | undefined): Skills => {
  const values = new Map<number, number>()

  for (const [attribute, value] of attributes ?? []) {
    if (!requiredSkillAttributeIds.has(attribute)) {
      continue
    }
    values.set(attribute, value)
    if (values.size === requiredSkillAttributeIds.size) {
      break
    }
  }

  const requiredSkills: Skills = {}

  for (const [skillAttributeId, levelAttributeId] of requiredSkillPairs) {
    const skillId = values.get(skillAttributeId)

    if (skillId === undefined || skillId === 0) {
      continue
    }

    requiredSkills[skillId] = (values.get(levelAttributeId) ?? 0) as SkillLevel
  }

  return requiredSkills
}

export const resolveNumericTechLevel = (
  type: ShipTypeRequirementsInput | undefined,
  attributes: TypeDogmaAttribute[] | undefined,
): number => {
  if (type?.techLevel !== undefined) {
    return type.techLevel
  }

  const [, value] = (attributes ?? []).find(([attribute]) => attribute === dogmaAttributeIds.techLevel) ?? [0, 1]

  return value
}
