import { createHash } from 'node:crypto'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createBlobStore, sdeBlobUrl } from './blob-store'
import type { Lockfile } from './lockfile'

const bytes = new TextEncoder().encode('table bytes')
const id = createHash('sha256').update(bytes).digest('hex')
const lock: Lockfile = {
  lockfileVersion: 1,
  release: '20261119T000000Z',
  buildNumber: 1,
  releaseDate: '2026-11-19T00:00:00Z',
  tables: { races: { version: 'v1', fb: id, bfbs: id } },
}
const releaseUrl = 'https://sde.evetech.net/tranquility/20261119T000000Z/races.fb'

const serving = (routes: Record<string, Response | (() => Response)>) => {
  const requests: string[] = []
  const fetch = async (input: string | URL | Request) => {
    const url = String(input)
    requests.push(url)
    const route = routes[url]
    return typeof route === 'function' ? route() : (route?.clone() ?? new Response('', { status: 404 }))
  }
  return { fetch: fetch as typeof globalThis.fetch, requests }
}

const tempDir = () => mkdtemp(join(tmpdir(), 'eve-sde-blobs-'))

describe('createBlobStore', () => {
  it('downloads a blob once and serves it from disk afterwards', async () => {
    const { fetch, requests } = serving({ [`${sdeBlobUrl}${id}.fb`]: new Response(bytes) })
    const store = createBlobStore({ dir: await tempDir(), fetch })

    const path = await store.ensure(lock, 'races', 'fb')
    await store.ensure(lock, 'races', 'fb')

    expect([...(await readFile(path))]).toEqual([...bytes])
    expect(requests).toEqual([`${sdeBlobUrl}${id}.fb`])
  })

  it('shares a download between stores over the same directory', async () => {
    const { fetch, requests } = serving({ [`${sdeBlobUrl}${id}.fb`]: () => new Response(bytes) })
    const dir = await tempDir()
    const [first, second] = [createBlobStore({ dir, fetch }), createBlobStore({ dir, fetch })]

    const paths = await Promise.all([first.ensure(lock, 'races', 'fb'), second.ensure(lock, 'races', 'fb')])

    expect(paths[0]).toBe(paths[1])
    expect(requests).toHaveLength(1)
  })

  it('falls back to the locked release when the blob URL refuses', async () => {
    const { fetch } = serving({
      [`${sdeBlobUrl}${id}.fb`]: () => new Response('', { status: 403 }),
      [releaseUrl]: new Response(bytes),
    })
    const store = createBlobStore({ dir: await tempDir(), fetch })
    await expect(store.ensure(lock, 'races', 'fb')).resolves.toContain(`${id}.fb`)
  })

  it('rejects content that does not match the locked hash', async () => {
    const { fetch } = serving({ [`${sdeBlobUrl}${id}.fb`]: new Response('tampered') })
    const store = createBlobStore({ dir: await tempDir(), fetch })
    await expect(store.ensure(lock, 'races', 'fb')).rejects.toThrow('does not match its locked sha256')
  })

  it('tells the user to update when neither the blob nor the release exists', async () => {
    const { fetch } = serving({})
    const store = createBlobStore({ dir: await tempDir(), fetch })
    await expect(store.ensure(lock, 'races', 'fb')).rejects.toThrow('Run `eve-sde update`')
  })

  it('does not download when downloads are disabled', async () => {
    const { fetch, requests } = serving({ [`${sdeBlobUrl}${id}.fb`]: new Response(bytes) })
    const store = createBlobStore({ dir: await tempDir(), fetch, download: false })
    await expect(store.ensure(lock, 'races', 'fb')).rejects.toThrow('downloads are disabled')
    expect(requests).toEqual([])
  })
})
