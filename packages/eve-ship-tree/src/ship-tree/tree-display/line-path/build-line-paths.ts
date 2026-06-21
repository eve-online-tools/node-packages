import { lineSpriteHeight } from '../layout-constants'
import type { LinePathFade, LinePathStatus } from './sprites'

export type ResolvedLineSegment = {
  x1: number
  y1: number
  x2: number
  y2: number
  status: LinePathStatus
  fade?: LinePathFade
}

export type LinePathPoint = { x: number; y: number }

export type LinePathProps = {
  points: LinePathPoint[]
  status: LinePathStatus
  fade?: LinePathFade
}

const junctionTrim = lineSpriteHeight / 2

const pointKey = (x: number, y: number): string => `${x},${y}`

const sameTexture = (a: ResolvedLineSegment, b: ResolvedLineSegment): boolean =>
  a.status === b.status && a.fade === b.fade

const sameStatus = (status: LinePathStatus, segment: ResolvedLineSegment): boolean => segment.status === status

const buildEndpointSegments = (segments: ResolvedLineSegment[]) => {
  const starts = new Map<string, ResolvedLineSegment[]>()
  const ends = new Map<string, ResolvedLineSegment[]>()

  for (const segment of segments) {
    const startKey = pointKey(segment.x1, segment.y1)
    const startList = starts.get(startKey) ?? []
    startList.push(segment)
    starts.set(startKey, startList)

    const endKey = pointKey(segment.x2, segment.y2)
    const endList = ends.get(endKey) ?? []
    endList.push(segment)
    ends.set(endKey, endList)
  }

  return { starts, ends }
}

const shouldTrimStart = (key: string, status: LinePathStatus, ends: Map<string, ResolvedLineSegment[]>): boolean => {
  const incoming = ends.get(key) ?? []

  if (incoming.length === 0) {
    return false
  }

  return !incoming.some((segment) => sameStatus(status, segment))
}

const shouldTrimEnd = (key: string, status: LinePathStatus, starts: Map<string, ResolvedLineSegment[]>): boolean => {
  const outgoing = starts.get(key) ?? []

  if (outgoing.length === 0) {
    return false
  }

  return !outgoing.some((segment) => sameStatus(status, segment))
}

export const offsetAlong = (from: LinePathPoint, to: LinePathPoint, distance: number): LinePathPoint => {
  const dx = to.x - from.x
  const dy = to.y - from.y
  const length = Math.hypot(dx, dy)

  if (length === 0 || distance === 0) {
    return from
  }

  const scale = distance / length

  return {
    x: from.x + dx * scale,
    y: from.y + dy * scale,
  }
}

export const applyJunctionTrim = (
  points: LinePathPoint[],
  trimStart: boolean,
  trimEnd: boolean,
  trim = junctionTrim,
): LinePathPoint[] => {
  if (points.length < 2 || (!trimStart && !trimEnd)) {
    return points
  }

  const trimmed = points.map((point) => ({ ...point }))

  if (trimStart) {
    trimmed[0] = offsetAlong(trimmed[0]!, trimmed[1]!, trim)
  }

  if (trimEnd) {
    const last = trimmed.length - 1
    trimmed[last] = offsetAlong(trimmed[last]!, trimmed[last - 1]!, trim)
  }

  return trimmed
}

export const buildLinePaths = (segments: ResolvedLineSegment[]): LinePathProps[] => {
  const outgoing = new Map<string, ResolvedLineSegment[]>()
  const { starts, ends } = buildEndpointSegments(segments)

  for (const segment of segments) {
    const key = pointKey(segment.x1, segment.y1)
    const list = outgoing.get(key) ?? []
    list.push(segment)
    outgoing.set(key, list)
  }

  const consumed = new Set<ResolvedLineSegment>()
  const paths: LinePathProps[] = []

  for (const start of segments) {
    if (consumed.has(start)) {
      continue
    }

    const points: LinePathPoint[] = [
      { x: start.x1, y: start.y1 },
      { x: start.x2, y: start.y2 },
    ]
    consumed.add(start)

    let current = start

    while (true) {
      const candidates = (outgoing.get(pointKey(current.x2, current.y2)) ?? []).filter(
        (segment) => !consumed.has(segment) && sameTexture(start, segment),
      )

      if (candidates.length !== 1) {
        break
      }

      const next = candidates[0]!
      points.push({ x: next.x2, y: next.y2 })
      consumed.add(next)
      current = next
    }

    const firstKey = pointKey(points[0]!.x, points[0]!.y)
    const lastKey = pointKey(points[points.length - 1]!.x, points[points.length - 1]!.y)
    const trimStart = shouldTrimStart(firstKey, start.status, ends)
    const trimEnd = shouldTrimEnd(lastKey, start.status, starts)

    paths.push({
      points: applyJunctionTrim(points, trimStart, trimEnd),
      status: start.status,
      fade: start.fade,
    })
  }

  return paths
}
