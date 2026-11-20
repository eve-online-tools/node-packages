import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defineDataset } from '../core/dataset'
import { fixture } from '../sources/embedded'
import { orderDatasets, runDatasets } from './datasets'
import type { Lockfile } from './lockfile'

const lockfile: Lockfile = {
  lockfileVersion: 1,
  release: 'R',
  buildNumber: 1,
  releaseDate: 'D',
  tables: { types: { version: 't1', fb: 'f', bfbs: 'b' }, groups: { version: 'g1', fb: 'f', bfbs: 'b' } },
}

const source = fixture({
  types: [
    { typeID: 587, groupID: 25, name: { en: 'Rifter' } },
    { typeID: 34, groupID: 18, name: { en: 'Tritanium' } },
  ],
  groups: [{ groupID: 25, name: { en: 'Frigate' } }],
})

const shipNames = defineDataset({
  id: 'test:ship-names',
  version: '1',
  tables: ['types', 'groups'],
  build: async ({ table }) => {
    const frigates = await table('groups').getOrThrow(25)
    const names: Record<number, string> = {}
    for await (const type of table('types').list({ fields: ['typeID', 'groupID', 'name'] })) {
      if (type.groupID === frigates.groupID) {
        names[type.typeID] = type.name.en
      }
    }
    return names
  },
})

const setup = async () => {
  const root = await mkdtemp(join(tmpdir(), 'eve-sde-datasets-'))
  return {
    root,
    run: (datasets: Parameters<typeof runDatasets>[0]['datasets']) =>
      runDatasets({ datasets, lockfile, source, root, cacheDir: join(root, '.cache') }),
  }
}

describe('runDatasets', () => {
  it('builds values from declared tables and passes them to dependents', async () => {
    const { run } = await setup()
    const count = defineDataset({
      id: 'test:count',
      version: '1',
      tables: [],
      dependsOn: [shipNames],
      build: ({ dataset }) => Object.keys(dataset(shipNames)).length,
    })
    const results = await run([count])
    expect(results.get('test:ship-names')?.value).toEqual({ 587: 'Rifter' })
    expect(results.get('test:count')?.value).toBe(1)
  })

  it('reuses the cached result while inputs are unchanged', async () => {
    const { run } = await setup()
    const build = vi.fn(() => 'value')
    const dataset = defineDataset({ id: 'test:cached', version: '1', tables: ['types'], build })
    await run([dataset])
    await run([dataset])
    expect(build).toHaveBeenCalledTimes(1)
  })

  it('returns emitted files as assets and writes files to outDir', async () => {
    const { root, run } = await setup()
    const dataset = defineDataset({
      id: 'test:files',
      version: '1',
      tables: [],
      outDir: 'generated',
      build: async ({ emit, write }) => {
        await write('names.txt', 'Rifter')
        return { url: emit('data.bin', new Uint8Array([1, 2])) }
      },
    })
    const result = (await run([dataset])).get('test:files')!
    expect(result.value).toEqual({ url: { __eveSdeAsset: 'data.bin' } })
    expect([...result.assets.get('data.bin')!]).toEqual([1, 2])
    expect(await readFile(join(root, 'generated/names.txt'), 'utf8')).toBe('Rifter')
  })

  it('rejects reads of undeclared tables', async () => {
    const { run } = await setup()
    const dataset = defineDataset({
      id: 'test:sneaky',
      version: '1',
      tables: ['groups'],
      build: ({ table }) => table('types' as 'groups').get(587),
    })
    await expect(run([dataset])).rejects.toThrow('reads "types" without declaring it')
  })
})

describe('orderDatasets', () => {
  it('rejects two datasets with the same id', () => {
    const copy = { ...shipNames }
    expect(() => orderDatasets([shipNames, copy])).toThrow('Two different datasets use the id "test:ship-names"')
  })
})
