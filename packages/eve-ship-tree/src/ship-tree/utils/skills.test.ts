import { describe, expect, it } from 'vitest'

import type { ShipTreeGroupRecord } from '../../data-provider/schema'
import { shipTreeGroupSkills } from './skills'

const sampleGroup: ShipTreeGroupRecord = {
  preReqSkills: [
    {
      factionID: 500001,
      skills: [
        { skillTypeID: 3330, display: true, level: 1 },
        { skillTypeID: 3327, display: false, level: 1 },
      ],
    },
    {
      factionID: 500002,
      skills: [{ skillTypeID: 3329, display: true, level: 1 }],
    },
  ],
}

describe('shipTreeGroupSkills', () => {
  it('returns skills for a matching faction', () => {
    expect(shipTreeGroupSkills(sampleGroup, 500001)).toEqual([
      { skillTypeID: 3330, display: true, level: 1 },
      { skillTypeID: 3327, display: false, level: 1 },
    ])
  })

  it('returns an empty list when the faction is missing', () => {
    expect(shipTreeGroupSkills(sampleGroup, 500003)).toEqual([])
  })

  it('returns an empty list when the group is undefined', () => {
    expect(shipTreeGroupSkills(undefined, 500001)).toEqual([])
  })
})
