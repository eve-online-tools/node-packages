import { fixtureMapData } from '../test/fixture'
import { decodeMapData, encodeMapData, HEADER_BYTES, MAP_DATA_MAGIC } from './binary'
import type { MapData } from './types'
import { MapDataError, validateMapData } from './validate'

// Binary stores float32.
const toFloat32 = (data: MapData): MapData => ({
  ...data,
  systems: data.systems.map((s) => ({
    ...s,
    security: Math.fround(s.security),
    position: { x: Math.fround(s.position.x), y: Math.fround(s.position.y), z: Math.fround(s.position.z) },
    position2d: s.position2d && { x: Math.fround(s.position2d.x), y: Math.fround(s.position2d.y) },
  })),
})

describe('binary encoding', () => {
  it('round trips', () => {
    const data = fixtureMapData()
    expect(decodeMapData(encodeMapData(data))).toEqual(toFloat32(data))
  })

  it('round trips systems without a 2D position', () => {
    const data = fixtureMapData()
    data.systems[2].position2d = undefined
    expect(decodeMapData(encodeMapData(data)).systems[2].position2d).toBeUndefined()
  })

  it('writes the documented header', () => {
    const view = new DataView(encodeMapData(fixtureMapData()))
    expect(view.getUint32(0, true)).toBe(MAP_DATA_MAGIC)
    expect(String.fromCharCode(...new Uint8Array(view.buffer, 0, 4))).toBe('EVEM')
    expect(view.getUint32(4, true)).toBe(6)
    expect(view.getUint32(8, true)).toBe(7)
    expect(view.getUint32(12, true)).toBe(2)
    expect(view.getUint32(16, true)).toBe(3)
    expect(view.getInt32(HEADER_BYTES, true)).toBe(30000001)
    expect(view.byteLength % 4).toBe(0)
  })

  it('decodes from a Uint8Array at any offset', () => {
    const encoded = new Uint8Array(encodeMapData(fixtureMapData()))
    const padded = new Uint8Array(encoded.length + 1)
    padded.set(encoded, 1)
    expect(decodeMapData(padded.subarray(1)).systems[0].name).toBe('Alpha')
  })

  it('rejects bad magic and truncated input', () => {
    const encoded = new Uint8Array(encodeMapData(fixtureMapData()))
    const corrupt = encoded.slice()
    corrupt[0] = 0
    expect(() => decodeMapData(corrupt)).toThrow(MapDataError)
    expect(() => decodeMapData(encoded.slice(0, 40))).toThrow(MapDataError)
  })
})

describe('validateMapData', () => {
  it('rejects duplicate IDs and non-finite positions', () => {
    const data = fixtureMapData()
    expect(() => validateMapData({ ...data, systems: [data.systems[0], data.systems[0]] })).toThrow(/Duplicate/)
    data.systems[1].position.x = NaN
    expect(() => validateMapData(data)).toThrow(/non-finite/)
  })
})
