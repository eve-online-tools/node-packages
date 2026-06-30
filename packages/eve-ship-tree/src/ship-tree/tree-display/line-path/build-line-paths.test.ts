import { describe, expect, it } from 'vitest'

import { applyJunctionTrim, buildLinePaths, offsetAlong, type ResolvedLineSegment } from './build-line-paths'

const seg = (
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  status: ResolvedLineSegment['status'] = 'unlocked',
  fade?: ResolvedLineSegment['fade'],
): ResolvedLineSegment => ({ x1, y1, x2, y2, status, fade })

describe('buildLinePaths', () => {
  it('merges same-status corner chain into one path', () => {
    const segments = [seg(0, 0, 100, 0), seg(100, 0, 100, 50), seg(100, 50, 200, 50)]

    expect(buildLinePaths(segments)).toEqual([
      {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
          { x: 200, y: 50 },
        ],
        status: 'unlocked',
      },
    ])
  })

  it('does not trim same-status junctions', () => {
    const segments = [seg(0, 0, 100, 0), seg(100, 0, 100, 50), seg(100, 0, 100, -50)]

    const paths = buildLinePaths(segments)

    expect(paths).toHaveLength(3)
    expect(paths).toContainEqual({
      points: [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      status: 'unlocked',
    })
    expect(paths).toContainEqual({
      points: [
        { x: 100, y: 0 },
        { x: 100, y: 50 },
      ],
      status: 'unlocked',
    })
    expect(paths).toContainEqual({
      points: [
        { x: 100, y: 0 },
        { x: 100, y: -50 },
      ],
      status: 'unlocked',
    })
  })

  it('trims when status changes at a junction', () => {
    const segments = [seg(0, 0, 100, 0, 'unlocked'), seg(100, 0, 100, 50, 'locked')]

    expect(buildLinePaths(segments)).toEqual([
      {
        points: [
          { x: 0, y: 0 },
          { x: 95, y: 0 },
        ],
        status: 'unlocked',
      },
      {
        points: [
          { x: 100, y: 5 },
          { x: 100, y: 50 },
        ],
        status: 'locked',
      },
    ])
  })

  it('only trims the differing branch at a mixed-status t-junction', () => {
    const segments = [
      seg(0, 0, 100, 0, 'unlocked', 'in'),
      seg(100, 0, 200, 0, 'unlocked'),
      seg(100, 0, 100, 50, 'locked'),
    ]

    expect(buildLinePaths(segments)).toEqual([
      {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        status: 'unlocked',
        fade: 'in',
      },
      {
        points: [
          { x: 100, y: 0 },
          { x: 200, y: 0 },
        ],
        status: 'unlocked',
      },
      {
        points: [
          { x: 100, y: 5 },
          { x: 100, y: 50 },
        ],
        status: 'locked',
      },
    ])
  })

  it('does not trim when only fade differs at a junction', () => {
    const segments = [seg(0, 0, 100, 0, 'unlocked', 'in'), seg(100, 0, 100, 50, 'unlocked')]

    expect(buildLinePaths(segments)).toEqual([
      {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        status: 'unlocked',
        fade: 'in',
      },
      {
        points: [
          { x: 100, y: 0 },
          { x: 100, y: 50 },
        ],
        status: 'unlocked',
      },
    ])
  })

  it('leaves isolated segments as two-point paths', () => {
    const segments = [seg(0, 0, 50, 0), seg(200, 0, 300, 0)]

    expect(buildLinePaths(segments)).toEqual([
      {
        points: [
          { x: 0, y: 0 },
          { x: 50, y: 0 },
        ],
        status: 'unlocked',
      },
      {
        points: [
          { x: 200, y: 0 },
          { x: 300, y: 0 },
        ],
        status: 'unlocked',
      },
    ])
  })

  it('does not trim root or leaf endpoints', () => {
    const segments = [seg(0, 0, 100, 0, 'unlocked', 'in')]

    expect(buildLinePaths(segments)).toEqual([
      {
        points: [
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ],
        status: 'unlocked',
        fade: 'in',
      },
    ])
  })
})

describe('applyJunctionTrim', () => {
  it('offsets endpoints along adjacent legs', () => {
    expect(
      applyJunctionTrim(
        [
          { x: 100, y: 0 },
          { x: 100, y: 50 },
        ],
        true,
        false,
        5,
      ),
    ).toEqual([
      { x: 100, y: 5 },
      { x: 100, y: 50 },
    ])
    expect(offsetAlong({ x: 100, y: 0 }, { x: 0, y: 0 }, 5)).toEqual({ x: 95, y: 0 })
  })
})
