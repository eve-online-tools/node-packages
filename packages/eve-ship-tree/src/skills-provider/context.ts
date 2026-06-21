import { createContext } from 'react'

export type SkillLevel = 0 | 1 | 2 | 3 | 4 | 5
export type Skills = Record<number, SkillLevel>

/** ESI `/characters/{id}/skills/` skill entry shape. */
export type EsiCharacterSkill = {
  skill_id: number
  active_skill_level: number
  trained_skill_level?: number
  skillpoints_in_skill?: number
}

export type SkillsInput = Skills | EsiCharacterSkill[]

export type SkillsContextValue = {
  skills: Skills
}

export const SkillsContext = createContext<SkillsContextValue | null>(null)
