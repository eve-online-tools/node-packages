// @vitest-environment node
// Rollup checks asset sources with instanceof, which fails across jsdom's realm.
import { mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { rollup, type OutputAsset, type OutputChunk } from 'rollup'

import { defineDataset } from '../core/dataset'
import { sde } from './plugin'

const lockfile = { lockfileVersion: 1, release: 'R', buildNumber: 1, releaseDate: 'D', tables: {} }

describe('rollup plugin', () => {
  it('bundles dataset values and emits their files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'eve-sde-rollup-'))
    await writeFile(join(root, 'eve-sde.lock.json'), JSON.stringify(lockfile))
    await writeFile(join(root, 'main.js'), "export { default } from 'eve-sde:dataset/test:data'\n")
    const dataset = defineDataset({
      id: 'test:data',
      version: '1',
      tables: [],
      build: ({ emit }) => ({ count: 1, url: emit('data.json', '[1]') }),
    })

    const bundle = await rollup({
      input: join(root, 'main.js'),
      plugins: [sde({ root, datasets: [dataset], cacheDir: join(root, '.cache') })],
      onwarn: () => {},
    })
    const { output } = await bundle.generate({ format: 'es' })

    const chunk = output.find((file): file is OutputChunk => file.type === 'chunk')!
    const asset = output.find((file): file is OutputAsset => file.type === 'asset')!
    expect(new TextDecoder().decode(asset.source as Uint8Array)).toBe('[1]')
    expect(chunk.code).toContain(asset.fileName)
    expect(chunk.code).toContain('count')
  })
})
