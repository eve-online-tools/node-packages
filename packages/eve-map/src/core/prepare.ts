import type { MapData } from '../data/types'

/** Render-ready typed arrays derived from `MapData`. Index `i` is `data.systems[i]`. */
export interface PreparedMap {
  id: Int32Array
  region: Int32Array
  constellation: Int32Array
  security: Float32Array
  name: string[]
  /** Scene xyz per system, normalized */
  position: Float32Array
  /** Scene xz per system, normalized */
  position2d: Float32Array
  /** Deduplicated index pairs, `a < b` */
  gates: Uint32Array
  /** System index for an ID, or -1 */
  indexOf: (systemId: number) => number
  systemsInRegion: (regionId: number) => number[]
  systemsInConstellation: (constellationId: number) => number[]
}

/**
 * Centers interleaved `values` on the origin and scales uniformly so the largest half extent is 1.
 * Keeps the GPU away from 1e17 meter values and gives both layouts the same on-screen size.
 */
export const normalizeInPlace = (values: Float32Array, stride: number): void => {
  const count = values.length / stride
  if (count === 0) {
    return
  }
  const min = new Float64Array(stride).fill(Infinity)
  const max = new Float64Array(stride).fill(-Infinity)
  for (let i = 0; i < values.length; i++) {
    const c = i % stride
    min[c] = Math.min(min[c], values[i])
    max[c] = Math.max(max[c], values[i])
  }
  let halfExtent = 0
  for (let c = 0; c < stride; c++) {
    halfExtent = Math.max(halfExtent, (max[c] - min[c]) / 2)
  }
  const scale = halfExtent > 0 ? 1 / halfExtent : 1
  for (let i = 0; i < values.length; i++) {
    const c = i % stride
    values[i] = (values[i] - (min[c] + max[c]) / 2) * scale
  }
}

const group = (keys: Int32Array): Map<number, number[]> => {
  const groups = new Map<number, number[]>()
  keys.forEach((key, i) => {
    const list = groups.get(key)
    if (list) {
      list.push(i)
    } else {
      groups.set(key, [i])
    }
  })
  return groups
}

export const prepareMap = (data: MapData): PreparedMap => {
  const { systems } = data
  const n = systems.length
  const byId = new Map(systems.map((s, i) => [s.id, i]))

  // SDE universe space is left-handed, scene space right-handed: (x, y, z) -> (x, y, -z).
  // SDE 2D y follows universe +z, so 2D (x, y) -> scene (x, -y).
  const position = new Float32Array(n * 3)
  systems.forEach((s, i) => position.set([s.position.x, s.position.y, -s.position.z], i * 3))
  normalizeInPlace(position, 3)

  const with2d = systems.filter((s) => s.position2d)
  const position2d = new Float32Array(n * 2)
  if (with2d.length === 0) {
    systems.forEach((_, i) => position2d.set([position[i * 3], position[i * 3 + 2]], i * 2))
  } else {
    const present = new Float32Array(with2d.length * 2)
    with2d.forEach((s, k) => present.set([s.position2d!.x, -s.position2d!.y], k * 2))
    normalizeInPlace(present, 2)
    let k = 0
    systems.forEach((s, i) => {
      if (s.position2d) {
        position2d.set(present.subarray(k * 2, k * 2 + 2), i * 2)
        k++
      } else {
        position2d.set([position[i * 3], position[i * 3 + 2]], i * 2)
      }
    })
  }

  const pairs = new Set<number>()
  systems.forEach((s, a) => {
    for (const target of s.gates) {
      const b = byId.get(target)
      if (b !== undefined && b !== a) {
        pairs.add(Math.min(a, b) * n + Math.max(a, b))
      }
    }
  })
  const gates = new Uint32Array(pairs.size * 2)
  let g = 0
  for (const key of pairs) {
    gates[g++] = Math.floor(key / n)
    gates[g++] = key % n
  }

  const region = Int32Array.from(systems, (s) => s.regionId)
  const constellation = Int32Array.from(systems, (s) => s.constellationId)
  let byRegion: Map<number, number[]> | undefined
  let byConstellation: Map<number, number[]> | undefined

  return {
    id: Int32Array.from(systems, (s) => s.id),
    region,
    constellation,
    security: Float32Array.from(systems, (s) => s.security),
    name: systems.map((s) => s.name),
    position,
    position2d,
    gates,
    indexOf: (systemId) => byId.get(systemId) ?? -1,
    systemsInRegion: (regionId) => (byRegion ??= group(region)).get(regionId) ?? [],
    systemsInConstellation: (constellationId) => (byConstellation ??= group(constellation)).get(constellationId) ?? [],
  }
}
