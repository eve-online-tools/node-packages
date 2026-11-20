import { createFakeSde } from '../test-utils/fake-sde'
import { embedded, fixture } from '../sources/embedded'
import { remote } from '../sources/remote'
import { SdeRowNotFoundError } from './errors'
import { dehydrate, hydrate } from './hydration'
import { createSde } from './sde'

const rifter = { typeID: 587, groupID: 25, name: { en: 'Rifter' } }
const slasher = { typeID: 585, groupID: 25, name: { en: 'Slasher' } }
const frigate = { groupID: 25, categoryID: 6, name: { en: 'Frigate' } }

const setup = () => {
  const fake = createFakeSde()
  fake.publish('20261118T000000Z', { types: [slasher, rifter], groups: [frigate] })
  const sde = createSde({ fetch: fake.fetch })
  return { fake, sde }
}

const recordRequests = (requests: string[]) => requests.filter((url) => url.endsWith('.json'))

describe('createSde with the remote source', () => {
  it('reads a row by key and returns undefined for a missing key', async () => {
    const { sde } = setup()
    expect(await sde.table('types').get(587)).toEqual(rifter)
    expect(await sde.table('types').get(1)).toBeUndefined()
  })

  it('throws SdeRowNotFoundError from getOrThrow for a missing key', async () => {
    const { sde } = setup()
    await expect(sde.table('types').getOrThrow(1)).rejects.toBeInstanceOf(SdeRowNotFoundError)
  })

  it('fetches each key once across concurrent and repeated reads', async () => {
    const { fake, sde } = setup()
    const [one, many] = await Promise.all([sde.table('types').get(587), sde.table('types').getMany([587, 585, 1])])
    await sde.table('types').get(585)

    expect(one).toEqual(rifter)
    expect([...many.keys()]).toEqual([587, 585])
    expect(recordRequests(fake.requests).sort()).toEqual([
      'https://sde.evetech.net/tranquility/20261118T000000Z/types/1.json',
      'https://sde.evetech.net/tranquility/20261118T000000Z/types/585.json',
      'https://sde.evetech.net/tranquility/20261118T000000Z/types/587.json',
    ])
  })

  it('applies fields and omit projections', async () => {
    const { sde } = setup()
    expect(await sde.table('types').get(587, { fields: ['typeID', 'groupID'] })).toEqual({ typeID: 587, groupID: 25 })
    expect(await sde.table('types').get(587, { omit: ['name'] })).toEqual({ typeID: 587, groupID: 25 })
  })

  it('streams a table from JSONL', async () => {
    const { sde } = setup()
    const rows = []
    for await (const row of sde.table('types').list({ fields: ['typeID'] })) {
      rows.push(row)
    }
    expect(rows).toEqual([{ typeID: 585 }, { typeID: 587 }])
  })

  it('falls back to latest when the requested release has expired', async () => {
    const { fake } = setup()
    fake.publish('20261119T000000Z', { types: [rifter] })
    fake.publish('20261120T000000Z', { types: [rifter] })
    const sde = createSde({ fetch: fake.fetch, release: '20261118T000000Z' })
    expect((await sde.manifest()).release).toBe('20261120T000000Z')
  })

  it('moves to the latest release when a record 404s because its release expired', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    const { fake, sde } = setup()
    await sde.manifest()
    vi.setSystemTime(Date.now() + 10 * 60_000)
    const renamed = { ...rifter, name: { en: 'Rifter II' } }
    fake.publish('20261119T000000Z', { types: [slasher, renamed], groups: [frigate] })
    fake.publish('20261120T000000Z', { types: [slasher, renamed], groups: [frigate] })
    const changes: unknown[] = []
    sde.on('change', (event) => changes.push(event))

    expect(await sde.table('types').get(587)).toEqual(renamed)
    expect(changes).toEqual([{ release: '20261120T000000Z', tables: ['types'] }])
    vi.useRealTimers()
  })
})

describe('pinned releases', () => {
  it('treat a 404 as a missing row while the release is alive', async () => {
    const fake = createFakeSde()
    fake.publish('20261118T000000Z', { types: [rifter] })
    fake.publish('20261119T000000Z', { types: [rifter, slasher] })
    const sde = createSde({ fetch: fake.fetch, release: '20261118T000000Z', updates: 'off' })
    const changes: unknown[] = []
    sde.on('change', (event) => changes.push(event))

    expect(await sde.table('types').get(585)).toBeUndefined()
    expect(await sde.table('types').get(1)).toBeUndefined()
    expect((await sde.manifest()).release).toBe('20261118T000000Z')
    expect(changes).toEqual([])
    expect(fake.requests.filter((url) => url.includes('/latest/'))).toEqual([])
  })
})

describe('preload', () => {
  it('loads a whole table with one JSONL request and answers missing keys from the cache', async () => {
    const { fake, sde } = setup()
    await Promise.all([sde.table('types').preload(), sde.table('types').preload()])
    const jsonl = fake.requests.filter((url) => url.endsWith('types.jsonl'))

    expect(await sde.table('types').getMany([587, 585, 1])).toEqual(
      new Map([
        [587, rifter],
        [585, slasher],
      ]),
    )
    expect(jsonl).toHaveLength(1)
    expect(recordRequests(fake.requests)).toEqual([])
  })

  it('loads listed keys', async () => {
    const { fake, sde } = setup()
    await sde.table('types').preload([587, 587])
    expect(await sde.table('types').get(587)).toEqual(rifter)
    expect(recordRequests(fake.requests)).toHaveLength(1)
  })

  it('forgets a preloaded table when it changes', async () => {
    const fake = createFakeSde()
    fake.publish('20261118T000000Z', { types: [rifter], groups: [frigate] })
    const sde = createSde({ fetch: fake.fetch, updateIntervalMs: 0 })
    await sde.table('types').preload()

    const renamed = { ...rifter, name: { en: 'Rifter II' } }
    fake.publish('20261119T000000Z', { types: [renamed, slasher], groups: [frigate] })
    const change = new Promise((resolve) => sde.on('change', resolve))
    void sde.table('groups').get(25)
    await change

    expect(await sde.table('types').get(585)).toEqual(slasher)
    expect(await sde.table('types').get(587)).toEqual(renamed)
  })
})

describe('update checks', () => {
  it('drops cached rows of changed tables and emits change', async () => {
    const fake = createFakeSde()
    fake.publish('20261118T000000Z', { types: [rifter], groups: [frigate] })
    const sde = createSde({ fetch: fake.fetch, updateIntervalMs: 0 })
    expect(await sde.table('types').get(587)).toEqual(rifter)

    const renamed = { ...rifter, name: { en: 'Rifter II' } }
    fake.publish('20261119T000000Z', { types: [renamed], groups: [frigate] })
    const change = new Promise((resolve) => sde.on('change', resolve))
    void sde.table('groups').get(25)

    expect(await change).toEqual({ release: '20261119T000000Z', tables: ['types'] })
    expect(await sde.table('types').get(587)).toEqual(renamed)
  })

  it('reports stale build data and switches tables to remote when configured', async () => {
    const fake = createFakeSde()
    fake.publish('20261118T000000Z', { types: [rifter], groups: [frigate] })
    const frigates = { ...frigate, name: { en: 'Frigates' } }
    fake.publish('20261119T000000Z', { types: [rifter], groups: [frigates] })
    const sde = createSde({
      fetch: fake.fetch,
      release: '20261118T000000Z',
      updates: 'off',
      sources: [embedded({ groups: [frigate] }, { versions: { groups: fake.versionOf([frigate]) } }), remote()],
      onStale: { groups: 'remote' },
    })

    expect(await sde.table('groups').get(25)).toEqual(frigate)

    const stale: unknown[] = []
    const changes: unknown[] = []
    sde.on('stale', (event) => stale.push(event))
    sde.on('change', (event) => changes.push(event))
    await sde.checkForUpdates()

    expect(stale).toEqual([{ release: '20261119T000000Z', tables: ['groups'] }])
    expect(changes).toEqual([{ release: '20261119T000000Z', tables: ['groups'] }])
    expect(await sde.table('groups').get(25)).toEqual(frigates)
  })

  it('reports stale data when no source serves some changed tables', async () => {
    const fake = createFakeSde()
    fake.publish('20261118T000000Z', { types: [rifter], groups: [frigate] })
    const sde = createSde({
      fetch: fake.fetch,
      sources: [embedded({ groups: [frigate] }, { versions: { groups: fake.versionOf([frigate]) } })],
    })
    await sde.manifest()
    fake.publish('20261119T000000Z', { types: [slasher], groups: [{ ...frigate, name: { en: 'Frigates' } }] })

    const stale: unknown[] = []
    sde.on('stale', (event) => stale.push(event))
    await sde.checkForUpdates()

    expect(stale).toEqual([{ release: '20261119T000000Z', tables: ['groups'] }])
  })

  it('does not touch the network for fixture-only instances', async () => {
    const sde = createSde({
      fetch: () => Promise.reject(new Error('network')),
      sources: [fixture({ types: [{ typeID: 587, groupID: 25 }] })],
    })
    expect(await sde.table('types').get(587)).toEqual({ typeID: 587, groupID: 25 })
  })
})

describe('dehydrate and hydrate', () => {
  it('serves rows read on the server without refetching on the client', async () => {
    const { sde: server } = setup()
    const scope = server.scope()
    await scope.table('types').get(587)
    await scope.table('types').get(1)
    const state = JSON.parse(JSON.stringify(await dehydrate(scope)))

    const client = createSde({ fetch: () => Promise.reject(new Error('network')), updates: 'off' })
    hydrate(client, state)

    expect(state.release).toBe('20261118T000000Z')
    expect(await client.table('types').get(587)).toEqual(rifter)
    expect(await client.table('types').get(1)).toBeUndefined()
  })
})
