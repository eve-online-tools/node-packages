import { identifiers as shipTreeGroups } from '../data/identifiers/shipTreeGroups'
import { dogmaAttributeIds as ids, dogmaAttributes, requiredSkills, rigSize, techLevel } from './dogma'

const attributes = (...pairs: Array<[number, number]>) =>
  dogmaAttributes(pairs.map(([attributeID, value]) => ({ attributeID, value })))

describe('requiredSkills', () => {
  it('reads skill and level pairs', () => {
    expect(requiredSkills(attributes([ids.requiredSkill1, 3330], [ids.requiredSkill1Level, 1]))).toEqual({ 3330: 1 })
  })

  it('skips empty skill slots and defaults missing levels to 0', () => {
    expect(
      requiredSkills(
        attributes(
          [ids.requiredSkill1, 0],
          [ids.requiredSkill1Level, 1],
          [ids.requiredSkill2, 3330],
          [ids.requiredSkill2Level, 3],
          [ids.requiredSkill5, 3327],
        ),
      ),
    ).toEqual({ 3330: 3, 3327: 0 })
    expect(requiredSkills(attributes())).toEqual({})
  })
})

describe('techLevel', () => {
  it('prefers the type field, then dogma, then 1', () => {
    expect(techLevel(2, attributes([ids.techLevel, 1]))).toBe(2)
    expect(techLevel(undefined, attributes([ids.techLevel, 2]))).toBe(2)
    expect(techLevel(undefined, attributes())).toBe(1)
  })
})

describe('rigSize', () => {
  it('reads rig size from dogma, defaulting to 0', () => {
    expect(rigSize(shipTreeGroups.frigate, attributes([ids.rigSize, 2]))).toBe(2)
    expect(rigSize(shipTreeGroups.frigate, attributes())).toBe(0)
  })

  it('puts freighters in size 4', () => {
    expect(rigSize(shipTreeGroups.freighter, attributes([ids.rigSize, 2]))).toBe(4)
    expect(rigSize(shipTreeGroups.jumpFreighters, attributes())).toBe(4)
  })
})
