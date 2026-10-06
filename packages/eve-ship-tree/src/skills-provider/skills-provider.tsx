import { type PropsWithChildren, useMemo } from 'react'

import { SkillsContext, type SkillsContextValue, type SkillsInput, type SkillTraining } from './context'
import { normalizeSkills } from './normalize-skills'

export type SkillsProviderProps = PropsWithChildren & {
  skills: SkillsInput
  training?: SkillTraining
}

export const SkillsProvider = ({ children, skills, training }: SkillsProviderProps) => {
  const value = useMemo((): SkillsContextValue => ({ skills: normalizeSkills(skills), training }), [skills, training])

  return <SkillsContext.Provider value={value}>{children}</SkillsContext.Provider>
}
