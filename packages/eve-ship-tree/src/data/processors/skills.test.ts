import { describe, expect, it } from 'vitest'

import { collectReferencedSkillIds } from './skills'

describe('collectReferencedSkillIds', () => {
  it('collects skills from group prerequisites, ship bonuses and ship requirements', () => {
    const ids = collectReferencedSkillIds({
      shipTreeGroups: [{ preReqSkills: [{ skills: [{ _key: 3330 }, { _key: 3327 }] }] }, {}],
      typeBonus: [{ types: [{ _key: 3332 }] }, {}],
      requiredSkills: [{ requiredSkills: { '3331': 1 } }, {}],
    })

    expect([...ids].sort()).toEqual([3327, 3330, 3331, 3332])
  })
})
