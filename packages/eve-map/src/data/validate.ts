import { MAX_SYSTEMS } from './build'
import type { MapData } from './types'

export class MapDataError extends Error {
  override name = 'MapDataError'
}

const expectLength = (label: string, actual: number, expected: number): void => {
  if (actual !== expected) {
    throw new MapDataError(`${label}: expected length ${expected}, got ${actual}.`)
  }
}

const expectFinite = (label: string, values: ArrayLike<number>): void => {
  for (let i = 0; i < values.length; i++) {
    if (!Number.isFinite(values[i])) {
      throw new MapDataError(`${label}[${i}] is not finite.`)
    }
  }
}

/** Throws `MapDataError` when `data` is structurally invalid. */
export const validateMapData = (data: MapData): void => {
  const { systems, gates, bounds } = data
  const n = systems.id.length
  if (n > MAX_SYSTEMS) {
    throw new MapDataError(`${n} systems exceeds the Uint16 gate index limit of ${MAX_SYSTEMS}.`)
  }

  expectLength('systems.constellation', systems.constellation.length, n)
  expectLength('systems.region', systems.region.length, n)
  expectLength('systems.position', systems.position.length, n * 3)
  expectLength('systems.position2d', systems.position2d.length, n * 2)
  expectLength('systems.security', systems.security.length, n)
  expectLength('systems.name', systems.name.length, n)
  expectLength('bounds.position', bounds.position.length, 6)
  expectLength('bounds.position2d', bounds.position2d.length, 4)
  expectFinite('systems.position', systems.position)
  expectFinite('systems.position2d', systems.position2d)

  if (!(gates instanceof Uint16Array)) {
    throw new MapDataError('gates must be a Uint16Array.')
  }
  if (gates.length % 2 !== 0) {
    throw new MapDataError('gates must contain index pairs.')
  }
  const seen = new Set<number>()
  for (let i = 0; i < gates.length; i += 2) {
    const a = gates[i]
    const b = gates[i + 1]
    if (a >= b || b >= n) {
      throw new MapDataError(`gates[${i / 2}] = (${a}, ${b}) must satisfy a < b < ${n}.`)
    }
    const key = a * MAX_SYSTEMS + b
    if (seen.has(key)) {
      throw new MapDataError(`gates[${i / 2}] = (${a}, ${b}) is duplicated.`)
    }
    seen.add(key)
  }
}
