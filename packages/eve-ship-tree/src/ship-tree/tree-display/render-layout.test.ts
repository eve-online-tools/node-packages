import { describe, expect, it } from 'vitest'

import { identifiers as g } from '../../data/identifiers/shipTreeGroups'
import { identifiers as f } from '../../data/identifiers/shipTreeFactions'
import { empireLayout } from '../../layouts/empires'
import {
  calculateLayoutSize,
  FactionNode,
  Node,
  Root,
  type NodeEntry,
  type RootEntry,
} from '../../layouts/layoutsystem'
import { collectLayout, computeParentGroups, computeViewBox, gridToPixel } from './render-layout'
import {
  computeGroupVisualBounds,
  computeShipGroupLayout,
  resolveGroupShipLayout,
} from './ship-group/compute-ship-group-layout'
import { paddingCells, cellSize } from './layout-constants'
import type { ShipTreeGroup } from '../../data-provider/processors/ship-tree-groups'

const buildFrigateBranchLayout = () => {
  const root = Root()
  const frigate = Node(0, -7, root, g.frigate)
  const navyFrigate = Node(0, -6, frigate, g.navyFrigate)
  const junction = Node(0, -6, navyFrigate)
  Node(6, -6, junction, g.interceptor)

  return { root, frigate, navyFrigate, junction }
}

describe('computeParentGroups', () => {
  it('assigns a leaf group node its own group', () => {
    const { root, junction } = buildFrigateBranchLayout()

    const parentGroups = computeParentGroups(root)

    const interceptor = junction.links[0]
    expect(parentGroups.get(interceptor)).toBe(g.interceptor)
  })

  it('assigns junction nodes a propagated parentGroup', () => {
    const { root, junction } = buildFrigateBranchLayout()

    const parentGroups = computeParentGroups(root)

    expect(parentGroups.get(junction)).toBe(g.interceptor)
  })

  it('assigns group nodes their own group, not a distant leaf group', () => {
    const root = Root()
    const frigate = Node(0, -7, root, g.frigate)
    const destroyer = Node(18, 0, frigate, g.destroyer)
    const navyDestroyer = Node(0, -6, destroyer, g.navyDestroyer)
    const junction = Node(0, -6, navyDestroyer)
    Node(6, -6, junction, g.interdictor)
    const cruiser = Node(18, 0, destroyer, g.cruiser)
    const navyCruiser = Node(0, -6, cruiser, g.navyCruiser)
    const cruiserJunction = Node(0, -6, navyCruiser)
    Node(6, -6, cruiserJunction, g.reconShip)

    const parentGroups = computeParentGroups(root)

    expect(parentGroups.get(destroyer)).toBe(g.destroyer)
    expect(parentGroups.get(frigate)).toBe(g.frigate)
  })

  it('does not let a later sibling branch overwrite an ancestor group', () => {
    const root = Root()
    const frigate = Node(0, -7, root, g.frigate)
    const navyFrigate = Node(0, -6, frigate, g.navyFrigate)
    const junction = Node(0, -6, navyFrigate)
    Node(6, -6, junction, g.interceptor)
    const lowerJunction = Node(0, -6, junction)
    Node(6, -6, lowerJunction, g.assaultFrigate)

    const parentGroups = computeParentGroups(root)

    expect(parentGroups.get(navyFrigate)).toBe(g.navyFrigate)
    expect(parentGroups.get(junction)).toBe(g.interceptor)
    expect(parentGroups.get(lowerJunction)).toBe(g.assaultFrigate)
  })

  it('propagates parent groups from faction leaves when no group leaves exist', () => {
    const root = Root()
    const frigate = Node(0, 0, root, g.frigate)
    FactionNode(0, -6, frigate, f.gallenteFederation)

    const parentGroups = computeParentGroups(root)

    expect(parentGroups.get(frigate)).toBe(g.frigate)
  })
})

const collectAllNodes = (root: RootEntry): NodeEntry[] => {
  const nodes: NodeEntry[] = []

  const visit = (entry: RootEntry): void => {
    for (const link of entry.links) {
      nodes.push(link)
      visit(link)
    }
  }

  visit(root)

  return nodes
}

describe('collectLayout immutability', () => {
  it('does not mutate the input layout graph', () => {
    const layout = empireLayout()
    const parentGroupsBefore = collectAllNodes(layout).map((node) => node.parentGroup)

    collectLayout(layout)
    collectLayout(layout)

    const parentGroupsAfter = collectAllNodes(layout).map((node) => node.parentGroup)

    expect(parentGroupsAfter).toEqual(parentGroupsBefore)
  })
})

describe('collectLayout segment groups', () => {
  it('attaches source and target group ids from layout nodes', () => {
    const { root } = buildFrigateBranchLayout()
    const { segments } = collectLayout(root)

    const segmentToInterceptor = segments.find((segment) => segment.x2 === 6 && segment.y2 === -25)
    const segmentToJunction = segments.find((segment) => segment.x2 === 0 && segment.y2 === -19)
    const segmentToNavyFrigate = segments.find((segment) => segment.x2 === 0 && segment.y2 === -13)

    expect(segmentToNavyFrigate?.fromGroupId).toBe(g.frigate)
    expect(segmentToNavyFrigate?.toGroupId).toBe(g.navyFrigate)
    expect(segmentToNavyFrigate?.multiSegment).toBe(false)
    expect(segmentToJunction?.fromGroupId).toBe(g.navyFrigate)
    expect(segmentToJunction?.toGroupId).toBe(g.interceptor)
    expect(segmentToJunction?.multiSegment).toBe(true)
    expect(segmentToInterceptor?.fromGroupId).toBe(g.interceptor)
    expect(segmentToInterceptor?.toGroupId).toBe(g.interceptor)
    expect(segmentToInterceptor?.multiSegment).toBe(true)
  })
})

describe('collectLayout faction nodes', () => {
  it('collects faction nodes and travel segments from the layout graph', () => {
    const root = Root()
    const frigate = Node(0, 0, root, g.frigate)
    FactionNode(0, -6, frigate, f.gallenteFederation)

    const { nodes, segments } = collectLayout(root)
    const factionNode = nodes.find((node) => node.faction === f.gallenteFederation)

    expect(factionNode).toEqual({
      x: 0,
      y: -6,
      faction: f.gallenteFederation,
    })
    expect(factionNode?.group).toBeUndefined()

    const factionSegment = segments.find((segment) => segment.toFactionId === f.gallenteFederation)

    expect(factionSegment).toMatchObject({
      fromGroupId: g.frigate,
      toFactionId: f.gallenteFederation,
      toGroupId: undefined,
    })
  })

  it('assigns toGroupId on the root segment when faction leaves are the only leaves', () => {
    const root = Root()
    Node(6, 0, root, g.frigate)
    FactionNode(0, -6, root.links[0]!, f.gallenteFederation)

    const { segments } = collectLayout(root)
    const rootSegment = segments.find((segment) => segment.x1 === 0 && segment.y1 === 0)

    expect(rootSegment).toMatchObject({
      fromGroupId: undefined,
      toGroupId: g.frigate,
    })
  })
})

describe('collectLayout child groups', () => {
  it('tracks descendant groups per outbound connection', () => {
    const root = Root()
    const a = Node(0, 0, root, g.frigate)
    const node1 = Node(0, -1, a)
    const node2 = Node(10, 0, a)
    Node(0, -1, node1, g.cruiser)
    const node4 = Node(10, 0, node1, g.destroyer)
    Node(0, -1, node4, g.battlecruiser)
    Node(0, -1, node2, g.interceptor)

    const { nodes } = collectLayout(root)
    const groupA = nodes.find((node) => node.group === g.frigate)

    expect(groupA?.childGroups).toEqual([[g.cruiser, g.destroyer, g.battlecruiser], [g.interceptor]])
  })

  it('collects branched descendant groups within a single outbound connection', () => {
    const root = Root()
    const a = Node(0, 0, root, g.frigate)
    const node1 = Node(0, -1, a)
    Node(0, -1, node1, g.navyFrigate)
    Node(10, 0, node1, g.interceptor)

    const { nodes } = collectLayout(root)
    const groupA = nodes.find((node) => node.group === g.frigate)

    expect(groupA?.childGroups).toEqual([[g.navyFrigate, g.interceptor]])
  })

  it('uses an empty array for outbound connections with no descendant groups', () => {
    const root = Root()
    const a = Node(0, 0, root, g.frigate)
    Node(0, -1, a)

    const { nodes } = collectLayout(root)
    const groupA = nodes.find((node) => node.group === g.frigate)

    expect(groupA?.childGroups).toEqual([[]])
  })

  it('uses an empty childGroups array for group nodes with no outbound links', () => {
    const root = Root()
    Node(0, 0, root, g.frigate)

    const { nodes } = collectLayout(root)
    const groupA = nodes.find((node) => node.group === g.frigate)

    expect(groupA?.childGroups).toEqual([])
  })
})

describe('calculateLayoutSize', () => {
  it('matches collectLayout segment bounds for empire layout', () => {
    const layout = empireLayout()
    const { segments } = collectLayout(layout)
    const bounds = calculateLayoutSize(layout)

    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity

    for (const { x1, y1, x2, y2 } of segments) {
      minX = Math.min(minX, x1, x2)
      minY = Math.min(minY, y1, y2)
      maxX = Math.max(maxX, x1, x2)
      maxY = Math.max(maxY, y1, y2)
    }

    expect(bounds).toEqual({ minX, minY, maxX, maxY })
  })
})

describe('computeViewBox', () => {
  const emptyShipSizeByTypeId: Record<number, number> = {}

  const makeShipTreeGroups = (shipCounts: Partial<Record<number, number>>): Record<number, ShipTreeGroup> => {
    const groups = {} as Record<number, ShipTreeGroup>

    for (const [groupId, shipCount] of Object.entries(shipCounts)) {
      if (shipCount === undefined) {
        continue
      }

      groups[Number(groupId)] = {
        elements: [],
        factions: {
          [f.amarrEmpire]: {
            shipTypes: Array.from({ length: shipCount }, (_, index) => index + 1),
            status: 'unlocked',
            mastered: false,
            omegaRestricted: false,
            displaySkills: {},
            otherSkills: {},
            currentSkills: {},
            currentMinimumLevel: 0,
            currentMaximumLevel: 0,
          },
        },
      } as unknown as ShipTreeGroup
    }

    return groups
  }

  it('fits tighter around sparse groups than the old max-ship-area padding', () => {
    const nodes = [{ x: 6, y: 0, group: g.frigate }]
    const shipTreeGroups = makeShipTreeGroups({ [g.frigate]: 1 })
    const viewBox = computeViewBox(nodes, shipTreeGroups, f.amarrEmpire, emptyShipSizeByTypeId)

    const groupNodeX = gridToPixel(6)
    const groupNodeY = gridToPixel(0)
    const { shipCount, shipNodeSize } = resolveGroupShipLayout(
      shipTreeGroups[g.frigate]!.factions[f.amarrEmpire]!.shipTypes,
      emptyShipSizeByTypeId,
    )
    const layout = computeShipGroupLayout({ groupNodeX, groupNodeY, shipCount, shipNodeSize })
    const groupBounds = computeGroupVisualBounds(layout, shipCount, groupNodeX, groupNodeY)
    const padding = paddingCells * cellSize

    expect(viewBox.x + viewBox.width).toBe(groupBounds.maxX + padding)
    expect(viewBox.width).toBeLessThan(500)
    expect(viewBox.x).toBeLessThanOrEqual(groupBounds.minX - padding)
  })

  it('includes all rendered group content for empire layout', () => {
    const { nodes } = collectLayout(empireLayout())
    const shipTreeGroups = makeShipTreeGroups(
      Object.fromEntries(nodes.filter((node) => node.group !== undefined).map((node) => [node.group!, 3])),
    )
    const viewBox = computeViewBox(nodes, shipTreeGroups, f.amarrEmpire, emptyShipSizeByTypeId)
    const padding = paddingCells * cellSize

    for (const node of nodes) {
      if (node.group === undefined) {
        continue
      }

      const groupNodeX = gridToPixel(node.x)
      const groupNodeY = gridToPixel(node.y)
      const shipTypes = shipTreeGroups[node.group]?.factions[f.amarrEmpire]?.shipTypes ?? []
      const { shipCount, shipNodeSize } = resolveGroupShipLayout(shipTypes, emptyShipSizeByTypeId)
      const layout = computeShipGroupLayout({ groupNodeX, groupNodeY, shipCount, shipNodeSize })
      const bounds = computeGroupVisualBounds(layout, shipCount, groupNodeX, groupNodeY)

      expect(viewBox.x).toBeLessThanOrEqual(bounds.minX - padding)
      expect(viewBox.y).toBeLessThanOrEqual(bounds.minY - padding)
      expect(viewBox.x + viewBox.width).toBeGreaterThanOrEqual(bounds.maxX + padding)
      expect(viewBox.y + viewBox.height).toBeGreaterThanOrEqual(bounds.maxY + padding)
    }
  })
})
