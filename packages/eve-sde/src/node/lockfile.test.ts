import type { ReleaseManifest } from '../core/manifest'
import { changedTables, createLockfile, lockfileManifest, parseLockfile, type Lockfile } from './lockfile'

const hash = (char: string) => char.repeat(64)

const manifest: ReleaseManifest = {
  release: '20261119T000000Z',
  buildNumber: 7,
  releaseDate: '2026-11-19T00:00:00Z',
  tables: {
    types: {
      version: 'tv',
      jsonlUrl: 'https://sde.evetech.net/tranquility/20261119T000000Z/types.jsonl',
      fbUrl: 'https://sde.evetech.net/tranquility/20261119T000000Z/types.fb',
      bfbsUrl: 'https://sde.evetech.net/tranquility/20261119T000000Z/types.bfbs',
      recordUrlTemplate: 'https://sde.evetech.net/tranquility/20261119T000000Z/types/{key}.json',
    },
  },
}

const redirects: Record<string, string> = {
  [manifest.tables.types!.fbUrl]: `/blobs/${hash('a')}.fb`,
  [manifest.tables.types!.bfbsUrl]: `/blobs/${hash('b')}.bfbs`,
}

const fetchRedirects = (async (input: string | URL | Request) => {
  const location = redirects[String(input)]
  return location ? new Response(null, { status: 302, headers: { location } }) : new Response(null, { status: 404 })
}) as typeof fetch

const lock = (versions: Record<string, string>): Lockfile => ({
  lockfileVersion: 1,
  release: 'R',
  buildNumber: 1,
  releaseDate: 'D',
  tables: Object.fromEntries(Object.entries(versions).map(([t, version]) => [t, { version, fb: 'f', bfbs: 'b' }])),
})

describe('lockfile', () => {
  it('locks table versions and the blob ids of their FlatBuffers files', async () => {
    expect(await createLockfile(fetchRedirects, manifest)).toEqual({
      lockfileVersion: 1,
      release: '20261119T000000Z',
      buildNumber: 7,
      releaseDate: '2026-11-19T00:00:00Z',
      tables: { types: { version: 'tv', fb: hash('a'), bfbs: hash('b') } },
    })
  })

  it('round-trips into a manifest for the locked release', async () => {
    const locked = await createLockfile(fetchRedirects, manifest)
    expect(lockfileManifest(parseLockfile(JSON.parse(JSON.stringify(locked))))).toEqual(manifest)
  })

  it('rejects unknown lockfile versions', () => {
    expect(() => parseLockfile({ lockfileVersion: 2 })).toThrow('unsupported lockfileVersion 2')
  })

  it('lists changed tables, limited to the relevant ones', () => {
    const from = lock({ types: '1', groups: '1', races: '1' })
    const to = lock({ types: '2', groups: '1', races: '2', bloodlines: '1' })
    expect(changedTables(from, to)).toEqual(['bloodlines', 'races', 'types'])
    expect(changedTables(from, to, ['types', 'groups'])).toEqual(['types'])
  })
})
