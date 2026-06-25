import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { archivePath } from '../cache'
import { createFixtureArchive } from '../fixtures/create-fixture-archive'
import { getHook } from '../test-utils/get-hook'
import { sde } from './plugin'

describe('vite plugin', () => {
  let rootDir: string
  let cacheDir: string
  let outputDir: string

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'eve-sde-vite-'))
    cacheDir = join(rootDir, 'cache')
    outputDir = join(rootDir, 'generated')

    await mkdir(join(cacheDir, '123456'), { recursive: true })
    await writeFile(
      archivePath(cacheDir, '123456'),
      createFixtureArchive({
        types: '{"_key": 1, "name": {"en": "Frigate"}}\n',
      }),
    )
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('generates SDE artifacts during buildStart', async () => {
    const plugin = sde({
      outputDir: 'generated',
      cacheDir: 'cache',
      buildNumber: '123456',
      tables: ['types'],
    })

    const context = {
      info: vi.fn(),
    }

    await getHook(plugin.configResolved)?.call(context as never, { root: rootDir } as never)
    await getHook(plugin.buildStart)?.call(context as never, {} as never)

    expect(existsSync(join(outputDir, 'types.json'))).toBe(true)
    expect(context.info).toHaveBeenCalledWith('Generated SDE artifacts (build 123456, 1 table dumps).')
  })

  it('skips processing when output is up-to-date', async () => {
    const plugin = sde({
      outputDir: 'generated',
      cacheDir: 'cache',
      buildNumber: '123456',
      tables: ['types'],
    })

    const context = {
      info: vi.fn(),
    }

    await getHook(plugin.configResolved)?.call(context as never, { root: rootDir } as never)
    await getHook(plugin.buildStart)?.call(context as never, {} as never)
    await getHook(plugin.buildStart)?.call(context as never, {} as never)

    expect(context.info).toHaveBeenLastCalledWith(
      'Skipped SDE processing (up-to-date, build 123456). Bump processor version or use force: true to regenerate.',
    )
  })
})
