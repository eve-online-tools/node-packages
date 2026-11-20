import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { defineDataset } from '../core/dataset'
import { build, check } from './commands'
import { resolveConfig } from './config'
import { writeLockfile } from './lockfile'

const setup = async (datasets: Parameters<typeof resolveConfig>[0]['datasets'] = []) => {
  const root = await mkdtemp(join(tmpdir(), 'eve-sde-commands-'))
  return { root, config: resolveConfig({ datasets }, root) }
}

describe('check', () => {
  it('fails without a lockfile', async () => {
    const { config } = await setup()
    const fetch = vi.fn()
    await expect(check({ config, fetch })).rejects.toThrow('No lockfile')
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe('build', () => {
  it('writes values and emitted files under names static servers can find', async () => {
    const dataset = defineDataset({
      id: 'my-app:names',
      version: '1',
      tables: [],
      build: ({ emit }) => ({ url: emit('names.json', '{}') }),
    })
    const { root, config } = await setup([dataset])
    await writeLockfile(config.lockfile, {
      lockfileVersion: 1,
      release: 'R',
      buildNumber: 1,
      releaseDate: 'D',
      tables: {},
    })
    const outDir = join(root, 'out')

    await build({ config, outDir })

    expect(JSON.parse(await readFile(join(outDir, 'my-app_names.json'), 'utf8'))).toEqual({
      url: 'my-app_names/names.json',
    })
    expect(await readFile(join(outDir, 'my-app_names/names.json'), 'utf8')).toBe('{}')
  })
})
