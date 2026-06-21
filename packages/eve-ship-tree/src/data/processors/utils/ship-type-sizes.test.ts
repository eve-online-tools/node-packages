import { describe, expect, it } from 'vitest'

import { identifiers as shipTreeGroups } from '../../identifiers/shipTreeGroups'

import { dogmaAttributeIds, resolveRigSize } from './ship-type-sizes'

describe('resolveRigSize', () => {
  it('reads rigSize from dogma attributes', () => {
    const attributes: Array<[number, number]> = [[dogmaAttributeIds.rigSize, 2]]

    expect(resolveRigSize(shipTreeGroups.frigate, attributes)).toBe(2)
  })

  it('defaults to 0 when rigSize is missing', () => {
    expect(resolveRigSize(shipTreeGroups.frigate, [])).toBe(0)
    expect(resolveRigSize(shipTreeGroups.frigate, undefined)).toBe(0)
  })

  it('falls back to size 4 for freighters without rig attributes', () => {
    expect(resolveRigSize(shipTreeGroups.freighter, [])).toBe(4)
    expect(resolveRigSize(shipTreeGroups.jumpFreighters, undefined)).toBe(4)
  })

  it('prefers freighter fallback over dogma attributes', () => {
    const attributes: Array<[number, number]> = [[dogmaAttributeIds.rigSize, 2]]

    expect(resolveRigSize(shipTreeGroups.freighter, attributes)).toBe(4)
  })
})
