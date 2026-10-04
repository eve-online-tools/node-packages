import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import type { SdeJsonlRecord, SdeProcessorContext } from '@eve-online-tools/eve-sde'

import { decodeMapData } from '../data/binary'
import { mapDataFromJson } from '../data/json'
import { mapDataProcessor } from './map-data-processor'

const name = (en: string) => ({ en, de: `${en} (de)` })

const TABLES: Record<string, Array<Record<string, unknown>>> = {
  mapSolarSystems: [
    {
      _key: 30000002,
      constellationID: 20000001,
      regionID: 10000001,
      name: name('Lashesih'),
      position: { x: 2e16, y: 1e15, z: 3e16 },
      position2D: { x: 2e16, y: 3e16 },
      securityStatus: 0.75,
    },
    {
      _key: 30000001,
      constellationID: 20000001,
      regionID: 10000001,
      name: name('Tanoo'),
      position: { x: -1e16, y: 0, z: -1e16 },
      position2D: { x: -1e16, y: -1e16 },
      securityStatus: 0.86,
    },
    {
      _key: 30000003,
      constellationID: 20000002,
      regionID: 10000002,
      name: name('Akpivem'),
      position: { x: 4e16, y: -1e15, z: 0 },
      position2D: { x: 4e16, y: 0 },
      securityStatus: 0.46,
    },
    {
      _key: 31000005,
      constellationID: 21000001,
      regionID: 11000001,
      name: name('J123456'),
      position: { x: 9e17, y: 0, z: 9e17 },
      securityStatus: -1,
    },
  ],
  mapStargates: [
    { _key: 50000001, solarSystemID: 30000001, destination: { solarSystemID: 30000002, stargateID: 50000002 } },
    { _key: 50000002, solarSystemID: 30000002, destination: { solarSystemID: 30000001, stargateID: 50000001 } },
    { _key: 50000003, solarSystemID: 30000002, destination: { solarSystemID: 30000003, stargateID: 50000004 } },
    { _key: 50000004, solarSystemID: 30000003, destination: { solarSystemID: 30000002, stargateID: 50000003 } },
  ],
  mapRegions: [
    { _key: 10000001, name: name('Derelik') },
    { _key: 10000002, name: name('The Forge') },
    { _key: 11000001, name: name('A-R00001') },
  ],
  mapConstellations: [
    { _key: 20000001, regionID: 10000001, name: name('San Matar') },
    { _key: 20000002, regionID: 10000002, name: name('Kimotoro') },
    { _key: 21000001, regionID: 11000001, name: name('A-C00001') },
  ],
}

async function* stream(table: string): AsyncGenerator<SdeJsonlRecord> {
  const rows = TABLES[table]
  if (!rows) {
    throw new Error(`Unexpected table ${table}`)
  }
  for (const { _key, ...value } of rows) {
    yield { key: _key as number, value, kind: 'object' }
  }
}

describe('mapDataProcessor', () => {
  let outputDir: string
  let ctx: SdeProcessorContext
  const loaded: string[] = []

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'eve-map-'))
    loaded.length = 0
    ctx = {
      buildNumber: '1',
      load: () => Promise.reject(new Error('use loadStream')),
      loadStream: (table) => {
        loaded.push(table)
        return stream(table)
      },
      generated: () => undefined,
      generatedStream: () => stream(''),
      resolve: (...segments) => join(outputDir, ...segments),
      writeJson: async () => {},
      writeText: async () => {},
      streamJson: () => Promise.reject(new Error('unused')),
      streamText: () => Promise.reject(new Error('unused')),
    }
  })

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true })
  })

  it('streams the map tables and writes binary map data for known space', async () => {
    const result = await mapDataProcessor().run(ctx)

    expect(loaded).toEqual(['mapSolarSystems', 'mapStargates', 'mapRegions', 'mapConstellations'])
    expect(result).toEqual({ fileName: 'map-data.bin', systems: 3, gates: 2 })

    const data = decodeMapData(await readFile(join(outputDir, 'map-data.bin')))
    expect(Array.from(data.systems.id)).toEqual([30000001, 30000002, 30000003])
    expect(data.systems.name).toEqual(['Tanoo', 'Lashesih', 'Akpivem'])
    expect(Array.from(data.systems.security)).toEqual([0.86, 0.75, 0.46].map(Math.fround))
    expect(Array.from(data.gates)).toEqual([0, 1, 1, 2])
    expect(data.regions?.name).toEqual(['Derelik', 'The Forge'])
    expect(data.constellations?.name).toEqual(['San Matar', 'Kimotoro'])
  })

  it('honours locale, system filter and JSON format', async () => {
    let written: unknown
    ctx.writeJson = async (_path, value) => {
      written = value
    }
    const processor = mapDataProcessor({ locale: 'de', format: 'json', systems: (s) => s.regionId === 10000001 })
    await processor.run(ctx)

    const data = mapDataFromJson(JSON.parse(JSON.stringify(written)))
    expect(data.systems.name).toEqual(['Tanoo (de)', 'Lashesih (de)'])
    expect(data.regions?.name).toEqual(['Derelik (de)'])
  })

  it('changes version with format and filter so the lock invalidates', () => {
    const base = mapDataProcessor().version
    expect(mapDataProcessor({ format: 'json' }).version).not.toBe(base)
    expect(mapDataProcessor({ systems: () => true }).version).not.toBe(base)
    expect(mapDataProcessor().version).toBe(base)
  })
})
