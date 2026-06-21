import { useContext } from 'react'

import { SkillsContext, type Skills } from './context'

export const useSkills = (): Skills => {
  const context = useContext(SkillsContext)

  if (!context) {
    throw new Error('useSkills must be used within a SkillProvider')
  }

  return context.skills
}
