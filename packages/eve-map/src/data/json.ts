import { MAP_DATA_VERSION, type MapData } from './types'
import { MapDataError, validateMapData } from './validate'

/** Plain JSON shape of `MapData`, typed arrays as number arrays. */
export interface MapDataJson {
  version: typeof MAP_DATA_VERSION
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
  regions?: { id: number[]; name: string[] }
  constellations?: { id: number[]; region: number[]; name: string[] }
  bounds: { position: number[]; position2d: number[] }
}

export const mapDataToJson = (data: MapData): MapDataJson => {
  const json: MapDataJson = {
    version: data.version,
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
    bounds: { position: Array.from(data.bounds.position), position2d: Array.from(data.bounds.position2d) },
  }
  if (data.regions) {
    json.regions = { id: Array.from(data.regions.id), name: [...data.regions.name] }
  }
  if (data.constellations) {
    json.constellations = {
      id: Array.from(data.constellations.id),
      region: Array.from(data.constellations.region),
      name: [...data.constellations.name],
    }
  }
  return json
}

/** Accepts a `MapDataJson` object or its string form. Validates and throws `MapDataError` on bad input. */
export const mapDataFromJson = (input: MapDataJson | string): MapData => {
  const json = (typeof input === 'string' ? JSON.parse(input) : input) as MapDataJson
  if (!json || typeof json !== 'object' || !json.systems || !json.bounds) {
    throw new MapDataError('Map data JSON is missing "systems" or "bounds".')
  }

  const data: MapData = {
    version: json.version,
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
    bounds: {
      position: Float32Array.from(json.bounds.position),
      position2d: Float32Array.from(json.bounds.position2d),
    },
  }
  if (json.regions) {
    data.regions = { id: Int32Array.from(json.regions.id), name: [...json.regions.name] }
  }
  if (json.constellations) {
    data.constellations = {
      id: Int32Array.from(json.constellations.id),
      region: Int32Array.from(json.constellations.region),
      name: [...json.constellations.name],
    }
  }
  validateMapData(data)
  return data
}
