import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { createSde } from '../core/sde'
import { check, fetchBlobs, types, update } from './commands'
import { resolveConfig } from './config'
import { files } from './files-source'
import { readLockfile } from './lockfile'

describe('CLI commands against the live API', () => {
  let config: ReturnType<typeof resolveConfig>
  beforeAll(async () => {
    const root = await mkdtemp(join(tmpdir(), 'eve-sde-live-'))
    config = resolveConfig({ tables: { races: { server: 'files' } }, dts: 'src/eve-sde.d.ts' }, root)
  })

  it('locks, fetches and reads the latest release', async () => {
    const updated = await update({ config })
    expect(updated.written).toBe(true)
    expect(updated.changed).toEqual(['races'])
    expect((await check({ config })).changed).toEqual([])

    expect(await fetchBlobs({ config })).toBe(1)
    const lockfile = (await readLockfile(config.lockfile))!
    const sde = createSde({
      sources: [files({ lockfile, cacheDir: config.cacheDir, download: false })],
      updates: 'off',
    })
    expect((await sde.table('races').get(1))?.name.en).toBe('Caldari')
  })

  it('writes row types that augment the package registry', async () => {
    const path = await types({ config })
    const source = await readFile(path, 'utf8')
    expect(source).toContain('export type TypesRow = {')
    expect(source).toContain('interface SdeTypeRegistry')
  })
})
