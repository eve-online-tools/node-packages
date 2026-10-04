import { MAP_DATA_VERSION, type MapData, type MapDataSource } from './types'

export const MAX_SYSTEMS = 0xffff + 1

/** SDE universe space (left-handed, Y up) to scene space (right-handed, Y up). */
export const sdeToScene = (x: number, y: number, z: number): [number, number, number] => [x, y, -z]

/** SDE `position2D` to scene `(x, z)`. SDE 2D y follows universe +z, which is scene -z. */
export const sde2dToScene = (x: number, y: number): [number, number] => [x, -y]

/**
 * Centers `values` (interleaved, `stride` components) on the origin and scales uniformly so the largest
 * half extent is 1. Returns the resulting min/max per component.
 */
export const normalizeInPlace = (values: Float32Array | Float64Array, stride: number): Float32Array => {
  const count = values.length / stride
  const min = new Float64Array(stride).fill(Infinity)
  const max = new Float64Array(stride).fill(-Infinity)

  for (let i = 0; i < count; i++) {
    for (let c = 0; c < stride; c++) {
      const v = values[i * stride + c]
      if (v < min[c]) {
        min[c] = v
      }
      if (v > max[c]) {
        max[c] = v
      }
    }
  }

  let halfExtent = 0
  const center = new Float64Array(stride)
  for (let c = 0; c < stride; c++) {
    if (count === 0) {
      break
    }
    center[c] = (min[c] + max[c]) / 2
    halfExtent = Math.max(halfExtent, (max[c] - min[c]) / 2)
  }
  const scale = halfExtent > 0 ? 1 / halfExtent : 1

  const bounds = new Float32Array(stride * 2)
  for (let c = 0; c < stride; c++) {
    bounds[c] = count === 0 ? 0 : (min[c] - center[c]) * scale
    bounds[stride + c] = count === 0 ? 0 : (max[c] - center[c]) * scale
  }

  for (let i = 0; i < count; i++) {
    for (let c = 0; c < stride; c++) {
      values[i * stride + c] = (values[i * stride + c] - center[c]) * scale
    }
  }

  return bounds
}

/** Deduplicated, sorted `a < b` index pairs. Self loops and unknown IDs are dropped. */
export const buildGateIndices = (
  pairs: Iterable<readonly [number, number]>,
  indexById: ReadonlyMap<number, number>,
): Uint16Array => {
  const keys = new Set<number>()
  for (const [fromId, toId] of pairs) {
    const a = indexById.get(fromId)
    const b = indexById.get(toId)
    if (a === undefined || b === undefined || a === b) {
      continue
    }
    keys.add(a < b ? a * MAX_SYSTEMS + b : b * MAX_SYSTEMS + a)
  }

  const sorted = [...keys].sort((x, y) => x - y)
  const gates = new Uint16Array(sorted.length * 2)
  for (let i = 0; i < sorted.length; i++) {
    gates[i * 2] = Math.floor(sorted[i] / MAX_SYSTEMS)
    gates[i * 2 + 1] = sorted[i] % MAX_SYSTEMS
  }
  return gates
}

/** Builds normalized `MapData` from SDE-shaped input. Systems are ordered by ID. */
export const buildMapData = (source: MapDataSource): MapData => {
  const systems = [...source.systems].sort((a, b) => a.id - b.id)
  const n = systems.length
  if (n > MAX_SYSTEMS) {
    throw new RangeError(`buildMapData: ${n} systems exceeds the Uint16 gate index limit of ${MAX_SYSTEMS}.`)
  }

  const id = new Int32Array(n)
  const constellation = new Int32Array(n)
  const region = new Int32Array(n)
  const security = new Float32Array(n)
  const name: string[] = Array.from({ length: n })
  const position = new Float64Array(n * 3)
  const position2d = new Float64Array(n * 2)
  const missing2d: number[] = []
  const indexById = new Map<number, number>()

  systems.forEach((system, i) => {
    if (indexById.has(system.id)) {
      throw new Error(`buildMapData: duplicate system ID ${system.id}.`)
    }
    indexById.set(system.id, i)
    id[i] = system.id
    constellation[i] = system.constellationId
    region[i] = system.regionId
    security[i] = system.security
    name[i] = system.name
    position.set(sdeToScene(system.position.x, system.position.y, system.position.z), i * 3)
    if (system.position2d) {
      position2d.set(sde2dToScene(system.position2d.x, system.position2d.y), i * 2)
    } else {
      missing2d.push(i)
    }
  })

  const has2d = missing2d.length < n
  const bounds3d = normalizeInPlace(position, 3)

  if (has2d) {
    // Keep systems without a 2D position out of the 2D bounds, then place them at their projected 3D spot.
    const present = new Float64Array((n - missing2d.length) * 2)
    const missing = new Set(missing2d)
    let k = 0
    for (let i = 0; i < n; i++) {
      if (!missing.has(i)) {
        present[k++] = position2d[i * 2]
        present[k++] = position2d[i * 2 + 1]
      }
    }
    normalizeInPlace(present, 2)
    k = 0
    for (let i = 0; i < n; i++) {
      if (missing.has(i)) {
        position2d[i * 2] = position[i * 3]
        position2d[i * 2 + 1] = position[i * 3 + 2]
      } else {
        position2d[i * 2] = present[k++]
        position2d[i * 2 + 1] = present[k++]
      }
    }
  } else {
    for (let i = 0; i < n; i++) {
      position2d[i * 2] = position[i * 3]
      position2d[i * 2 + 1] = position[i * 3 + 2]
    }
  }

  const position32 = Float32Array.from(position)
  const position2d32 = Float32Array.from(position2d)

  const data: MapData = {
    version: MAP_DATA_VERSION,
    systems: { id, constellation, region, position: position32, position2d: position2d32, security, name },
    gates: buildGateIndices(source.gates, indexById),
    bounds: { position: bounds3d, position2d: computeBounds(position2d32, 2) },
  }

  if (source.regions) {
    const regions = [...source.regions].sort((a, b) => a.id - b.id)
    data.regions = {
      id: Int32Array.from(regions, (r) => r.id),
      name: regions.map((r) => r.name),
    }
  }

  if (source.constellations) {
    const constellations = [...source.constellations].sort((a, b) => a.id - b.id)
    data.constellations = {
      id: Int32Array.from(constellations, (c) => c.id),
      region: Int32Array.from(constellations, (c) => c.regionId),
      name: constellations.map((c) => c.name),
    }
  }

  return data
}

export const computeBounds = (values: Float32Array, stride: number): Float32Array => {
  const bounds = new Float32Array(stride * 2)
  bounds.fill(Infinity, 0, stride)
  bounds.fill(-Infinity, stride)
  for (let i = 0; i < values.length; i += stride) {
    for (let c = 0; c < stride; c++) {
      bounds[c] = Math.min(bounds[c], values[i + c])
      bounds[stride + c] = Math.max(bounds[stride + c], values[i + c])
    }
  }
  if (values.length === 0) {
    bounds.fill(0)
  }
  return bounds
}
