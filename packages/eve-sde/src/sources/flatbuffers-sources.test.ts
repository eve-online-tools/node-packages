import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createSde } from '../core/sde'
import { files } from '../node/files-source'
import { createFakeSde } from '../test-utils/fake-sde'
import { remote } from './remote'

// A synthetic table keyed by `id`; see formats/fb/__fixtures__.
const fixturePath = (extension: string) =>
  join(dirname(fileURLToPath(import.meta.url)), '../formats/fb/__fixtures__', `numeric.${extension}`)
const read = (extension: string) => new Uint8Array(readFileSync(fixturePath(extension)))
const table = 'numeric' as 'types'

describe('FlatBuffers sources', () => {
  it('remote bulk downloads the table once and serves gets and lists from it', async () => {
    const fake = createFakeSde()
    fake.publish('20261118T000000Z', { numeric: [] })
    fake.serveFlatBuffers('20261118T000000Z', 'numeric', { fb: read('fb'), bfbs: read('bfbs') })
    const sde = createSde({ fetch: fake.fetch, updates: 'off', sources: [remote({ get: 'bulk' })] })

    expect(await sde.table(table).get(2 as never, { fields: ['name' as never] })).toEqual({
      name: { en: 'Second', de: 'Zweite' },
    })
    expect(await sde.table(table).get(99 as never)).toBeUndefined()
    const ids = []
    for await (const row of sde.table(table).list()) {
      ids.push((row as unknown as { id: number }).id)
    }
    expect(ids).toEqual([1, 2, 30])
    expect(fake.requests.filter((url) => /\.(fb|bfbs)$/.test(url))).toHaveLength(2)
  })

  it('files serves a locked table from local paths', async () => {
    const lockfile = {
      lockfileVersion: 1 as const,
      release: 'R',
      buildNumber: 1,
      releaseDate: 'D',
      tables: { numeric: { version: 'n1' } },
    }
    const source = files({ lockfile, paths: { numeric: { fb: fixturePath('fb'), bfbs: fixturePath('bfbs') } } })
    const sde = createSde({ release: 'R', updates: 'off', sources: [source] })

    expect(source.versions).toEqual({ numeric: 'n1' })
    expect(await sde.table(table).getMany([1 as never, 30 as never, 5 as never])).toHaveProperty('size', 2)
  })
})
