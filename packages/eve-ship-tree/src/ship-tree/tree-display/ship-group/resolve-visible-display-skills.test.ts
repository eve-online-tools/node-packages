import { describe, expect, it } from 'vitest'

import type { PerFactionInfo } from '../../../data-provider/processors/ship-tree-groups'
import { resolveVisibleDisplaySkills } from './resolve-visible-display-skills'

const factionInfo = (
  status: PerFactionInfo['status'],
  displaySkills: PerFactionInfo['displaySkills'],
): PerFactionInfo => ({
  displaySkills,
  otherSkills: {},
  omegaRestricted: false,
  currentSkills: {},
  currentMinimumLevel: 0,
  currentMaximumLevel: 0,
  status,
  mastered: false,
  shipTypes: [],
})

describe('resolveVisibleDisplaySkills', () => {
  it('returns display skills when strict mode is off', () => {
    expect(resolveVisibleDisplaySkills(factionInfo('locked', { 3330: 1 }), false)).toEqual({ 3330: 1 })
  })

  it('hides display skills for locked groups in strict mode', () => {
    expect(resolveVisibleDisplaySkills(factionInfo('locked', { 3330: 1 }), true)).toEqual({})
  })

  it('keeps display skills for unlocked groups in strict mode', () => {
    expect(resolveVisibleDisplaySkills(factionInfo('unlocked', { 3330: 1, 3328: 2 }), true)).toEqual({
      3330: 1,
      3328: 2,
    })
  })
})
