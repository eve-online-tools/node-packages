import type { EsiCharacterSkill, SkillLevel, Skills, SkillsInput } from './context'

export const isEsiCharacterSkills = (skills: unknown): skills is EsiCharacterSkill[] => {
  if (!Array.isArray(skills)) {
    return false
  }

  if (skills.length === 0) {
    return true
  }

  const first = skills[0]
  return typeof first === 'object' && first !== null && 'skill_id' in first && 'active_skill_level' in first
}

export const normalizeSkills = (skills: SkillsInput): Skills => {
  if (!isEsiCharacterSkills(skills)) {
    return skills
  }

  return Object.fromEntries(
    skills.map(({ skill_id, active_skill_level }) => [skill_id, active_skill_level as SkillLevel]),
  ) as Skills
}
