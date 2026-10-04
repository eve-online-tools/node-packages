import type { MapData } from './types'
import { MapDataError, validateMapData } from './validate'

/** Plain JSON shape of `MapData`, typed arrays as number arrays. */
export interface MapDataJson {
  systems: {
    id: number[]
    constellation: number[]
    region: number[]
    position: number[]
    position2d: number[]
    security: number[]
    name: string[]
  }
  gates: number[]
  regions: Record<number, string>
  constellations: Record<number, string>
  bounds: { position: number[]; position2d: number[] }
}

export const mapDataToJson = (data: MapData): MapDataJson => ({
  systems: {
    id: Array.from(data.systems.id),
    constellation: Array.from(data.systems.constellation),
    region: Array.from(data.systems.region),
    position: Array.from(data.systems.position),
    position2d: Array.from(data.systems.position2d),
    security: Array.from(data.systems.security),
    name: [...data.systems.name],
  },
  gates: Array.from(data.gates),
  regions: { ...data.regions },
  constellations: { ...data.constellations },
  bounds: { position: Array.from(data.bounds.position), position2d: Array.from(data.bounds.position2d) },
})

/** Accepts a `MapDataJson` object or its string form. Validates and throws `MapDataError` on bad input. */
export const mapDataFromJson = (input: MapDataJson | string): MapData => {
  const json = (typeof input === 'string' ? JSON.parse(input) : input) as MapDataJson
  if (!json || typeof json !== 'object' || !json.systems || !json.bounds) {
    throw new MapDataError('Map data JSON is missing "systems" or "bounds".')
  }

  const data: MapData = {
    systems: {
      id: Int32Array.from(json.systems.id),
      constellation: Int32Array.from(json.systems.constellation),
      region: Int32Array.from(json.systems.region),
      position: Float32Array.from(json.systems.position),
      position2d: Float32Array.from(json.systems.position2d),
      security: Float32Array.from(json.systems.security),
      name: [...json.systems.name],
    },
    gates: Uint16Array.from(json.gates),
    regions: { ...json.regions },
    constellations: { ...json.constellations },
    bounds: {
      position: Float32Array.from(json.bounds.position),
      position2d: Float32Array.from(json.bounds.position2d),
    },
  }
  validateMapData(data)
  return data
}
