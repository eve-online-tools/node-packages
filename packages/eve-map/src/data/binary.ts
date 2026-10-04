import type { MapData, MapSystem } from './types'
import { MapDataError, validateMapData } from './validate'

/** "EVEM" read as a little-endian uint32 */
export const MAP_DATA_MAGIC = 0x4d455645
export const HEADER_BYTES = 20

const align4 = (n: number): number => (n + 3) & ~3

const computeLayout = (n: number, gateCount: number, regionCount: number, constellationCount: number) => {
  let offset = HEADER_BYTES
  const take = (bytes: number): number => {
    const start = offset
    offset = align4(offset + bytes)
    return start
  }
  return {
    id: take(n * 4),
    constellationId: take(n * 4),
    position: take(n * 12),
    position2d: take(n * 8),
    security: take(n * 4),
    gateCount: take(n * 2),
    gates: take(gateCount * 4),
    constellations: take(constellationCount * 4),
    constellationRegions: take(constellationCount * 4),
    regions: take(regionCount * 4),
    strings: offset,
  }
}

/** Encodes `MapData` into the binary layout documented in the README. Throws `MapDataError` on invalid input. */
export const encodeMapData = (data: MapData): ArrayBuffer => {
  validateMapData(data)

  const { systems } = data
  const n = systems.length
  const constellationIds = Object.keys(data.constellations).map(Number)
  const regionIds = Object.keys(data.regions).map(Number)
  const gateCount = systems.reduce((sum, s) => sum + s.gates.length, 0)
  const layout = computeLayout(n, gateCount, regionIds.length, constellationIds.length)

  const encoder = new TextEncoder()
  const strings = [
    ...systems.map((s) => s.name),
    ...constellationIds.map((id) => data.constellations[id].name),
    ...regionIds.map((id) => data.regions[id]),
  ].map((s) => encoder.encode(s))
  const stringBytes = strings.reduce((sum, s) => sum + s.length, 0)
  const stringHeaderBytes = 4 + (strings.length + 1) * 4

  const buffer = new ArrayBuffer(align4(layout.strings + stringHeaderBytes + stringBytes))
  const view = new DataView(buffer)
  view.setUint32(0, MAP_DATA_MAGIC, true)
  view.setUint32(4, n, true)
  view.setUint32(8, gateCount, true)
  view.setUint32(12, constellationIds.length, true)
  view.setUint32(16, regionIds.length, true)

  let gate = layout.gates
  systems.forEach((s, i) => {
    view.setInt32(layout.id + i * 4, s.id, true)
    view.setInt32(layout.constellationId + i * 4, s.constellationId, true)
    view.setFloat32(layout.position + i * 12, s.position.x, true)
    view.setFloat32(layout.position + i * 12 + 4, s.position.y, true)
    view.setFloat32(layout.position + i * 12 + 8, s.position.z, true)
    view.setFloat32(layout.position2d + i * 8, s.position2d?.x ?? NaN, true)
    view.setFloat32(layout.position2d + i * 8 + 4, s.position2d?.y ?? NaN, true)
    view.setFloat32(layout.security + i * 4, s.security, true)
    view.setUint16(layout.gateCount + i * 2, s.gates.length, true)
    for (const target of s.gates) {
      view.setInt32(gate, target, true)
      gate += 4
    }
  })
  constellationIds.forEach((id, i) => {
    view.setInt32(layout.constellations + i * 4, id, true)
    view.setInt32(layout.constellationRegions + i * 4, data.constellations[id].regionId, true)
  })
  regionIds.forEach((id, i) => view.setInt32(layout.regions + i * 4, id, true))

  view.setUint32(layout.strings, strings.length, true)
  const bytes = new Uint8Array(buffer)
  const dataStart = layout.strings + stringHeaderBytes
  let cursor = 0
  strings.forEach((s, i) => {
    view.setUint32(layout.strings + 4 + i * 4, cursor, true)
    bytes.set(s, dataStart + cursor)
    cursor += s.length
  })
  view.setUint32(layout.strings + 4 + strings.length * 4, cursor, true)

  return buffer
}

/** Decodes the binary layout documented in the README. Throws `MapDataError` on malformed input. */
export const decodeMapData = (input: ArrayBuffer | ArrayBufferView): MapData => {
  const view = ArrayBuffer.isView(input)
    ? new DataView(input.buffer, input.byteOffset, input.byteLength)
    : new DataView(input)
  const length = view.byteLength

  if (length < HEADER_BYTES) {
    throw new MapDataError('Map data is too short.')
  }
  if (view.getUint32(0, true) !== MAP_DATA_MAGIC) {
    throw new MapDataError('Map data magic mismatch, expected "EVEM".')
  }

  const n = view.getUint32(4, true)
  const gateCount = view.getUint32(8, true)
  const constellationCount = view.getUint32(12, true)
  const regionCount = view.getUint32(16, true)
  const layout = computeLayout(n, gateCount, regionCount, constellationCount)

  const stringCount = n + regionCount + constellationCount
  const dataStart = layout.strings + 4 + (stringCount + 1) * 4
  if (dataStart > length || view.getUint32(layout.strings, true) !== stringCount) {
    throw new MapDataError('Map data is truncated or malformed.')
  }
  const offset = (i: number) => view.getUint32(layout.strings + 4 + i * 4, true)
  if (dataStart + offset(stringCount) > length) {
    throw new MapDataError('String table is truncated.')
  }
  const decoder = new TextDecoder()
  const string = (i: number) =>
    decoder.decode(new Uint8Array(view.buffer, view.byteOffset + dataStart + offset(i), offset(i + 1) - offset(i)))

  let gate = layout.gates
  const systems: MapSystem[] = Array.from({ length: n }, (_, i) => {
    const x2d = view.getFloat32(layout.position2d + i * 8, true)
    const gates = Array.from({ length: view.getUint16(layout.gateCount + i * 2, true) }, () => {
      const target = view.getInt32(gate, true)
      gate += 4
      return target
    })
    return {
      id: view.getInt32(layout.id + i * 4, true),
      name: string(i),
      constellationId: view.getInt32(layout.constellationId + i * 4, true),
      security: view.getFloat32(layout.security + i * 4, true),
      position: {
        x: view.getFloat32(layout.position + i * 12, true),
        y: view.getFloat32(layout.position + i * 12 + 4, true),
        z: view.getFloat32(layout.position + i * 12 + 8, true),
      },
      position2d: Number.isNaN(x2d) ? undefined : { x: x2d, y: view.getFloat32(layout.position2d + i * 8 + 4, true) },
      gates,
    }
  })

  const data: MapData = {
    systems,
    constellations: Object.fromEntries(
      Array.from({ length: constellationCount }, (_, i) => [
        view.getInt32(layout.constellations + i * 4, true),
        { name: string(n + i), regionId: view.getInt32(layout.constellationRegions + i * 4, true) },
      ]),
    ),
    regions: Object.fromEntries(
      Array.from({ length: regionCount }, (_, i) => [
        view.getInt32(layout.regions + i * 4, true),
        string(n + constellationCount + i),
      ]),
    ),
  }
  validateMapData(data)
  return data
}
