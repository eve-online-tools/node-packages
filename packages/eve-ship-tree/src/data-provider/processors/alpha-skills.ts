import type { SkillLevel, Skills } from '../../skills-provider/context'
import type { Data } from '../types'

export type AlphaSkills = Skills

export const alphaSkillsProcessor = ({ cloneGrades }: Pick<Data, 'cloneGrades'>): AlphaSkills => {
  const alphaSkills = {} as AlphaSkills

  // Clone Grades are race => skills map
  for (const { skills } of Object.values(cloneGrades)) {
    if (!skills) {
      continue
    }

    for (const { level, typeID } of skills) {
      alphaSkills[typeID] = Math.max(alphaSkills[typeID] ?? 0, level) as SkillLevel
    }
  }

  return alphaSkills
}
