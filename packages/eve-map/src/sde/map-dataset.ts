import { defineDataset, type Localized } from '@eve-online-tools/eve-sde'

import { encodeMapData } from '../data/binary'
import type { MapData, MapSystem } from '../data/types'

/** Bump when the dataset output changes for the same inputs. */
const REVISION = 5

export type Locale = keyof Localized

export interface MapDatasetOptions {
  /** Name locale. Falls back to `en` when missing. Default `en`. */
  locale?: Locale
  /** Default: IDs 30,000,000 to 30,999,999 (known space, the in-game map) */
  systems?: (system: MapSystem) => boolean
}

export const isKnownSpace = (system: MapSystem): boolean => system.id >= 30_000_000 && system.id < 31_000_000

const pickName = (name: Localized, locale: Locale): string => name[locale] ?? name.en

const hashString = (value: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

/**
 * Builds binary `MapData` from the SDE map tables. Importing `eve-sde:dataset/eve-map:map-data` yields
 * `{ url, systems }`, where `url` points at the emitted `map-data.bin` for `EveMap`.
 */
export const mapDataset = (options: MapDatasetOptions = {}) => {
  const locale = options.locale ?? 'en'
  const filter = options.systems ?? isKnownSpace

  return defineDataset({
    id: 'eve-map:map-data',
    // The filter source is hashed so editing it rebuilds the dataset.
    version: [REVISION, locale, hashString(String(filter))].join(':'),
    tables: ['mapSolarSystems', 'mapStargates', 'mapConstellations', 'mapRegions'],
    build: async ({ table, emit }) => {
      const systems = new Map<number, MapSystem>()
      const constellationIds = new Set<number>()

      for await (const row of table('mapSolarSystems').list({
        fields: ['solarSystemID', 'constellationID', 'name', 'position', 'position2D', 'securityStatus'],
      })) {
        const system: MapSystem = {
          id: row.solarSystemID,
          name: pickName(row.name, locale),
          constellationId: row.constellationID,
          security: row.securityStatus,
          position: row.position,
          position2d: row.position2D,
          gates: [],
        }
        if (filter(system)) {
          constellationIds.add(system.constellationId)
          systems.set(system.id, system)
        }
      }

      for await (const { solarSystemID, destination } of table('mapStargates').list({
        fields: ['solarSystemID', 'destination'],
      })) {
        if (systems.has(destination.solarSystemID)) {
          systems.get(solarSystemID)?.gates.push(destination.solarSystemID)
        }
      }

      const constellations: MapData['constellations'] = {}
      const regionIds = new Set<number>()
      for (const [id, row] of await table('mapConstellations').getMany(constellationIds)) {
        constellations[id] = { name: pickName(row.name, locale), regionId: row.regionID }
        regionIds.add(row.regionID)
      }

      const regions: MapData['regions'] = {}
      for (const [id, row] of await table('mapRegions').getMany(regionIds)) {
        regions[id] = pickName(row.name, locale)
      }

      const data: MapData = {
        systems: [...systems.values()].sort((a, b) => a.id - b.id),
        constellations,
        regions,
      }

      return { url: emit('map-data.bin', new Uint8Array(encodeMapData(data))), systems: data.systems.length }
    },
  })
}
