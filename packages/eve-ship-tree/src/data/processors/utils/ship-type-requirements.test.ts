import { describe, expect, it } from 'vitest'

import { dogmaAttributeIds, extractRequiredSkills, resolveNumericTechLevel } from './ship-type-requirements'

describe('extractRequiredSkills', () => {
  it('extracts required skill pairs from dogma attributes', () => {
    const attributes: Array<[number, number]> = [
      [dogmaAttributeIds.requiredSkill1, 3330],
      [dogmaAttributeIds.requiredSkill1Level, 1],
    ]

    expect(extractRequiredSkills(attributes)).toEqual({ 3330: 1 })
  })

  it('skips empty skill slots', () => {
    const attributes: Array<[number, number]> = [
      [dogmaAttributeIds.requiredSkill1, 0],
      [dogmaAttributeIds.requiredSkill1Level, 1],
      [dogmaAttributeIds.requiredSkill2, 3330],
      [dogmaAttributeIds.requiredSkill2Level, 3],
    ]

    expect(extractRequiredSkills(attributes)).toEqual({ 3330: 3 })
  })

  it('returns an empty object when no skill attributes are present', () => {
    expect(extractRequiredSkills([])).toEqual({})
    expect(extractRequiredSkills(undefined)).toEqual({})
  })
})

describe('resolveNumericTechLevel', () => {
  it('prefers the type techLevel when present', () => {
    expect(resolveNumericTechLevel({ techLevel: 2 }, [[dogmaAttributeIds.techLevel, 1]])).toBe(2)
  })

  it('falls back to dogma techLevel when the type field is missing', () => {
    expect(resolveNumericTechLevel({}, [[dogmaAttributeIds.techLevel, 2]])).toBe(2)
  })

  it('defaults to 1 when neither type nor dogma provide techLevel', () => {
    expect(resolveNumericTechLevel({}, [])).toBe(1)
    expect(resolveNumericTechLevel(undefined, undefined)).toBe(1)
  })
})
