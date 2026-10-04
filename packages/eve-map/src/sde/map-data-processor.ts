import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

import type { SdeProcessor } from '@eve-online-tools/eve-sde'

import { encodeMapData } from '../data/binary'
import type { MapData, MapSystem } from '../data/types'

/** Bump when the processor output changes, so eve-sde regenerates it. */
const PROCESSOR_REVISION = 3

export interface MapDataProcessorOptions {
  /** Name locale. Falls back to `en` when missing. Default `en`. */
  locale?: string
  /** Default: IDs 30,000,000 to 30,999,999 (known space, the in-game map) */
  systems?: (system: MapSystem) => boolean
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

export const isKnownSpace = (system: MapSystem): boolean => system.id >= 30_000_000 && system.id < 31_000_000

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
      const systems = new Map<number, MapSystem>()
      const regionIds = new Set<number>()
      const constellationIds = new Set<number>()

      for await (const record of loadStream('mapSolarSystems')) {
        const row = record.value as SolarSystemRow
        const system: MapSystem = {
          id: Number(record.key),
          name: pickName(row.name, locale),
          regionId: row.regionID,
          constellationId: row.constellationID,
          security: row.securityStatus,
          position: row.position,
          position2d: row.position2D,
          gates: [],
        }
        if (!filter(system)) {
          continue
        }
        regionIds.add(system.regionId)
        constellationIds.add(system.constellationId)
        systems.set(system.id, system)
      }

      for await (const record of loadStream('mapStargates')) {
        const { solarSystemID, destination } = record.value as StargateRow
        if (systems.has(destination.solarSystemID)) {
          systems.get(solarSystemID)?.gates.push(destination.solarSystemID)
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

      const data: MapData = {
        systems: [...systems.values()].sort((a, b) => a.id - b.id),
        regions: await loadNames('mapRegions', regionIds),
        constellations: await loadNames('mapConstellations', constellationIds),
      }

      if (format === 'json') {
        await writeJson(fileName, data)
      } else {
        const path = resolve(fileName)
        await mkdir(dirname(path), { recursive: true })
        await writeFile(path, new Uint8Array(encodeMapData(data)))
      }

      return { fileName, systems: data.systems.length }
    },
  }
}
