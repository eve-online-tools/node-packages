import { describe, expect, it } from 'vitest'

import type { GroupStatus, ShipTreeGroup } from '../../data-provider/processors/ship-tree-groups'
import { identifiers as g, type Identifier as GroupIdentifier } from '../../data/identifiers/shipTreeGroups'
import { identifiers as f, type Identifier as ShipTreeFactionId } from '../../data/identifiers/shipTreeFactions'
import { angelLayout } from '../../layouts/angelcartel'
import { empireLayout } from '../../layouts/empires'
import { FactionNode, Node, Root } from '../../layouts/layoutsystem'
import { oreLayout } from '../../layouts/ore'
import { soeLayout } from '../../layouts/soe'
import { computeShipIconsExtentFromGroupCenter } from './ship-group/compute-ship-group-layout'
import { buildSegmentMap, resolveFactionTravelSegmentStatus, resolveLineSegmentStatus } from './segment-map'
import { collectLayout, type LayoutSegment } from './render-layout'
import { computeSkillBarsExtentFromGroupCenter } from './layout-constants'

const emptyShipSizeByTypeId: Record<number, number> = {}

const makeFactionInfo = (
  status: GroupStatus,
  mastered: boolean,
  omegaRestricted = false,
  displaySkills: Record<number, number> = {},
) => ({
  shipTypes: [1],
  status,
  mastered,
  omegaRestricted,
  displaySkills,
  otherSkills: {},
  currentSkills: {},
  currentMinimumLevel: 0 as const,
  currentMaximumLevel: 0 as const,
})

const makeShipTreeGroups = (
  shipCounts: Partial<Record<GroupIdentifier, number>>,
  factionOverrides: Partial<
    Record<GroupIdentifier, Partial<Record<ShipTreeFactionId, ReturnType<typeof makeFactionInfo>>>>
  > = {},
): Record<GroupIdentifier, ShipTreeGroup> => {
  const groups = {} as unknown as Record<GroupIdentifier, ShipTreeGroup>

  const allGroupIds = new Set<GroupIdentifier>([
    ...(Object.keys(shipCounts) as unknown as GroupIdentifier[]),
    ...(Object.keys(factionOverrides) as unknown as GroupIdentifier[]),
  ])

  for (const groupId of allGroupIds) {
    const shipCount = shipCounts[groupId] ?? 0
    const overrides = factionOverrides[groupId] ?? {}
    const defaultFaction = makeFactionInfo('unlocked', false)

    groups[groupId] = {
      elements: [],
      factions: {
        [f.amarrEmpire]: overrides[f.amarrEmpire] ?? {
          ...defaultFaction,
          shipTypes: Array.from({ length: shipCount }, (_, index) => index + 1),
        },
        ...Object.fromEntries(Object.entries(overrides).filter(([factionId]) => Number(factionId) !== f.amarrEmpire)),
      } as ShipTreeGroup['factions'],
    }
  }

  return groups
}

describe('buildSegmentMap horizontal from-group inset', () => {
  it('starts rightward horizontal segments after ship icons including padding', () => {
    const segment: LayoutSegment = {
      x1: 0,
      y1: 10,
      x2: 30,
      y2: 10,
      fromGroupId: g.frigate,
      toGroupId: g.interceptor,
      multiSegment: true,
      startsAtGroupNode: true,
    }
    const shipTreeGroups = makeShipTreeGroups({ [g.frigate]: 3 })
    const extent = computeShipIconsExtentFromGroupCenter(3, 80)

    const { linePaths } = buildSegmentMap([segment], [], shipTreeGroups, f.amarrEmpire, emptyShipSizeByTypeId)

    expect(linePaths[0]).toMatchObject({
      points: [
        { x: extent + 2, y: 240 },
        { x: 720, y: 240 },
      ],
    })
  })

  it('scales inset with actual ship count', () => {
    expect(computeShipIconsExtentFromGroupCenter(1)).toBe(124)
    expect(computeShipIconsExtentFromGroupCenter(2)).toBe(221)
    expect(computeShipIconsExtentFromGroupCenter(3)).toBe(318)

    const segment: LayoutSegment = {
      x1: 0,
      y1: 0,
      x2: 30,
      y2: 0,
      fromGroupId: g.destroyer,
      toGroupId: g.cruiser,
      multiSegment: false,
      startsAtGroupNode: true,
    }

    const twoShipGroups = makeShipTreeGroups({ [g.destroyer]: 2 })
    const threeShipGroups = makeShipTreeGroups({ [g.destroyer]: 3 })

    const twoShipLine = buildSegmentMap([segment], [], twoShipGroups, f.amarrEmpire, emptyShipSizeByTypeId)
      .linePaths[0]!
    const threeShipLine = buildSegmentMap([segment], [], threeShipGroups, f.amarrEmpire, emptyShipSizeByTypeId)
      .linePaths[0]!

    expect(threeShipLine.points[0]!.x - twoShipLine.points[0]!.x).toBe(
      computeShipIconsExtentFromGroupCenter(3, 80) - computeShipIconsExtentFromGroupCenter(2, 80),
    )
  })

  it('does not inset junction segments that only inherit fromGroupId', () => {
    const segment: LayoutSegment = {
      x1: 7,
      y1: 9,
      x2: 13,
      y2: 9,
      fromGroupId: g.shuttle,
      toGroupId: g.shuttle,
      multiSegment: true,
      startsAtGroupNode: false,
    }
    const shipTreeGroups = makeShipTreeGroups({ [g.shuttle]: 2 })

    const { linePaths } = buildSegmentMap([segment], [], shipTreeGroups, f.amarrEmpire, emptyShipSizeByTypeId)

    expect(linePaths[0]).toMatchObject({
      points: [
        { x: 168, y: 216 },
        { x: 312, y: 216 },
      ],
    })
  })

  it('does not overshoot the segment end when inset stays within length', () => {
    const segment: LayoutSegment = {
      x1: 6,
      y1: 0,
      x2: 16,
      y2: 0,
      fromGroupId: g.corvette,
      toGroupId: g.frigate,
      multiSegment: true,
      startsAtGroupNode: true,
    }
    const shipTreeGroups = makeShipTreeGroups({ [g.corvette]: 1 })
    const extent = computeShipIconsExtentFromGroupCenter(1, 80)

    const { linePaths } = buildSegmentMap([segment], [], shipTreeGroups, f.amarrEmpire, emptyShipSizeByTypeId)

    expect(linePaths[0]).toMatchObject({
      points: [
        { x: 144 + extent + 2, y: 0 },
        { x: 384, y: 0 },
      ],
    })
  })

  it('centers omega transitions on the inset line segment', () => {
    const segment: LayoutSegment = {
      x1: 0,
      y1: 0,
      x2: 30,
      y2: 0,
      fromGroupId: g.frigate,
      toGroupId: g.interceptor,
      multiSegment: true,
      startsAtGroupNode: true,
    }
    const shipTreeGroups = {
      [g.frigate]: {
        elements: [],
        factions: {
          [f.amarrEmpire]: {
            shipTypes: [1],
            status: 'unlocked' as const,
            omegaRestricted: false,
            displaySkills: {},
            otherSkills: {},
            currentSkills: {},
            currentMinimumLevel: 0,
            currentMaximumLevel: 0,
            mastered: false,
          },
        } as ShipTreeGroup['factions'],
      },
      [g.interceptor]: {
        elements: [],
        factions: {
          [f.amarrEmpire]: {
            shipTypes: [1],
            status: 'unlocked' as const,
            omegaRestricted: true,
            displaySkills: {},
            otherSkills: {},
            currentSkills: {},
            currentMinimumLevel: 0,
            currentMaximumLevel: 0,
            mastered: false,
          },
        } as ShipTreeGroup['factions'],
      },
    } as unknown as Record<GroupIdentifier, ShipTreeGroup>

    const { linePaths, omegaTransitions } = buildSegmentMap(
      [segment],
      [],
      shipTreeGroups,
      f.amarrEmpire,
      emptyShipSizeByTypeId,
    )

    const path = linePaths[0]!
    const start = path.points[0]!
    const end = path.points[path.points.length - 1]!

    expect(omegaTransitions[0]).toEqual({
      x: (start.x + end.x) / 2,
      y: (start.y + end.y) / 2,
    })
  })

  it('marks empire shuttle approach segments as not starting at a group node', () => {
    const { segments } = collectLayout(empireLayout())

    const shuttleApproach = segments.find(
      (segment) => segment.x1 === 7 && segment.y1 === 13 && segment.x2 === 13 && segment.y2 === 13,
    )

    expect(shuttleApproach).toMatchObject({
      fromGroupId: g.shuttle,
      startsAtGroupNode: false,
    })
  })

  it('marks empire shuttle departure segments as starting at a group node', () => {
    const { segments } = collectLayout(empireLayout())

    const shuttleDeparture = segments.find(
      (segment) => segment.x1 === 13 && segment.y1 === 13 && segment.x2 === 75 && segment.y2 === 13,
    )

    expect(shuttleDeparture).toMatchObject({
      fromGroupId: g.shuttle,
      startsAtGroupNode: true,
    })
  })
})

describe('buildSegmentMap vertical from-group inset', () => {
  it('starts downward vertical segments after skill bars including padding', () => {
    const segment: LayoutSegment = {
      x1: 6,
      y1: 0,
      x2: 6,
      y2: 12,
      fromGroupId: g.corvette,
      toGroupId: g.shuttle,
      multiSegment: true,
      startsAtGroupNode: true,
    }
    const shipTreeGroups = makeShipTreeGroups(
      { [g.corvette]: 1 },
      {
        [g.corvette]: {
          [f.amarrEmpire]: makeFactionInfo('unlocked', false, false, { 3330: 1, 3328: 1 }),
        },
      },
    )
    const extent = computeSkillBarsExtentFromGroupCenter(2)

    const { linePaths } = buildSegmentMap([segment], [], shipTreeGroups, f.amarrEmpire, emptyShipSizeByTypeId)

    expect(linePaths[0]).toMatchObject({
      points: [
        { x: 144, y: extent + 1 },
        { x: 144, y: 288 },
      ],
    })
  })

  it('uses only the group box inset for locked groups in strict mode', () => {
    const segment: LayoutSegment = {
      x1: 6,
      y1: 0,
      x2: 6,
      y2: 12,
      fromGroupId: g.corvette,
      toGroupId: g.shuttle,
      multiSegment: true,
      startsAtGroupNode: true,
    }
    const shipTreeGroups = makeShipTreeGroups(
      { [g.corvette]: 1 },
      {
        [g.corvette]: {
          [f.amarrEmpire]: makeFactionInfo('locked', false, false, { 3330: 1, 3328: 1 }),
        },
      },
    )
    const extent = computeSkillBarsExtentFromGroupCenter(0)

    const { linePaths } = buildSegmentMap([segment], [], shipTreeGroups, f.amarrEmpire, emptyShipSizeByTypeId, true)

    expect(linePaths[0]).toMatchObject({
      points: [
        { x: 144, y: extent + 1 },
        { x: 144, y: 288 },
      ],
    })
  })

  it('does not inset junction segments that only inherit fromGroupId', () => {
    const segment: LayoutSegment = {
      x1: 7,
      y1: 9,
      x2: 7,
      y2: 15,
      fromGroupId: g.shuttle,
      toGroupId: g.shuttle,
      multiSegment: true,
      startsAtGroupNode: false,
    }
    const shipTreeGroups = makeShipTreeGroups(
      { [g.shuttle]: 1 },
      {
        [g.shuttle]: {
          [f.amarrEmpire]: makeFactionInfo('unlocked', false, false, { 3330: 1 }),
        },
      },
    )

    const { linePaths } = buildSegmentMap([segment], [], shipTreeGroups, f.amarrEmpire, emptyShipSizeByTypeId)

    expect(linePaths[0]).toMatchObject({
      points: [
        { x: 168, y: 216 },
        { x: 168, y: 360 },
      ],
    })
  })
})

describe('resolveLineSegmentStatus', () => {
  const segment: LayoutSegment = {
    x1: 0,
    y1: 0,
    x2: 1,
    y2: 0,
    fromGroupId: g.frigate,
    toGroupId: g.interceptor,
    multiSegment: true,
    startsAtGroupNode: true,
  }

  const childGroupsByGroup = new Map<GroupIdentifier, GroupIdentifier[][]>([
    [g.frigate, [[g.navyFrigate, g.interceptor], [g.cruiser]]],
  ])

  it('keeps locked lines locked regardless of branch mastery', () => {
    const shipTreeGroups = {
      [g.navyFrigate]: {
        factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
      },
      [g.interceptor]: {
        factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
      },
    } as unknown as Record<GroupIdentifier, ShipTreeGroup>

    expect(resolveLineSegmentStatus(segment, 'locked', childGroupsByGroup, shipTreeGroups, f.amarrEmpire)).toBe(
      'locked',
    )
  })

  it('promotes unlocked lines to mastered when every group in the branch is mastered', () => {
    const shipTreeGroups = {
      [g.navyFrigate]: {
        factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
      },
      [g.interceptor]: {
        factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
      },
    } as unknown as Record<GroupIdentifier, ShipTreeGroup>

    expect(resolveLineSegmentStatus(segment, 'unlocked', childGroupsByGroup, shipTreeGroups, f.amarrEmpire)).toBe(
      'mastered',
    )
  })

  it('stays unlocked when any group in the branch is not mastered', () => {
    const shipTreeGroups = {
      [g.navyFrigate]: {
        factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
      },
      [g.interceptor]: {
        factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', false) },
      },
    } as unknown as Record<GroupIdentifier, ShipTreeGroup>

    expect(resolveLineSegmentStatus(segment, 'unlocked', childGroupsByGroup, shipTreeGroups, f.amarrEmpire)).toBe(
      'unlocked',
    )
  })

  it('uses collectLayout childGroups when building segment map output', () => {
    const root = Root()
    const frigate = Node(0, -7, root, g.frigate)
    const navyFrigate = Node(0, -6, frigate, g.navyFrigate)
    const junction = Node(0, -6, navyFrigate)
    Node(6, -6, junction, g.interceptor)

    const { segments, nodes } = collectLayout(root)
    const segmentFromFrigate = segments.find(
      (entry) => entry.fromGroupId === g.frigate && entry.toGroupId === g.navyFrigate,
    )
    const segmentToInterceptor = segments.find(
      (entry) => entry.fromGroupId === g.interceptor && entry.toGroupId === g.interceptor,
    )

    expect(segmentFromFrigate).toBeDefined()
    expect(segmentToInterceptor).toBeDefined()

    const shipTreeGroups = {
      [g.navyFrigate]: {
        factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
      },
      [g.interceptor]: {
        factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
      },
    } as unknown as Record<GroupIdentifier, ShipTreeGroup>

    const { linePaths: frigateLine } = buildSegmentMap(
      [segmentFromFrigate!],
      nodes,
      shipTreeGroups,
      f.amarrEmpire,
      emptyShipSizeByTypeId,
    )
    const { linePaths: interceptorLine } = buildSegmentMap(
      [segmentToInterceptor!],
      nodes,
      shipTreeGroups,
      f.amarrEmpire,
      emptyShipSizeByTypeId,
    )

    expect(frigateLine[0]?.status).toBe('mastered')
    expect(interceptorLine[0]?.status).toBe('mastered')
  })

  it('keeps junction leaf lines unlocked when siblings in the branch are not mastered', () => {
    const root = Root()
    const cruiser = Node(0, -7, root, g.cruiser)
    const navyCruiser = Node(0, -6, cruiser, g.navyCruiser)
    let n = Node(0, -6, navyCruiser)
    Node(6, -6, n, g.reconShip)
    n = Node(0, -6, n)
    Node(6, -6, n, g.heavyAssaultCruiser)

    const { segments, nodes } = collectLayout(root)
    const segmentToRecon = segments.find(
      (entry) => entry.fromGroupId === g.reconShip && entry.toGroupId === g.reconShip,
    )

    expect(segmentToRecon).toBeDefined()

    const shipTreeGroups = {
      [g.reconShip]: {
        factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
      },
      [g.heavyAssaultCruiser]: {
        factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', false) },
      },
    } as unknown as Record<GroupIdentifier, ShipTreeGroup>

    const { linePaths } = buildSegmentMap(
      [segmentToRecon!],
      nodes,
      shipTreeGroups,
      f.amarrEmpire,
      emptyShipSizeByTypeId,
    )

    expect(linePaths[0]?.status).toBe('unlocked')
  })

  it('promotes junction segments when every group in the sibling branch is mastered', () => {
    const junctionSegment: LayoutSegment = {
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      fromGroupId: g.interceptor,
      toGroupId: g.interceptor,
      multiSegment: true,
      startsAtGroupNode: true,
    }

    expect(
      resolveLineSegmentStatus(
        junctionSegment,
        'unlocked',
        new Map([[g.navyFrigate, [[g.interceptor, g.assaultFrigate, g.covertOps]]]]),
        {
          [g.interceptor]: {
            factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
          },
          [g.assaultFrigate]: {
            factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
          },
          [g.covertOps]: {
            factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
          },
        } as unknown as Record<GroupIdentifier, ShipTreeGroup>,
        f.amarrEmpire,
      ),
    ).toBe('mastered')
  })

  it('promotes capsule approach segments with no from group', () => {
    const approachSegment: LayoutSegment = {
      x1: 0,
      y1: 0,
      x2: 1,
      y2: 0,
      toGroupId: g.shuttle,
      multiSegment: true,
      startsAtGroupNode: false,
    }

    const childGroupsByGroup = new Map<GroupIdentifier, GroupIdentifier[][]>([[g.corvette, [[g.shuttle]]]])

    expect(
      resolveLineSegmentStatus(
        approachSegment,
        'unlocked',
        childGroupsByGroup,
        {
          [g.shuttle]: {
            factions: { [f.amarrEmpire]: makeFactionInfo('unlocked', true) },
          },
        } as unknown as Record<GroupIdentifier, ShipTreeGroup>,
        f.amarrEmpire,
      ),
    ).toBe('mastered')
  })
})

describe('resolveFactionTravelSegmentStatus', () => {
  const shipTreeGroups = makeShipTreeGroups(
    {},
    {
      [g.frigate]: {
        [f.gallenteFederation]: makeFactionInfo('locked', false),
        [f.angelCartel]: makeFactionInfo('unlocked', false),
      },
    },
  )

  it('returns locked when the target faction group is locked', () => {
    expect(resolveFactionTravelSegmentStatus(g.frigate, f.gallenteFederation, shipTreeGroups)).toBe('locked')
  })

  it('returns unlocked when the target faction group is unlocked but not mastered', () => {
    expect(resolveFactionTravelSegmentStatus(g.frigate, f.angelCartel, shipTreeGroups)).toBe('unlocked')
  })

  it('returns mastered when the target faction group is unlocked and mastered', () => {
    const masteredGroups = makeShipTreeGroups(
      {},
      {
        [g.frigate]: {
          [f.gallenteFederation]: makeFactionInfo('unlocked', true),
        },
      },
    )

    expect(resolveFactionTravelSegmentStatus(g.frigate, f.gallenteFederation, masteredGroups)).toBe('mastered')
  })

  it('returns locked when the target faction entry is missing', () => {
    expect(resolveFactionTravelSegmentStatus(g.frigate, f.minmatarRepublic, shipTreeGroups)).toBe('locked')
  })
})

describe('buildSegmentMap faction travel', () => {
  const factionSegment: LayoutSegment = {
    x1: 6,
    y1: 0,
    x2: 6,
    y2: -6,
    fromGroupId: g.frigate,
    toFactionId: f.gallenteFederation,
    multiSegment: true,
    startsAtGroupNode: true,
  }

  it('resolves status from the source group in the target faction context', () => {
    const shipTreeGroups = makeShipTreeGroups(
      { [g.frigate]: 2 },
      {
        [g.frigate]: {
          [f.angelCartel]: makeFactionInfo('unlocked', false),
          [f.gallenteFederation]: makeFactionInfo('unlocked', true),
        },
      },
    )

    const { linePaths } = buildSegmentMap([factionSegment], [], shipTreeGroups, f.angelCartel, emptyShipSizeByTypeId)

    expect(linePaths[0]).toMatchObject({
      status: 'mastered',
      fade: 'out',
    })
  })

  it('resolves end-to-end from angel layout faction segments', () => {
    const { segments } = collectLayout(angelLayout())
    const factionSegmentFromLayout = segments.find(
      (segment) => segment.fromGroupId === g.frigate && segment.toFactionId === f.gallenteFederation,
    )

    expect(factionSegmentFromLayout).toBeDefined()

    const shipTreeGroups = makeShipTreeGroups(
      { [g.frigate]: 1 },
      {
        [g.frigate]: {
          [f.angelCartel]: makeFactionInfo('unlocked', false),
          [f.gallenteFederation]: makeFactionInfo('unlocked', false),
        },
      },
    )

    const { linePaths } = buildSegmentMap(
      [factionSegmentFromLayout!],
      [],
      shipTreeGroups,
      f.angelCartel,
      emptyShipSizeByTypeId,
    )

    expect(linePaths[0]?.status).toBe('unlocked')
  })
})

describe('buildSegmentMap capsule approach fade', () => {
  it('fades in the root segment to the first group node', () => {
    const root = Root()
    Node(6, 0, root, g.frigate)
    FactionNode(0, -6, root.links[0]!, f.gallenteFederation)

    const { segments, nodes } = collectLayout(root)
    const rootSegment = segments.find((segment) => segment.x1 === 0 && segment.y1 === 0)

    expect(rootSegment).toBeDefined()

    const { linePaths } = buildSegmentMap(
      [rootSegment!],
      nodes,
      makeShipTreeGroups({ [g.frigate]: 1 }),
      f.angelCartel,
      emptyShipSizeByTypeId,
    )

    expect(linePaths[0]?.fade).toBe('in')
  })
})

describe('buildSegmentMap ore root junction', () => {
  it('does not trim the root t-junction when all branches share status', () => {
    const { segments } = collectLayout(oreLayout())
    const { linePaths } = buildSegmentMap(
      segments,
      [],
      makeShipTreeGroups({
        [g.miningFrigate]: 1,
        [g.oreHauler]: 1,
      }),
      f.ore,
      emptyShipSizeByTypeId,
    )

    const junction = { x: 144, y: 0 }

    const approach = linePaths.find((path) => path.fade === 'in')
    const toMiningFrigate = linePaths.find(
      (path) =>
        path.points[0]?.x === junction.x &&
        path.points[0]?.y === junction.y &&
        path.points[1]?.x === 288 &&
        path.points[1]?.y === 0,
    )
    const toOreBranch = linePaths.find(
      (path) =>
        path.points[0]?.x === junction.x &&
        path.points[0]?.y === junction.y &&
        path.points[1]?.x === junction.x &&
        path.points[1]?.y === 288,
    )

    expect(approach?.points.at(-1)).toEqual(junction)
    expect(toMiningFrigate?.points[0]).toEqual(junction)
    expect(toOreBranch?.points[0]).toEqual(junction)
  })
})

describe('buildSegmentMap soe root junction', () => {
  it('only trims the locked branch at a mixed-status root t-junction', () => {
    const { segments, nodes } = collectLayout(soeLayout())
    const { linePaths } = buildSegmentMap(
      segments,
      nodes,
      makeShipTreeGroups(
        {
          [g.frigate]: 1,
          [g.expeditionCommandShip]: 1,
        },
        {
          [g.frigate]: {
            [f.servantSistersOfEve]: makeFactionInfo('unlocked', false),
          },
          [g.expeditionCommandShip]: {
            [f.servantSistersOfEve]: makeFactionInfo('locked', false),
          },
        },
      ),
      f.servantSistersOfEve,
      emptyShipSizeByTypeId,
    )

    const junction = { x: 72, y: 0 }

    const approach = linePaths.find((path) => path.fade === 'in')
    const toFrigate = linePaths.find(
      (path) =>
        path.status === 'unlocked' &&
        path.fade === undefined &&
        path.points[0]?.x === junction.x &&
        path.points[0]?.y === junction.y,
    )
    const toExpedition = linePaths.find(
      (path) =>
        path.status === 'locked' &&
        path.fade === undefined &&
        path.points[0]?.x === junction.x &&
        path.points[0]?.y === 5,
    )

    expect(approach?.points.at(-1)).toEqual(junction)
    expect(toFrigate?.points[0]).toEqual(junction)
    expect(toExpedition?.points[0]).toEqual({ x: junction.x, y: 5 })
  })
})
