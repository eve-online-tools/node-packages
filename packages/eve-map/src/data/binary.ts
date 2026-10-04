import type { MapData } from './types'
import { MapDataError, validateMapData } from './validate'

/** "EVEM" read as a little-endian uint32 */
export const MAP_DATA_MAGIC = 0x4d455645
export const HEADER_BYTES = 20

const align4 = (n: number): number => (n + 3) & ~3

const isLittleEndian = (): boolean => new Uint8Array(new Uint16Array([1]).buffer)[0] === 1

interface Layout {
  n: number
  gateCount: number
  regionCount: number
  constellationCount: number
  boundsPosition: number
  boundsPosition2d: number
  id: number
  constellation: number
  region: number
  position: number
  position2d: number
  security: number
  gates: number
  regionId: number
  constellationId: number
  strings: number
}

const computeLayout = (n: number, gateCount: number, regionCount: number, constellationCount: number): Layout => {
  let offset = HEADER_BYTES
  const take = (bytes: number): number => {
    const start = offset
    offset = align4(offset + bytes)
    return start
  }

  return {
    n,
    gateCount,
    regionCount,
    constellationCount,
    boundsPosition: take(6 * 4),
    boundsPosition2d: take(4 * 4),
    id: take(n * 4),
    constellation: take(n * 4),
    region: take(n * 4),
    position: take(n * 12),
    position2d: take(n * 8),
    security: take(n * 4),
    gates: take(gateCount * 4),
    regionId: take(regionCount * 4),
    constellationId: take(constellationCount * 4),
    strings: offset,
  }
}

/**
 * Encodes `MapData` into the binary layout documented in the README. Validates first and throws
 * `MapDataError` on invalid input, including more systems than Uint16 gate indices can address.
 */
export const encodeMapData = (data: MapData): ArrayBuffer => {
  validateMapData(data)

  const { systems } = data
  const n = systems.id.length
  const regionIds = Object.keys(data.regions).map(Number)
  const constellationIds = Object.keys(data.constellations).map(Number)
  const layout = computeLayout(n, data.gates.length / 2, regionIds.length, constellationIds.length)

  const encoder = new TextEncoder()
  const strings = [
    ...systems.name,
    ...regionIds.map((id) => data.regions[id]),
    ...constellationIds.map((id) => data.constellations[id]),
  ].map((s) => encoder.encode(s))
  const stringBytes = strings.reduce((sum, s) => sum + s.length, 0)
  const stringHeaderBytes = 4 + (strings.length + 1) * 4
  const totalBytes = align4(layout.strings + stringHeaderBytes + stringBytes)

  const buffer = new ArrayBuffer(totalBytes)
  const view = new DataView(buffer)
  view.setUint32(0, MAP_DATA_MAGIC, true)
  view.setUint32(4, n, true)
  view.setUint32(8, layout.gateCount, true)
  view.setUint32(12, regionIds.length, true)
  view.setUint32(16, constellationIds.length, true)

  // DataView keeps the output little-endian regardless of host byte order.
  const writeF32 = (offset: number, values: ArrayLike<number>) => {
    for (let i = 0; i < values.length; i++) {
      view.setFloat32(offset + i * 4, values[i], true)
    }
  }
  const writeI32 = (offset: number, values: ArrayLike<number>) => {
    for (let i = 0; i < values.length; i++) {
      view.setInt32(offset + i * 4, values[i], true)
    }
  }

  writeF32(layout.boundsPosition, data.bounds.position)
  writeF32(layout.boundsPosition2d, data.bounds.position2d)
  writeI32(layout.id, systems.id)
  writeI32(layout.constellation, systems.constellation)
  writeI32(layout.region, systems.region)
  writeF32(layout.position, systems.position)
  writeF32(layout.position2d, systems.position2d)
  writeF32(layout.security, systems.security)
  for (let i = 0; i < data.gates.length; i++) {
    view.setUint16(layout.gates + i * 2, data.gates[i], true)
  }
  writeI32(layout.regionId, regionIds)
  writeI32(layout.constellationId, constellationIds)

  view.setUint32(layout.strings, strings.length, true)
  const bytes = new Uint8Array(buffer)
  let cursor = 0
  const dataStart = layout.strings + stringHeaderBytes
  strings.forEach((s, i) => {
    view.setUint32(layout.strings + 4 + i * 4, cursor, true)
    bytes.set(s, dataStart + cursor)
    cursor += s.length
  })
  view.setUint32(layout.strings + 4 + strings.length * 4, cursor, true)

  return buffer
}

/**
 * Decodes the binary layout. Typed arrays are views over the input buffer, not copies. A `Uint8Array`
 * whose `byteOffset` is not 4-byte aligned (e.g. a pooled Node `Buffer`) is copied once first.
 */
export const decodeMapData = (input: ArrayBuffer | ArrayBufferView): MapData => {
  if (!isLittleEndian()) {
    throw new MapDataError('decodeMapData requires a little-endian host.')
  }

  let buffer: ArrayBufferLike
  let base: number
  let length: number
  if (ArrayBuffer.isView(input)) {
    if (input.byteOffset % 4 === 0) {
      buffer = input.buffer
      base = input.byteOffset
    } else {
      buffer = new Uint8Array(input.buffer, input.byteOffset, input.byteLength).slice().buffer
      base = 0
    }
    length = input.byteLength
  } else {
    buffer = input
    base = 0
    length = input.byteLength
  }

  if (length < HEADER_BYTES) {
    throw new MapDataError('Map data is too short.')
  }

  const view = new DataView(buffer, base, length)
  if (view.getUint32(0, true) !== MAP_DATA_MAGIC) {
    throw new MapDataError('Map data magic mismatch, expected "EVEM".')
  }
  const n = view.getUint32(4, true)
  const gateCount = view.getUint32(8, true)
  const regionCount = view.getUint32(12, true)
  const constellationCount = view.getUint32(16, true)
  const layout = computeLayout(n, gateCount, regionCount, constellationCount)

  if (layout.strings + 4 > length) {
    throw new MapDataError('Map data is truncated.')
  }

  const f32 = (offset: number, count: number) => new Float32Array(buffer, base + offset, count)
  const i32 = (offset: number, count: number) => new Int32Array(buffer, base + offset, count)

  const stringCount = view.getUint32(layout.strings, true)
  if (stringCount !== n + regionCount + constellationCount) {
    throw new MapDataError(`String table has ${stringCount} entries, expected ${n + regionCount + constellationCount}.`)
  }
  const offsets = new Uint32Array(buffer, base + layout.strings + 4, stringCount + 1)
  const dataStart = layout.strings + 4 + (stringCount + 1) * 4
  if (dataStart + offsets[stringCount] > length) {
    throw new MapDataError('String table is truncated.')
  }
  const decoder = new TextDecoder()
  const bytes = new Uint8Array(buffer, base + dataStart, offsets[stringCount])
  const readStrings = (start: number, count: number) =>
    Array.from({ length: count }, (_, i) => decoder.decode(bytes.subarray(offsets[start + i], offsets[start + i + 1])))

  const names = (ids: Int32Array, start: number): Record<number, string> => {
    const values = readStrings(start, ids.length)
    return Object.fromEntries(Array.from(ids, (id, i) => [id, values[i]]))
  }

  const data: MapData = {
    systems: {
      id: i32(layout.id, n),
      constellation: i32(layout.constellation, n),
      region: i32(layout.region, n),
      position: f32(layout.position, n * 3),
      position2d: f32(layout.position2d, n * 2),
      security: f32(layout.security, n),
      name: readStrings(0, n),
    },
    gates: new Uint16Array(buffer, base + layout.gates, gateCount * 2),
    bounds: {
      position: f32(layout.boundsPosition, 6),
      position2d: f32(layout.boundsPosition2d, 4),
    },
    regions: names(i32(layout.regionId, regionCount), n),
    constellations: names(i32(layout.constellationId, constellationCount), n + regionCount),
  }

  validateMapData(data)
  return data
}
