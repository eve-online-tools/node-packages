import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { configModuleId, createPluginCore } from './core'

const lockfile = {
  lockfileVersion: 1,
  release: '20261119T000000Z',
  buildNumber: 1,
  releaseDate: '2026-11-19T00:00:00Z',
  tables: {
    categories: { version: 'c1', fb: 'cf', bfbs: 'cb' },
    types: { version: 't1', fb: 'tf', bfbs: 'tb' },
  },
}

const setup = async (options: Parameters<typeof createPluginCore>[0]) => {
  const root = await mkdtemp(join(tmpdir(), 'eve-sde-plugin-'))
  await writeFile(join(root, 'eve-sde.lock.json'), JSON.stringify(lockfile))
  const core = createPluginCore(options)
  await core.init(root, () => {})
  const id = core.resolveId(configModuleId)!
  const emit = () => {
    throw new Error('unexpected emit')
  }
  return {
    client: () => core.load(id, 'client', 'build', emit),
    server: () => core.load(id, 'server', 'serve', emit),
  }
}

describe('generated config module', () => {
  it('pins servers to the locked release and starts browsers at latest', async () => {
    const { client, server } = await setup({})
    expect(await client()).toContain('release: "latest"')
    expect(await server()).toContain('release: "20261119T000000Z"')
  })

  it('rejects tables the locked release does not have', async () => {
    await expect(setup({ tables: { typez: { client: 'embed' } } as never })).rejects.toThrow(
      'release 20261119T000000Z has no table "typez"',
    )
  })

  it('orders sources by mode', async () => {
    const { client } = await setup({
      tables: { categories: { client: 'embed', onStale: 'remote' }, types: { client: 'bulk' } },
    })
    const code = (await client())!
    expect(code).toContain('onStale: {"categories":"remote"}')
    expect(code).toMatch(
      /embedded\(\{ "categories": .*import\("eve-sde:table\/categories"\).*\{ versions: \{"categories":"c1"\} \}\)/,
    )
    expect(code.indexOf('remote({ get: "bulk", tables: ["types"] })')).toBeLessThan(
      code.indexOf('remote({ get: "record" })'),
    )
    expect(code).not.toContain('files(')
  })

  it('reads file-backed tables from the cache on the dev server', async () => {
    const { server } = await setup({ tables: { types: { server: 'files' } } })
    const code = (await server())!
    expect(code).toContain("import { files } from '@eve-online-tools/eve-sde/node'")
    expect(code).toContain('tables: ["types"]')
  })

  it('rejects build-time modes as defaults', async () => {
    await expect(setup({ defaults: { client: 'embed' as 'record' } })).rejects.toThrow('Default modes must be')
  })
})
