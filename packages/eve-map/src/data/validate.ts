import type { MapData } from './types'

export class MapDataError extends Error {
  override name = 'MapDataError'
}

/** Throws `MapDataError` on duplicate system IDs, unknown constellations or non-finite positions. */
export const validateMapData = (data: MapData): void => {
  const ids = new Set<number>()
  for (const system of data.systems) {
    if (ids.has(system.id)) {
      throw new MapDataError(`Duplicate system ID ${system.id}.`)
    }
    ids.add(system.id)
    if (!data.constellations[system.constellationId]) {
      throw new MapDataError(`System ${system.id} references unknown constellation ${system.constellationId}.`)
    }
    const { position: p, position2d: p2 } = system
    if (![p.x, p.y, p.z].every(Number.isFinite) || (p2 && ![p2.x, p2.y].every(Number.isFinite))) {
      throw new MapDataError(`System ${system.id} has a non-finite position.`)
    }
  }
}
