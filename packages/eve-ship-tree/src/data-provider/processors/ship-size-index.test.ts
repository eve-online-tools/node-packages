import { describe, expect, it } from 'vitest'

import { buildTypeIdToSizeClass } from './ship-size-index'

describe('buildTypeIdToSizeClass', () => {
  it('inverts size-class buckets into a typeId lookup', () => {
    const shipSizes = {
      0: { typeIDs: [588, 596] },
      1: { typeIDs: [582, 583] },
      2: { typeIDs: [620] },
    }

    expect(buildTypeIdToSizeClass(shipSizes)).toEqual({
      588: 0,
      596: 0,
      582: 1,
      583: 1,
      620: 2,
    })
  })

  it('returns an empty index for empty input', () => {
    expect(buildTypeIdToSizeClass({})).toEqual({})
  })
})
