import { Identifier as GroupIdentifier } from '../../data/identifiers/shipTreeGroups'
import type { Identifier as FactionIdentifier } from '../../data/identifiers/shipTreeFactions'
import type { ShipTreeGroup } from '../../data-provider/processors/ship-tree-groups'
import { type NodeEntry, type RootEntry } from '../../layouts'
import { cellSize, groupBoxHeight, groupBoxWidth, groupIconLargeSize, paddingCells } from './layout-constants'
import {
  computeGroupVisualBounds,
  computeShipGroupLayout,
  resolveGroupShipLayout,
  type PixelBounds,
} from './ship-group/compute-ship-group-layout'

export type GridPoint = {
  x: number
  y: number
}

export type LayoutSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
  fromGroupId?: GroupIdentifier
  toGroupId?: GroupIdentifier
  toFactionId?: FactionIdentifier
  multiSegment: boolean
  startsAtGroupNode: boolean
}

export type LayoutNode = GridPoint & {
  group?: GroupIdentifier
  faction?: FactionIdentifier
  childGroups?: GroupIdentifier[][]
}

export type LayoutViewBox = {
  x: number
  y: number
  width: number
  height: number
}

export const gridToPixel = (value: number): number => value * cellSize

const isNodeEntry = (entry: RootEntry | NodeEntry): entry is NodeEntry => 'parent' in entry

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

export const computeParentGroups = (root: RootEntry): Map<NodeEntry, GroupIdentifier> => {
  const parentGroups = new Map<NodeEntry, GroupIdentifier>()
  const allNodes = collectAllNodes(root)
  const leaves = allNodes.filter((node) => node.links.length === 0)

  for (const leaf of leaves) {
    let currentGroup: GroupIdentifier | undefined = leaf.group
    let node: NodeEntry = leaf

    while (true) {
      if (node.group !== undefined) {
        currentGroup = node.group
      }

      if (currentGroup !== undefined && !parentGroups.has(node)) {
        parentGroups.set(node, currentGroup)
      }

      if (!isNodeEntry(node.parent)) {
        break
      }

      node = node.parent
    }
  }

  return parentGroups
}

const resolveNodeGroup = (
  entry: RootEntry | NodeEntry,
  parentGroups: Map<NodeEntry, GroupIdentifier>,
): GroupIdentifier | undefined => {
  if (!isNodeEntry(entry)) {
    return undefined
  }

  return entry.group ?? parentGroups.get(entry)
}

const isDirectGroupLink = (entry: RootEntry | NodeEntry, link: NodeEntry): boolean =>
  isNodeEntry(entry) && entry.group !== undefined && link.group !== undefined

const collectDescendantGroups = (entry: NodeEntry): GroupIdentifier[] => {
  const groups: GroupIdentifier[] = []

  if (entry.group !== undefined) {
    groups.push(entry.group)
  }

  for (const link of entry.links) {
    groups.push(...collectDescendantGroups(link))
  }

  return groups
}

const collectFrom = (
  entry: RootEntry,
  parent: GridPoint,
  segments: LayoutSegment[],
  nodes: LayoutNode[],
  parentGroups: Map<NodeEntry, GroupIdentifier>,
): void => {
  for (const link of entry.links) {
    const point: GridPoint = {
      x: parent.x + link.x,
      y: parent.y + link.y,
    }

    segments.push({
      x1: parent.x,
      y1: parent.y,
      x2: point.x,
      y2: point.y,
      fromGroupId: resolveNodeGroup(entry, parentGroups),
      toGroupId: link.group ?? parentGroups.get(link),
      toFactionId: link.faction,
      multiSegment: !isDirectGroupLink(entry, link),
      startsAtGroupNode: isNodeEntry(entry) && entry.group !== undefined,
    })

    if (link.group !== undefined) {
      nodes.push({
        x: point.x,
        y: point.y,
        group: link.group,
        childGroups: link.links.map(collectDescendantGroups),
      })
    } else if (link.faction !== undefined) {
      nodes.push({
        x: point.x,
        y: point.y,
        faction: link.faction,
      })
    }

    collectFrom(link, point, segments, nodes, parentGroups)
  }
}

export const collectLayout = (root: RootEntry): { segments: LayoutSegment[]; nodes: LayoutNode[] } => {
  const parentGroups = computeParentGroups(root)
  const segments: LayoutSegment[] = []
  const nodes: LayoutNode[] = []
  const origin: GridPoint = { x: 0, y: 0 }

  collectFrom(root, origin, segments, nodes, parentGroups)

  return { segments, nodes }
}

const unionBounds = (current: PixelBounds | null, next: PixelBounds): PixelBounds =>
  current === null
    ? next
    : {
        minX: Math.min(current.minX, next.minX),
        minY: Math.min(current.minY, next.minY),
        maxX: Math.max(current.maxX, next.maxX),
        maxY: Math.max(current.maxY, next.maxY),
      }

const centeredBoxBounds = (centerX: number, centerY: number, width: number, height: number): PixelBounds => ({
  minX: centerX - width / 2,
  minY: centerY - height / 2,
  maxX: centerX + width / 2,
  maxY: centerY + height / 2,
})

export const computeViewBox = (
  nodes: LayoutNode[],
  shipTreeGroups: Record<GroupIdentifier, ShipTreeGroup>,
  faction: FactionIdentifier,
  shipSizeByTypeId: Record<number, number>,
): LayoutViewBox => {
  const padding = paddingCells * cellSize
  const capsuleX = gridToPixel(0)
  const capsuleY = gridToPixel(0)

  let bounds: PixelBounds | null = centeredBoxBounds(capsuleX, capsuleY, groupIconLargeSize, groupIconLargeSize)

  for (const node of nodes) {
    const nodeX = gridToPixel(node.x)
    const nodeY = gridToPixel(node.y)

    if (node.group !== undefined) {
      const shipTypes = shipTreeGroups[node.group]?.factions[faction]?.shipTypes ?? []
      const { shipCount, shipNodeSize } = resolveGroupShipLayout(shipTypes, shipSizeByTypeId)
      const layout = computeShipGroupLayout({
        groupNodeX: nodeX,
        groupNodeY: nodeY,
        shipCount,
        shipNodeSize,
      })

      bounds = unionBounds(bounds, computeGroupVisualBounds(layout, shipCount, nodeX, nodeY))
    } else if (node.faction !== undefined) {
      bounds = unionBounds(bounds, centeredBoxBounds(nodeX, nodeY, groupBoxWidth, groupBoxHeight))
    }
  }

  if (bounds === null) {
    const emptyPadding = padding + groupBoxWidth / 2

    return {
      x: -emptyPadding,
      y: -emptyPadding,
      width: emptyPadding * 2,
      height: emptyPadding * 2,
    }
  }

  return {
    x: bounds.minX - padding,
    y: bounds.minY - padding,
    width: bounds.maxX - bounds.minX + padding * 2,
    height: bounds.maxY - bounds.minY + padding * 2,
  }
}

export const formatViewBox = (viewBox: LayoutViewBox): string =>
  `${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`
