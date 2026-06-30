import { describe, expect, it } from 'vitest'

import { identifiers as factions } from '../../data/identifiers/shipTreeFactions'
import { identifiers as groups } from '../../data/identifiers/shipTreeGroups'
import { buildShipsByGroupFactionIndex, shipTreeGroupsProcessor } from './ship-tree-groups'

const frigateGroup = {
  elements: [
    { _key: 1, _value: 30 },
    { _key: 2, _value: 22 },
  ],
  preReqSkills: [
    {
      _key: factions.caldariState,
      skills: [{ _key: 3330, display: true, level: 1 }],
    },
    {
      _key: factions.gallenteFederation,
      skills: [{ _key: 3328, display: true, level: 1 }],
    },
  ],
}

const interceptorGroup = {
  elements: [{ _key: 1, _value: 30 }],
  preReqSkills: [
    {
      _key: factions.caldariState,
      skills: [
        { _key: 3330, display: true, level: 5 },
        { _key: 12092, display: true, level: 1 },
      ],
    },
  ],
}

describe('shipTreeGroupsProcessor', () => {
  it('maps SDE array fields to faction-keyed processed data', () => {
    const result = shipTreeGroupsProcessor({ 3330: 1, 3328: 1 }, { 3330: 1, 3328: 0 }, {}, new Map(), {
      shipTreeGroups: {
        [groups.frigate]: frigateGroup,
      },
    })

    const caldari = result[groups.frigate].factions[factions.caldariState]
    const gallente = result[groups.frigate].factions[factions.gallenteFederation]

    expect(result[groups.frigate].elements).toEqual([30, 22])
    expect(caldari.displaySkills).toEqual({ 3330: 1 })
    expect(caldari.currentSkills).toEqual({ 3330: 1 })
    expect(caldari.status).toBe('unlocked')
    expect(gallente.displaySkills).toEqual({ 3328: 1 })
    expect(gallente.currentSkills).toEqual({ 3328: 0 })
    expect(gallente.status).toBe('locked')
  })

  it('marks groups locked until all required skills are trained', () => {
    const result = shipTreeGroupsProcessor({ 3330: 5, 12092: 1 }, { 3330: 3, 12092: 1 }, {}, new Map(), {
      shipTreeGroups: {
        [groups.interceptor]: interceptorGroup,
      },
    })

    expect(result[groups.interceptor].factions[factions.caldariState].status).toBe('locked')
  })

  it('marks groups unlocked when all required skills are trained', () => {
    const result = shipTreeGroupsProcessor({ 3330: 5, 12092: 1 }, { 3330: 5, 12092: 5 }, {}, new Map(), {
      shipTreeGroups: {
        [groups.interceptor]: interceptorGroup,
      },
    })

    expect(result[groups.interceptor].factions[factions.caldariState].status).toBe('unlocked')
  })

  it('flags omega-restricted groups when a requirement exceeds alpha limits', () => {
    const result = shipTreeGroupsProcessor({ 3330: 3, 12092: 1 }, { 3330: 5, 12092: 1 }, {}, new Map(), {
      shipTreeGroups: {
        [groups.interceptor]: interceptorGroup,
      },
    })

    expect(result[groups.interceptor].factions[factions.caldariState].omegaRestricted).toBe(true)
  })

  it('resolves ship types from a pre-built group/faction index', () => {
    const types = {
      582: {
        shipTreeGroupID: groups.frigate,
        factionID: factions.caldariState,
      },
      583: {
        shipTreeGroupID: groups.frigate,
        factionID: factions.caldariState,
      },
    }

    const index = buildShipsByGroupFactionIndex(types)
    const result = shipTreeGroupsProcessor({ 3330: 1 }, { 3330: 1 }, {}, index, {
      shipTreeGroups: {
        [groups.frigate]: frigateGroup,
      },
    })

    expect(result[groups.frigate].factions[factions.caldariState].shipTypes).toEqual([582, 583])
  })

  it('processes large type tables without rescanning per faction', () => {
    const types: Record<number, { shipTreeGroupID: number; factionID: number }> = {}

    for (let typeId = 1; typeId <= 2_000; typeId += 1) {
      types[typeId] = {
        shipTreeGroupID: groups.frigate,
        factionID: factions.caldariState,
      }
    }

    const index = buildShipsByGroupFactionIndex(types)
    const startedAt = performance.now()

    shipTreeGroupsProcessor({ 3330: 1 }, { 3330: 1 }, {}, index, {
      shipTreeGroups: {
        [groups.frigate]: frigateGroup,
      },
    })

    expect(performance.now() - startedAt).toBeLessThan(50)
  })
})
