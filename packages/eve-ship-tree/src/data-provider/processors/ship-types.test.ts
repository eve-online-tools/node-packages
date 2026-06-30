import { describe, expect, it } from 'vitest'

import type { Data } from '../types'
import { shipTypesProcessor } from './ship-types'

const bantamTypeId = 582

type ShipTypesInput = Pick<Data, 'types' | 'requiredSkills' | 'masteries' | 'certificates'>

const sourceData: ShipTypesInput = {
  types: {
    [bantamTypeId]: { metaGroupID: 1, shipTreeGroupID: 25, techLevel: 1 },
  },
  requiredSkills: {
    [bantamTypeId]: {
      requiredSkills: { 3330: 1 },
    },
  },
  masteries: {
    [bantamTypeId]: [{ _key: 0, _value: [] }],
  },
  certificates: {},
}

describe('shipTypesProcessor', () => {
  it('derives required skills and unlock state from prebuilt requirements', () => {
    const unlocked = shipTypesProcessor({ 3330: 1 }, sourceData)
    const locked = shipTypesProcessor({ 3330: 0 }, sourceData)

    expect(unlocked[bantamTypeId].requiredSkills).toEqual({ 3330: 1 })
    expect(unlocked[bantamTypeId].state).toBe('unlocked')
    expect(locked[bantamTypeId].state).toBe('locked')
  })

  it('derives tech level from type meta group and techLevel', () => {
    const result = shipTypesProcessor({}, sourceData)

    expect(result[bantamTypeId].techLevel).toBe('T1')
  })

  it('prefers type techLevel when present', () => {
    const result = shipTypesProcessor(
      {},
      {
        ...sourceData,
        types: {
          [bantamTypeId]: { metaGroupID: 1, techLevel: 2, shipTreeGroupID: 25 },
        },
      },
    )

    expect(result[bantamTypeId].techLevel).toBe('T2')
  })

  it('uses prebuilt techLevel when the type field is present', () => {
    const heliosTypeId = 11172

    const result = shipTypesProcessor(
      {},
      {
        types: {
          [heliosTypeId]: { metaGroupID: 2, shipTreeGroupID: 830, techLevel: 2 },
        },
        requiredSkills: {},
        masteries: {
          [heliosTypeId]: [{ _key: 0, _value: [] }],
        },
        certificates: {},
      },
    )

    expect(result[heliosTypeId].techLevel).toBe('T2')
  })

  it('includes ship types without mastery rows', () => {
    const ventureTypeId = 32880

    const result = shipTypesProcessor(
      { 3330: 1 },
      {
        types: {
          [ventureTypeId]: { metaGroupID: 1, shipTreeGroupID: 963, techLevel: 1 },
        },
        requiredSkills: {
          [ventureTypeId]: {
            requiredSkills: { 3330: 1 },
          },
        },
        masteries: {},
        certificates: {},
      },
    )

    expect(result[ventureTypeId]).toEqual(
      expect.objectContaining({
        masteries: {},
        masteryLevel: 0,
        state: 'unlocked',
        techLevel: 'T1',
      }),
    )
  })
})
