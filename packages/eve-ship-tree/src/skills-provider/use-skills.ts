import { useContext } from 'react'

import { SkillsContext, type Skills, type SkillTraining } from './context'

export const useSkills = (): Skills => {
  const context = useContext(SkillsContext)

  if (!context) {
    throw new Error('useSkills must be used within a SkillProvider')
  }

  return context.skills
}

export const useSkillTraining = (): SkillTraining | undefined => {
  const context = useContext(SkillsContext)

  if (!context) {
    throw new Error('useSkillTraining must be used within a SkillProvider')
  }

  return context.training
}
