import { fixtureMapData, fixtureSource } from '../test/fixture'
import { buildGateIndices, buildMapData, MAX_SYSTEMS, normalizeInPlace, sde2dToScene, sdeToScene } from './build'
import { decodeMapData, encodeMapData, HEADER_BYTES, MAP_DATA_MAGIC } from './binary'
import { mapDataFromJson, mapDataToJson } from './json'
import { createMapIndex } from './lookup'
import type { MapData } from './types'
import { MapDataError, validateMapData } from './validate'

// JSON can't keep -0.
const list = (values: ArrayLike<number> | undefined) => Array.from(values ?? [], (v) => v + 0)

const expectSameData = (actual: MapData, expected: MapData) => {
  expect(list(actual.systems.id)).toEqual(list(expected.systems.id))
  expect(list(actual.systems.constellation)).toEqual(list(expected.systems.constellation))
  expect(list(actual.systems.region)).toEqual(list(expected.systems.region))
  expect(list(actual.systems.position)).toEqual(list(expected.systems.position))
  expect(list(actual.systems.position2d)).toEqual(list(expected.systems.position2d))
  expect(list(actual.systems.security)).toEqual(list(expected.systems.security))
  expect(actual.systems.name).toEqual(expected.systems.name)
  expect(list(actual.gates)).toEqual(list(expected.gates))
  expect(list(actual.bounds.position)).toEqual(list(expected.bounds.position))
  expect(list(actual.bounds.position2d)).toEqual(list(expected.bounds.position2d))
  expect(actual.regions).toEqual(expected.regions)
  expect(actual.constellations).toEqual(expected.constellations)
}

describe('coordinate conversion', () => {
  it('flips z from SDE left-handed to scene right-handed', () => {
    expect(sdeToScene(1, 2, 3)).toEqual([1, 2, -3])
  })

  it('maps SDE 2D y onto scene -z so 2D matches the 3D top-down view', () => {
    expect(sde2dToScene(4, 5)).toEqual([4, -5])
  })

  it('normalizes to the unit box, centered, keeping aspect', () => {
    const values = new Float64Array([0, 0, 10, 4, 20, 2])
    const bounds = normalizeInPlace(values, 2)
    expect(Array.from(values)).toEqual([-1, -0.2, 0, 0.2, 1, 0])
    expect(Array.from(bounds)).toEqual([-1, expect.closeTo(-0.2), 1, expect.closeTo(0.2)])
  })

  it('normalizes both layouts to the same unit bounds', () => {
    const data = fixtureMapData()
    const extent = (b: Float32Array, stride: number) =>
      Math.max(...Array.from({ length: stride }, (_, c) => b[stride + c] - b[c]))
    expect(extent(data.bounds.position, 3)).toBeCloseTo(2)
    expect(extent(data.bounds.position2d, 2)).toBeCloseTo(2)
    for (const v of [...data.systems.position, ...data.systems.position2d]) {
      expect(Math.abs(v)).toBeLessThanOrEqual(1 + 1e-6)
    }
  })

  it('keeps 2D and 3D orientation consistent', () => {
    const data = fixtureMapData()
    // Alpha is SDE +z / 2D +y, which is scene -z in both layouts.
    expect(data.systems.position[2]).toBeLessThan(0)
    expect(data.systems.position2d[1]).toBeLessThan(0)
  })

  it('places systems without a 2D position at their 3D top-down spot', () => {
    const source = fixtureSource()
    const systems = [...source.systems]
    systems[2] = { ...systems[2], position2d: undefined }
    const data = buildMapData({ ...source, systems })
    expect(data.systems.position2d[4]).toBeCloseTo(data.systems.position[6])
    expect(data.systems.position2d[5]).toBeCloseTo(data.systems.position[8])
  })
})

describe('gates', () => {
  it('deduplicates both directions, drops unknown IDs and orders a < b', () => {
    const data = fixtureMapData()
    expect(Array.from(data.gates)).toEqual([0, 1, 1, 2, 2, 3, 3, 4, 4, 5])
  })

  it('drops self loops', () => {
    const gates = buildGateIndices(
      [
        [1, 1],
        [2, 1],
      ],
      new Map([
        [1, 0],
        [2, 1],
      ]),
    )
    expect(Array.from(gates)).toEqual([0, 1])
  })

  it('refuses more systems than Uint16 indices can address', () => {
    const systems = Array.from({ length: MAX_SYSTEMS + 1 }, (_, i) => ({
      id: i,
      constellationId: 0,
      regionId: 0,
      security: 0,
      name: '',
      position: { x: i, y: 0, z: 0 },
    }))
    expect(() => buildMapData({ systems, gates: [] })).toThrow(RangeError)
  })
})

describe('binary encoding', () => {
  it('round trips', () => {
    const data = fixtureMapData()
    expectSameData(decodeMapData(encodeMapData(data)), data)
  })

  it('returns views over the input buffer', () => {
    const buffer = encodeMapData(fixtureMapData())
    const decoded = decodeMapData(buffer)
    expect(decoded.systems.position.buffer).toBe(buffer)
    expect(decoded.gates.buffer).toBe(buffer)
  })

  it('writes the documented header', () => {
    const data = fixtureMapData()
    const view = new DataView(encodeMapData(data))
    expect(view.getUint32(0, true)).toBe(MAP_DATA_MAGIC)
    expect(String.fromCharCode(...new Uint8Array(view.buffer, 0, 4))).toBe('EVEM')
    expect(view.getUint32(4, true)).toBe(6)
    expect(view.getUint32(8, true)).toBe(5)
    expect(view.getUint32(12, true)).toBe(2)
    expect(view.getUint32(16, true)).toBe(3)
    // First section: 3D bounds right after the header
    expect(view.getFloat32(HEADER_BYTES, true)).toBe(data.bounds.position[0])
    expect(view.byteLength % 4).toBe(0)
  })

  it('decodes from an unaligned Uint8Array by copying once', () => {
    const encoded = new Uint8Array(encodeMapData(fixtureMapData()))
    const padded = new Uint8Array(encoded.length + 1)
    padded.set(encoded, 1)
    const decoded = decodeMapData(padded.subarray(1))
    expect(decoded.systems.name[0]).toBe('Alpha')
  })

  it('encodes empty name tables', () => {
    const decoded = decodeMapData(encodeMapData({ ...fixtureMapData(), regions: {}, constellations: {} }))
    expect(decoded.regions).toEqual({})
    expect(decoded.constellations).toEqual({})
  })

  it('rejects bad magic and truncated input', () => {
    const encoded = new Uint8Array(encodeMapData(fixtureMapData()))
    const corrupt = encoded.slice()
    corrupt[0] = 0
    expect(() => decodeMapData(corrupt)).toThrow(MapDataError)
    expect(() => decodeMapData(encoded.slice(0, 40))).toThrow(MapDataError)
  })

  it('fails loudly on invalid gates', () => {
    const data = fixtureMapData()
    expect(() => encodeMapData({ ...data, gates: new Uint16Array([0, 99]) })).toThrow(MapDataError)
    expect(() => encodeMapData({ ...data, gates: new Uint16Array([1, 0]) })).toThrow(MapDataError)
    expect(() => encodeMapData({ ...data, gates: new Uint16Array([0, 1, 0, 1]) })).toThrow(MapDataError)
  })

  it('stays small for the real map size', () => {
    // 5.5k systems, 7k gates, ~6 char names
    const n = 5500
    const bytes = HEADER_BYTES + 40 + n * (4 * 3 + 12 + 8 + 4) + 7000 * 4 + 4 + (n + 1) * 4 + n * 6
    expect(bytes).toBeLessThan(300_000)
  })
})

describe('JSON', () => {
  it('round trips through a string', () => {
    const data = fixtureMapData()
    expectSameData(mapDataFromJson(JSON.stringify(mapDataToJson(data))), data)
  })

  it('validates', () => {
    const json = mapDataToJson(fixtureMapData())
    json.systems.region.pop()
    expect(() => mapDataFromJson(json)).toThrow(MapDataError)
  })
})

describe('validateMapData', () => {
  it('rejects mismatched lengths', () => {
    const data = fixtureMapData()
    expect(() => validateMapData({ ...data, systems: { ...data.systems, name: [] } })).toThrow(/systems.name/)
  })
})

describe('createMapIndex', () => {
  it('looks up systems by ID, region and constellation', () => {
    const index = createMapIndex(fixtureMapData())
    expect(index.indexOf(30000003)).toBe(2)
    expect(index.indexOf(1)).toBe(-1)
    expect(index.systemsInRegion(10000002)).toEqual([3, 4, 5])
    expect(index.systemsInConstellation(20000001)).toEqual([0, 1])
  })
})
