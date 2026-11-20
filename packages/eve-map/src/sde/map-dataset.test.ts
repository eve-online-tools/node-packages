import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fixture } from '@eve-online-tools/eve-sde'
import { runDatasets, type Lockfile } from '@eve-online-tools/eve-sde/node'

import { decodeMapData } from '../data/binary'
import { mapDataset } from './map-dataset'

const name = (en: string) => ({ en, de: `${en} (de)` })

const source = fixture({
  mapSolarSystems: [
    {
      solarSystemID: 30000002,
      constellationID: 20000001,
      name: name('Lashesih'),
      position: { x: 2e16, y: 1e15, z: 3e16 },
      position2D: { x: 2e16, y: 3e16 },
      securityStatus: 0.75,
    },
    {
      solarSystemID: 30000001,
      constellationID: 20000001,
      name: name('Tanoo'),
      position: { x: -1e16, y: 0, z: -1e16 },
      position2D: { x: -1e16, y: -1e16 },
      securityStatus: 0.86,
    },
    {
      solarSystemID: 30000003,
      constellationID: 20000002,
      name: name('Akpivem'),
      position: { x: 4e16, y: -1e15, z: 0 },
      position2D: { x: 4e16, y: 0 },
      securityStatus: 0.46,
    },
    {
      solarSystemID: 31000005,
      constellationID: 21000001,
      name: name('J123456'),
      position: { x: 9e17, y: 0, z: 9e17 },
      securityStatus: -1,
    },
  ],
  mapStargates: [
    { stargateID: 50000001, solarSystemID: 30000001, destination: { solarSystemID: 30000002, stargateID: 50000002 } },
    { stargateID: 50000002, solarSystemID: 30000002, destination: { solarSystemID: 30000001, stargateID: 50000001 } },
    { stargateID: 50000003, solarSystemID: 30000002, destination: { solarSystemID: 30000003, stargateID: 50000004 } },
    { stargateID: 50000004, solarSystemID: 30000003, destination: { solarSystemID: 30000002, stargateID: 50000003 } },
  ],
  mapRegions: [
    { regionID: 10000001, name: name('Derelik') },
    { regionID: 10000002, name: name('The Forge') },
    { regionID: 11000001, name: name('A-R00001') },
  ],
  mapConstellations: [
    { constellationID: 20000001, regionID: 10000001, name: name('San Matar') },
    { constellationID: 20000002, regionID: 10000002, name: name('Kimotoro') },
    { constellationID: 21000001, regionID: 11000001, name: name('A-C00001') },
  ],
})

const locked = { version: 'v1', fb: 'f', bfbs: 'b' }
const lockfile: Lockfile = {
  lockfileVersion: 1,
  release: '20261119T000000Z',
  buildNumber: 1,
  releaseDate: '2026-11-19T00:00:00Z',
  tables: { mapSolarSystems: locked, mapStargates: locked, mapConstellations: locked, mapRegions: locked },
}

const run = async (dataset: ReturnType<typeof mapDataset>) => {
  const root = await mkdtemp(join(tmpdir(), 'eve-map-'))
  const result = (
    await runDatasets({ datasets: [dataset], lockfile, source, root, cacheDir: join(root, 'cache') })
  ).get(dataset.id)!
  return { value: result.value, data: decodeMapData(result.assets.get('map-data.bin')!) }
}

describe('mapDataset', () => {
  it('builds binary map data for known space', async () => {
    const { value, data } = await run(mapDataset())

    expect(value).toEqual({ url: { __eveSdeAsset: 'map-data.bin' }, systems: 3 })
    expect(data.systems.map((s) => s.id)).toEqual([30000001, 30000002, 30000003])
    expect(data.systems.map((s) => s.name)).toEqual(['Tanoo', 'Lashesih', 'Akpivem'])
    expect(data.systems.map((s) => s.security)).toEqual([0.86, 0.75, 0.46].map(Math.fround))
    expect(data.systems.map((s) => s.gates)).toEqual([[30000002], [30000001, 30000003], [30000002]])
    expect(data.constellations).toEqual({
      20000001: { name: 'San Matar', regionId: 10000001 },
      20000002: { name: 'Kimotoro', regionId: 10000002 },
    })
    expect(data.regions).toEqual({ 10000001: 'Derelik', 10000002: 'The Forge' })
  })

  it('honours locale and system filter', async () => {
    const { data } = await run(mapDataset({ locale: 'de', systems: (s) => s.constellationId === 20000001 }))

    expect(data.systems.map((s) => s.name)).toEqual(['Tanoo (de)', 'Lashesih (de)'])
    expect(data.systems[0].gates).toEqual([30000002])
    expect(data.regions).toEqual({ 10000001: 'Derelik (de)' })
  })

  it('changes version with locale and filter so the dataset rebuilds', () => {
    const base = mapDataset().version
    expect(mapDataset({ locale: 'de' }).version).not.toBe(base)
    expect(mapDataset({ systems: () => true }).version).not.toBe(base)
    expect(mapDataset().version).toBe(base)
  })
})
