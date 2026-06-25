import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { archivePath } from '../cache'
import { createFixtureArchive } from '../fixtures/create-fixture-archive'
import { getHook } from '../test-utils/get-hook'
import { sde } from './plugin'

describe('rollup plugin', () => {
  let rootDir: string
  let cacheDir: string
  let outputDir: string

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'eve-sde-rollup-'))
    cacheDir = join(rootDir, 'cache')
    outputDir = join(rootDir, 'generated')

    await mkdir(join(cacheDir, '123456'), { recursive: true })
    await writeFile(
      archivePath(cacheDir, '123456'),
      createFixtureArchive({
        groups: '{"_key": 10, "name": {"en": "Group"}}\n',
      }),
    )
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('generates SDE artifacts during buildStart', async () => {
    const plugin = sde({
      root: rootDir,
      outputDir: 'generated',
      cacheDir: 'cache',
      buildNumber: '123456',
      tables: ['groups'],
    })

    const context = {
      info: vi.fn(),
    }

    await getHook(plugin.buildStart)?.call(context as never, {} as never)

    expect(existsSync(join(outputDir, 'groups.json'))).toBe(true)
    expect(context.info).toHaveBeenCalledWith('Generated SDE artifacts (build 123456, 1 table dumps).')
  })
})
