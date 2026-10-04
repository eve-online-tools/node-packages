import type { MapData } from './types'

export interface MapIndex {
  /** System index for a solar system ID, or -1 */
  indexOf: (systemId: number) => number
  systemsInRegion: (regionId: number) => number[]
  systemsInConstellation: (constellationId: number) => number[]
  regionName: (regionId: number) => string | undefined
  constellationName: (constellationId: number) => string | undefined
}

const group = (keys: Int32Array): Map<number, number[]> => {
  const groups = new Map<number, number[]>()
  for (let i = 0; i < keys.length; i++) {
    const list = groups.get(keys[i])
    if (list) {
      list.push(i)
    } else {
      groups.set(keys[i], [i])
    }
  }
  return groups
}

export const createMapIndex = (data: MapData): MapIndex => {
  const byId = new Map<number, number>()
  data.systems.id.forEach((id, i) => byId.set(id, i))
  let byRegion: Map<number, number[]> | undefined
  let byConstellation: Map<number, number[]> | undefined
  let regionNames: Map<number, string> | undefined
  let constellationNames: Map<number, string> | undefined

  return {
    indexOf: (systemId) => byId.get(systemId) ?? -1,
    systemsInRegion: (regionId) => {
      byRegion ??= group(data.systems.region)
      return byRegion.get(regionId) ?? []
    },
    systemsInConstellation: (constellationId) => {
      byConstellation ??= group(data.systems.constellation)
      return byConstellation.get(constellationId) ?? []
    },
    regionName: (regionId) => {
      if (!data.regions) {
        return undefined
      }
      const { id, name } = data.regions
      regionNames ??= new Map(Array.from(id, (rid, i) => [rid, name[i]]))
      return regionNames.get(regionId)
    },
    constellationName: (constellationId) => {
      if (!data.constellations) {
        return undefined
      }
      const { id, name } = data.constellations
      constellationNames ??= new Map(Array.from(id, (cid, i) => [cid, name[i]]))
      return constellationNames.get(constellationId)
    },
  }
}
