import type { Identifier as GroupIdentifier } from '../../data/identifiers/shipTreeGroups'
import type { Identifier as ShipTreeFactionId } from '../../data/identifiers/shipTreeFactions'
import type { GroupStatus, PerFactionInfo, ShipTreeGroup } from '../../data-provider/processors/ship-tree-groups'
import { computeSkillBarsExtentFromGroupCenter } from './layout-constants'
import { computeShipIconsExtentFromGroupCenter, resolveGroupShipLayout } from './ship-group/compute-ship-group-layout'
import { resolveVisibleDisplaySkills } from './ship-group/resolve-visible-display-skills'
import { buildLinePaths, type LinePathProps, type ResolvedLineSegment } from './line-path/build-line-paths'
import { gridToPixel, type LayoutNode, type LayoutSegment } from './render-layout'

export type OmegaTransition = {
  x: number
  y: number
}

export type SegmentMap = {
  linePaths: LinePathProps[]
  omegaTransitions: OmegaTransition[]
}

const getGroupFactionInfo = (
  groupId: GroupIdentifier | undefined,
  faction: ShipTreeFactionId,
  shipTreeGroups: Record<GroupIdentifier, ShipTreeGroup>,
): PerFactionInfo | undefined => (groupId === undefined ? undefined : shipTreeGroups[groupId]?.factions[faction])

const buildChildGroupsByGroup = (nodes: LayoutNode[]): Map<GroupIdentifier, GroupIdentifier[][]> => {
  const childGroupsByGroup = new Map<GroupIdentifier, GroupIdentifier[][]>()

  for (const node of nodes) {
    if (node.group !== undefined && node.childGroups !== undefined) {
      childGroupsByGroup.set(node.group, node.childGroups)
    }
  }

  return childGroupsByGroup
}

const findDescendantBranch = (
  childGroups: GroupIdentifier[][],
  targetGroupId: GroupIdentifier,
): GroupIdentifier[] | undefined => childGroups.find((branch) => branch.includes(targetGroupId))

const findMasteredBranch = (
  fromGroupId: GroupIdentifier | undefined,
  toGroupId: GroupIdentifier,
  childGroupsByGroup: Map<GroupIdentifier, GroupIdentifier[][]>,
): GroupIdentifier[] | undefined => {
  if (fromGroupId !== undefined) {
    const fromChildGroups = childGroupsByGroup.get(fromGroupId)
    if (fromChildGroups !== undefined) {
      const branch = findDescendantBranch(fromChildGroups, toGroupId)
      if (branch !== undefined) {
        return branch
      }
    }
  }

  let bestBranch: GroupIdentifier[] | undefined

  for (const childGroups of childGroupsByGroup.values()) {
    for (const branch of childGroups) {
      if (!branch.includes(toGroupId)) {
        continue
      }

      if (fromGroupId !== undefined && fromGroupId !== toGroupId && !branch.includes(fromGroupId)) {
        continue
      }

      if (bestBranch === undefined || branch.length < bestBranch.length) {
        bestBranch = branch
      }
    }
  }

  return bestBranch
}

const isBranchMastered = (
  branch: GroupIdentifier[],
  shipTreeGroups: Record<GroupIdentifier, ShipTreeGroup>,
  factionId: ShipTreeFactionId,
): boolean =>
  branch.length > 0 &&
  branch.every((groupId) => getGroupFactionInfo(groupId, factionId, shipTreeGroups)?.mastered === true)

export const resolveFactionTravelSegmentStatus = (
  fromGroupId: GroupIdentifier,
  toFactionId: ShipTreeFactionId,
  shipTreeGroups: Record<GroupIdentifier, ShipTreeGroup>,
): GroupStatus | 'mastered' => {
  const info = getGroupFactionInfo(fromGroupId, toFactionId, shipTreeGroups)
  if (info?.status !== 'unlocked') {
    return info?.status ?? 'locked'
  }

  return info.mastered ? 'mastered' : 'unlocked'
}

export const resolveLineSegmentStatus = (
  segment: LayoutSegment,
  baseStatus: GroupStatus,
  childGroupsByGroup: Map<GroupIdentifier, GroupIdentifier[][]>,
  shipTreeGroups: Record<GroupIdentifier, ShipTreeGroup>,
  factionId: ShipTreeFactionId,
): GroupStatus | 'mastered' => {
  if (baseStatus !== 'unlocked') {
    return baseStatus
  }

  const { fromGroupId, toGroupId } = segment

  if (toGroupId === undefined) {
    return baseStatus
  }

  const branch = findMasteredBranch(fromGroupId, toGroupId, childGroupsByGroup)
  if (branch === undefined || !isBranchMastered(branch, shipTreeGroups, factionId)) {
    return baseStatus
  }

  return 'mastered'
}

const getHorizontalFromGroupLayout = (
  segment: LayoutSegment,
  shipTreeGroups: Record<GroupIdentifier, ShipTreeGroup>,
  factionId: ShipTreeFactionId,
  shipSizeByTypeId: Record<number, number>,
): { shipCount: number; shipNodeSize: number } | null => {
  if (
    segment.y1 !== segment.y2 ||
    !segment.startsAtGroupNode ||
    segment.fromGroupId === undefined ||
    segment.x2 <= segment.x1
  ) {
    return null
  }

  const shipTypes = getGroupFactionInfo(segment.fromGroupId, factionId, shipTreeGroups)?.shipTypes ?? []

  if (shipTypes.length === 0) {
    return null
  }

  return resolveGroupShipLayout(shipTypes, shipSizeByTypeId)
}

const applyHorizontalFromGroupInset = (
  x1: number,
  x2: number,
  layout: { shipCount: number; shipNodeSize: number } | null,
): number => {
  if (layout === null) {
    return x1
  }

  return Math.min(x1 + computeShipIconsExtentFromGroupCenter(layout.shipCount, layout.shipNodeSize) + 2, x2)
}

const getVerticalFromGroupSkillBarCount = (
  segment: LayoutSegment,
  shipTreeGroups: Record<GroupIdentifier, ShipTreeGroup>,
  factionId: ShipTreeFactionId,
  strictMode: boolean,
): number | null => {
  if (
    segment.x1 !== segment.x2 ||
    !segment.startsAtGroupNode ||
    segment.fromGroupId === undefined ||
    segment.y2 <= segment.y1
  ) {
    return null
  }

  const factionInfo = getGroupFactionInfo(segment.fromGroupId, factionId, shipTreeGroups)

  return Object.keys(resolveVisibleDisplaySkills(factionInfo, strictMode)).length
}

const applyVerticalFromGroupInset = (y1: number, y2: number, skillBarCount: number | null): number => {
  if (skillBarCount === null) {
    return y1
  }

  return Math.min(y1 + computeSkillBarsExtentFromGroupCenter(skillBarCount) + 1, y2)
}

export const buildSegmentMap = (
  segments: LayoutSegment[],
  nodes: LayoutNode[],
  shipTreeGroups: Record<GroupIdentifier, ShipTreeGroup>,
  factionId: ShipTreeFactionId,
  shipSizeByTypeId: Record<number, number>,
  strictMode = false,
): SegmentMap => {
  const resolvedSegments: ResolvedLineSegment[] = []
  const omegaTransitions: OmegaTransition[] = []
  const childGroupsByGroup = buildChildGroupsByGroup(nodes)

  for (const segment of segments) {
    const isFactionTravel = segment.toFactionId !== undefined && segment.fromGroupId !== undefined

    const fromInfo = getGroupFactionInfo(segment.fromGroupId, factionId, shipTreeGroups)
    const fromOmegaRestricted = fromInfo?.omegaRestricted ?? false

    let status: GroupStatus | 'mastered'
    let omegaRestricted = false

    if (isFactionTravel) {
      const targetInfo = getGroupFactionInfo(segment.fromGroupId, segment.toFactionId!, shipTreeGroups)
      status = resolveFactionTravelSegmentStatus(segment.fromGroupId!, segment.toFactionId!, shipTreeGroups)
      omegaRestricted = targetInfo?.omegaRestricted ?? false
    } else {
      const toInfo = getGroupFactionInfo(segment.toGroupId, factionId, shipTreeGroups)
      const baseStatus = toInfo?.status ?? 'locked'
      omegaRestricted = toInfo?.omegaRestricted ?? false
      status = resolveLineSegmentStatus(segment, baseStatus, childGroupsByGroup, shipTreeGroups, factionId)
    }

    const fromGroupLayout = getHorizontalFromGroupLayout(segment, shipTreeGroups, factionId, shipSizeByTypeId)
    const fromGroupSkillBarCount = getVerticalFromGroupSkillBarCount(segment, shipTreeGroups, factionId, strictMode)

    let x1 = gridToPixel(segment.x1)
    let y1 = gridToPixel(segment.y1)
    const x2 = gridToPixel(segment.x2)
    const y2 = gridToPixel(segment.y2)

    x1 = applyHorizontalFromGroupInset(x1, x2, fromGroupLayout)
    y1 = applyVerticalFromGroupInset(y1, y2, fromGroupSkillBarCount)

    const center = {
      x: (x1 + x2) / 2,
      y: (y1 + y2) / 2,
    }
    const isOmegaTransition = !fromOmegaRestricted && omegaRestricted

    const fade =
      segment.fromGroupId === undefined && segment.toGroupId !== undefined
        ? 'in'
        : segment.toFactionId !== undefined
          ? 'out'
          : undefined

    if (isOmegaTransition) {
      omegaTransitions.push(center)
    }

    resolvedSegments.push({
      x1,
      y1,
      x2,
      y2,
      status,
      fade,
    })
  }

  return { linePaths: buildLinePaths(resolvedSegments), omegaTransitions }
}
