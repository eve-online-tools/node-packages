import { mkdtemp, readFile, rm } from 'node:fs/promises'
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
    expect((await results.get('test:ship-names')!.load()).value).toEqual({ 587: 'Rifter' })
    expect((await results.get('test:count')!.load()).value).toBe(1)
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
    const result = await (await run([dataset])).get('test:files')!.load()
    expect(result.value).toEqual({ url: { __eveSdeAsset: 'data.bin' } })
    expect([...result.assets.get('data.bin')!]).toEqual([1, 2])
    expect(await readFile(join(root, 'generated/names.txt'), 'utf8')).toBe('Rifter')
  })

  it('passes dependencies the same JSON value on fresh builds and cache hits', async () => {
    const { run } = await setup()
    const source = defineDataset({ id: 'test:source', version: '1', tables: [], build: () => ({ when: new Date(0) }) })
    const seen = vi.fn()
    const reader = defineDataset({
      id: 'test:reader',
      version: '1',
      tables: [],
      dependsOn: [source],
      build: ({ dataset }) => seen(dataset(source)),
    })
    await run([reader])
    expect(seen).toHaveBeenCalledWith({ when: '1970-01-01T00:00:00.000Z' })
  })

  it('rebuilds when the build code changes without a version bump, keeping the outDir fingerprint', async () => {
    const { run } = await setup()
    const first = await run([defineDataset({ id: 'test:edited', version: '1', tables: [], build: () => 1 })])
    const second = await run([defineDataset({ id: 'test:edited', version: '1', tables: [], build: () => 2 })])
    expect(first.get('test:edited')!.fingerprint).toBe(second.get('test:edited')!.fingerprint)
    expect((await second.get('test:edited')!.load()).value).toBe(2)
  })

  it('retries a build that failed', async () => {
    const { root, run } = await setup()
    const build = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue('value')
    const dataset = defineDataset({ id: 'test:flaky', version: '1', tables: [], outDir: 'out', build })
    await expect(run([dataset])).rejects.toThrow('offline')
    await rm(join(root, 'out'), { recursive: true, force: true })
    const results = await run([dataset])
    expect((await results.get('test:flaky')!.load()).value).toBe('value')
  })

  it('skips datasets whose outDir is up to date until their value is loaded', async () => {
    const { root, run } = await setup()
    const build = vi.fn(async ({ write }: { write: (path: string, data: string) => Promise<void> }) => {
      await write('names.txt', 'Rifter')
      return 'value'
    })
    const dataset = defineDataset({ id: 'test:committed', version: '1', tables: ['types'], outDir: 'generated', build })
    await run([dataset])
    await rm(join(root, '.cache'), { recursive: true })

    const results = await run([dataset])
    expect(build).toHaveBeenCalledTimes(1)
    expect((await results.get('test:committed')!.load()).value).toBe('value')
    expect(build).toHaveBeenCalledTimes(2)
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
  it('treats equal definitions with the same id as one dataset', () => {
    expect(orderDatasets([shipNames, { ...shipNames }])).toEqual([shipNames])
  })

  it('rejects two different datasets with the same id', () => {
    const other = { ...shipNames, version: '2' }
    expect(() => orderDatasets([shipNames, other])).toThrow('Two different datasets use the id "test:ship-names"')
  })
})
