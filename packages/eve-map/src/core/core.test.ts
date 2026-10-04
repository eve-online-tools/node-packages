import { constellationLabelsVisible, regionLabelsVisible, systemLabelsVisible } from './layers/labels'
import { lerpAngle, lerpPose } from './camera'
import { parseColor, regionColor, roundSecurity, scaleColor, securityColor } from './colors'
import { buildScreenGrid, createProjection, projectSystems, queryNearest } from './projection'
import { diffRanges, FLAG_HIDDEN, FLAG_HIGHLIGHT, resolveColors, resolveFlags, resolveSizes } from './style'

const IDENTITY = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]

describe('diffRanges', () => {
  it('returns nothing for equal arrays', () => {
    expect(diffRanges([1, 2, 3], [1, 2, 3])).toEqual([])
  })

  it('reports changed items in element units', () => {
    const prev = new Float32Array(30)
    const next = prev.slice()
    next[4] = 1 // item 1 of itemSize 3
    expect(diffRanges(prev, next, 3)).toEqual([{ start: 3, count: 3 }])
  })

  it('merges ranges separated by small gaps and splits large ones', () => {
    const prev = new Float32Array(100)
    const next = prev.slice()
    next[10] = 1
    next[14] = 1
    next[90] = 1
    expect(diffRanges(prev, next, 1, 8)).toEqual([
      { start: 10, count: 5 },
      { start: 90, count: 1 },
    ])
  })

  it('treats NaN as equal to NaN', () => {
    expect(diffRanges([Number.NaN], [Number.NaN])).toEqual([])
  })
})

describe('style resolution', () => {
  const security = new Float32Array([1, 0.5, -1])

  it('defaults to security colors', () => {
    expect(Array.from(resolveColors(undefined, security).subarray(0, 3))).toEqual(securityColor(1).map(Math.fround))
  })

  it('accepts a single color, per-index arrays, functions and packed rgb', () => {
    expect(Array.from(resolveColors('#ff0000', security))).toEqual([1, 0, 0, 1, 0, 0, 1, 0, 0])
    expect(Array.from(resolveColors(['#000', '#fff', 0x00ff00], security))).toEqual([0, 0, 0, 1, 1, 1, 0, 1, 0])
    expect(Array.from(resolveColors((i) => [i / 2, 0, 0], security))).toEqual([0, 0, 0, 0.5, 0, 0, 1, 0, 0])
    const packed = new Float32Array(9).fill(0.25)
    expect(Array.from(resolveColors(packed, security))).toEqual(Array.from(packed))
    expect(() => resolveColors(new Float32Array(3), security)).toThrow(/packed rgb/)
  })

  it('resolves sizes with defaults for missing values', () => {
    expect(Array.from(resolveSizes(undefined, 2))).toEqual([4, 4])
    expect(Array.from(resolveSizes([8, Number.NaN], 2))).toEqual([8, 4])
  })

  it('packs visibility and highlight into flags', () => {
    expect(Array.from(resolveFlags([true, false, true], new Set([2]), 3))).toEqual([0, FLAG_HIDDEN, FLAG_HIGHLIGHT])
  })
})

describe('colors', () => {
  it('rounds security like the game', () => {
    expect(roundSecurity(0.04)).toBe(0.1)
    expect(roundSecurity(0.45)).toBe(0.5)
    expect(roundSecurity(-0.04)).toBe(-0)
  })

  it('maps security to the in-game palette', () => {
    expect(securityColor(1)).toEqual(parseColor('#2c74e0'))
    expect(securityColor(0.04)).toEqual(securityColor(0.1))
    expect(securityColor(-0.8)).toEqual(securityColor(0))
  })

  it('parses css colors', () => {
    expect(parseColor('#fff')).toEqual([1, 1, 1])
    expect(parseColor('rgb(255, 0, 0)')).toEqual([1, 0, 0])
    expect(parseColor(0x0000ff)).toEqual([0, 0, 1])
    expect(() => parseColor('nope')).toThrow(/Unrecognized color/)
  })

  it('gives regions stable, distinct colors', () => {
    expect(regionColor(10000002)).toEqual(regionColor(10000002))
    expect(regionColor(10000002)).not.toEqual(regionColor(10000003))
  })

  it('scales values across a palette', () => {
    const out = scaleColor([0, 5, 10, Number.NaN], ['#000', '#fff'], { missing: '#f00' })
    expect(Array.from(out)).toEqual([0, 0, 0, 0.5, 0.5, 0.5, 1, 1, 1, 1, 0, 0])
  })
})

describe('camera interpolation', () => {
  it('takes the short way around', () => {
    expect(lerpAngle(0.1, Math.PI * 2 - 0.1, 0.5)).toBeCloseTo(0)
  })

  it('interpolates zoom geometrically', () => {
    const a = { target: [0, 0, 0] as [number, number, number], viewHeight: 1, azimuth: 0, polar: 0, fov: 10, morph: 0 }
    const b = { ...a, viewHeight: 4, morph: 1, fov: 50 }
    const mid = lerpPose(a, b, 0.5)
    expect(mid.viewHeight).toBeCloseTo(2)
    expect(mid.morph).toBe(0.5)
    expect(mid.fov).toBe(30)
  })
})

describe('picking', () => {
  // Identity view-projection: NDC == scene x/y, z ignored by morph=1.
  const position = new Float32Array([0, 0, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.51, 0.5, 0, 0, 0, 5])
  const position2d = new Float32Array(10)
  const flags = new Float32Array(5)

  const project = (f = flags) => projectSystems(createProjection(5), position, position2d, f, 1, IDENTITY, 200, 100)

  it('projects to CSS pixels with y down and culls outside the clip volume', () => {
    const p = project()
    expect([p.x[0], p.y[0]]).toEqual([100, 50])
    expect([p.x[1], p.y[1]]).toEqual([150, 25])
    expect(p.visible[4]).toBe(0)
    expect(p.visibleCount).toBe(4)
  })

  it('finds the nearest system in the grid', () => {
    const p = project()
    const grid = buildScreenGrid(p, 200, 100, 16)
    expect(queryNearest(grid, p, 101, 51, 10)).toBe(0)
    expect(queryNearest(grid, p, 49, 76, 10)).toBe(2)
    expect(queryNearest(grid, p, 152, 25, 10)).toBe(3)
    expect(queryNearest(grid, p, 10, 10, 10)).toBeNull()
  })

  it('ignores hidden systems', () => {
    const hidden = new Float32Array(5)
    hidden[0] = FLAG_HIDDEN
    const p = project(hidden)
    const grid = buildScreenGrid(p, 200, 100)
    expect(queryNearest(grid, p, 100, 50, 10)).toBeNull()
  })

  it('handles the full map in well under a frame', () => {
    const n = 5500
    const pos = Float32Array.from({ length: n * 3 }, () => Math.random() * 2 - 1)
    const pos2 = new Float32Array(n * 2)
    const f = new Float32Array(n)
    const p = createProjection(n)
    const start = performance.now()
    for (let k = 0; k < 10; k++) {
      projectSystems(p, pos, pos2, f, 1, IDENTITY, 1920, 1080)
      queryNearest(buildScreenGrid(p, 1920, 1080), p, 500, 500, 10)
    }
    expect((performance.now() - start) / 10).toBeLessThan(8)
  })
})

describe('label visibility', () => {
  it('shows region labels below the zoom threshold', () => {
    expect(regionLabelsVisible(undefined, 1)).toBe(false)
    expect(regionLabelsVisible(true, 100)).toBe(true)
    expect(regionLabelsVisible(3, 2)).toBe(true)
    expect(regionLabelsVisible(3, 4)).toBe(false)
  })

  it('shows constellation labels inside the zoom range', () => {
    expect(constellationLabelsVisible([2, 8], 1)).toBe(false)
    expect(constellationLabelsVisible([2, 8], 4)).toBe(true)
    expect(constellationLabelsVisible([2, 8], 9)).toBe(false)
    expect(constellationLabelsVisible(true, 0.1)).toBe(true)
  })

  it('shows system labels above the zoom threshold', () => {
    expect(systemLabelsVisible(undefined, 100)).toBe(false)
    expect(systemLabelsVisible(false, 100)).toBe(false)
    expect(systemLabelsVisible(6, 5)).toBe(false)
    expect(systemLabelsVisible(6, 7)).toBe(true)
  })
})
