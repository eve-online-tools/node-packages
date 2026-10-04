import { fixtureMapData } from '../test/fixture'
import { normalizeInPlace, prepareMap } from './prepare'

describe('prepareMap', () => {
  it('normalizes to the unit box, centered, keeping aspect', () => {
    const values = new Float32Array([0, 0, 10, 4, 20, 2])
    normalizeInPlace(values, 2)
    expect(Array.from(values)).toEqual([-1, -0.2, 0, 0.2, 1, 0].map(Math.fround))
  })

  it('fits both layouts in [-1, 1]', () => {
    const { position, position2d } = prepareMap(fixtureMapData())
    for (const v of [...position, ...position2d]) {
      expect(Math.abs(v)).toBeLessThanOrEqual(1 + 1e-6)
    }
  })

  it('flips SDE z so 2D and 3D share orientation', () => {
    const { position, position2d } = prepareMap(fixtureMapData())
    // Alpha is SDE +z / 2D +y, which is scene -z in both layouts.
    expect(position[2]).toBeLessThan(0)
    expect(position2d[1]).toBeLessThan(0)
  })

  it('places systems without a 2D position at their 3D top-down spot', () => {
    const data = fixtureMapData()
    data.systems[2].position2d = undefined
    const { position, position2d } = prepareMap(data)
    expect(position2d[4]).toBeCloseTo(position[6])
    expect(position2d[5]).toBeCloseTo(position[8])
  })

  it('turns per-system gates into unique index pairs, dropping unknown IDs', () => {
    expect(Array.from(prepareMap(fixtureMapData()).gates)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5])
  })

  it('looks up systems by ID, region and constellation', () => {
    const prepared = prepareMap(fixtureMapData())
    expect(prepared.indexOf(30000003)).toBe(2)
    expect(prepared.indexOf(1)).toBe(-1)
    expect(prepared.systemsInRegion(10000002)).toEqual([3, 4, 5])
    expect(prepared.systemsInConstellation(20000001)).toEqual([0, 1])
  })
})
