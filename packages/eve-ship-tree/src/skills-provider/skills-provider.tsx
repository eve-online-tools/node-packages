import { type PropsWithChildren, useMemo } from 'react'

import { SkillsContext, type SkillsContextValue, type SkillsInput } from './context'
import { normalizeSkills } from './normalize-skills'

export type SkillsProviderProps = PropsWithChildren & {
  skills: SkillsInput
}

export const SkillsProvider = ({ children, skills }: SkillsProviderProps) => {
  const value = useMemo((): SkillsContextValue => ({ skills: normalizeSkills(skills) }), [skills])

  return <SkillsContext.Provider value={value}>{children}</SkillsContext.Provider>
}
