import { describe, expect, it } from 'vitest'

import type { ShipTreeGroupRecord } from '../types/ship-tree-group'
import { shipTreeGroupSkills } from './skills'

const sampleGroup: ShipTreeGroupRecord = {
  preReqSkills: [
    {
      _key: 500001,
      skills: [
        { _key: 3330, display: true, level: 1 },
        { _key: 3327, display: false, level: 1 },
      ],
    },
    {
      _key: 500002,
      skills: [{ _key: 3329, display: true, level: 1 }],
    },
  ],
}

describe('shipTreeGroupSkills', () => {
  it('returns skills for a matching faction', () => {
    expect(shipTreeGroupSkills(sampleGroup, 500001)).toEqual([
      { _key: 3330, display: true, level: 1 },
      { _key: 3327, display: false, level: 1 },
    ])
  })

  it('returns an empty list when the faction is missing', () => {
    expect(shipTreeGroupSkills(sampleGroup, 500003)).toEqual([])
  })

  it('returns an empty list when the group is undefined', () => {
    expect(shipTreeGroupSkills(undefined, 500001)).toEqual([])
  })
})
