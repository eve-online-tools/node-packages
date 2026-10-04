import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { SdeProcessor } from '@eve-online-tools/eve-sde'

import { buildMapData } from '../data/build'
import { encodeMapData } from '../data/binary'
import { mapDataToJson } from '../data/json'
import type { MapSystemSource } from '../data/types'

/** Bump when the processor output changes, so eve-sde regenerates it. */
const PROCESSOR_REVISION = 2

export interface SdeSolarSystem {
  id: number
  constellationId: number
  regionId: number
  security: number
  name: string
}

export interface MapDataProcessorOptions {
  /** Name locale. Falls back to `en` when missing. Default `en`. */
  locale?: string
  /** Default: IDs 30,000,000 to 30,999,999 (known space, the in-game map) */
  systems?: (system: SdeSolarSystem) => boolean
  /** Default `binary` */
  format?: 'binary' | 'json'
  /** Output file relative to `outputDir`. Default `map-data.bin` or `map-data.json`. */
  fileName?: string
  /** Processor id. Default `eve-map:map-data` */
  id?: string
}

type Translated = Record<string, string>

interface SolarSystemRow {
  constellationID: number
  regionID: number
  name: Translated
  position: { x: number; y: number; z: number }
  position2D?: { x: number; y: number }
  securityStatus: number
}

/** Shape of a `mapStargates` row in the SDE */
interface StargateRow {
  solarSystemID: number
  destination: { solarSystemID: number }
}

export const isKnownSpace = (system: SdeSolarSystem): boolean => system.id >= 30_000_000 && system.id < 31_000_000

const pickName = (name: Translated, locale: string): string => name[locale] ?? name.en

const hashString = (value: string): string => {
  let hash = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 0x01000193)
  }
  return (hash >>> 0).toString(16)
}

/**
 * Streams `mapSolarSystems`, `mapStargates`, `mapRegions` and `mapConstellations` and writes a `MapData` file.
 * Returns the written file name for later processors.
 */
export const mapDataProcessor = (options: MapDataProcessorOptions = {}): SdeProcessor => {
  const locale = options.locale ?? 'en'
  const format = options.format ?? 'binary'
  const filter = options.systems ?? isKnownSpace
  const fileName = options.fileName ?? (format === 'binary' ? 'map-data.bin' : 'map-data.json')

  return {
    id: options.id ?? 'eve-map:map-data',
    // The filter source is hashed so editing it invalidates the lock.
    version: [PROCESSOR_REVISION, locale, format, fileName, hashString(String(filter))].join(':'),
    run: async ({ loadStream, resolve, writeJson }) => {
      const systems: MapSystemSource[] = []
      const keep = new Set<number>()
      const regionIds = new Set<number>()
      const constellationIds = new Set<number>()

      for await (const record of loadStream('mapSolarSystems')) {
        const row = record.value as SolarSystemRow
        const system: SdeSolarSystem = {
          id: Number(record.key),
          constellationId: row.constellationID,
          regionId: row.regionID,
          security: row.securityStatus,
          name: pickName(row.name, locale),
        }
        if (!filter(system)) {
          continue
        }
        keep.add(system.id)
        regionIds.add(system.regionId)
        constellationIds.add(system.constellationId)
        systems.push({ ...system, position: row.position, position2d: row.position2D })
      }

      const gates: Array<[number, number]> = []
      for await (const record of loadStream('mapStargates')) {
        const { solarSystemID: from, destination } = record.value as StargateRow
        if (keep.has(from) && keep.has(destination.solarSystemID)) {
          gates.push([from, destination.solarSystemID])
        }
      }

      const loadNames = async (table: string, ids: Set<number>) => {
        const names: Record<number, string> = {}
        for await (const record of loadStream(table)) {
          const id = Number(record.key)
          if (ids.has(id)) {
            names[id] = pickName((record.value as { name: Translated }).name, locale)
          }
        }
        return names
      }
      const regions = await loadNames('mapRegions', regionIds)
      const constellations = await loadNames('mapConstellations', constellationIds)

      const data = buildMapData({ systems, gates, regions, constellations })

      if (format === 'json') {
        await writeJson(fileName, mapDataToJson(data))
      } else {
        const path = resolve(fileName)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, new Uint8Array(encodeMapData(data)))
      }

      return { fileName, systems: data.systems.id.length, gates: data.gates.length / 2 }
    },
  }
}
