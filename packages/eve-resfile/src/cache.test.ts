import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { buildIndexPath, readCachedMap, readCachedText, resfileMapPath, writeCachedMap, writeCachedText } from './cache'

describe('cache', () => {
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'eve-resfile-cache-'))
  })

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
  })

  it('writes and reads cached text', async () => {
    const path = buildIndexPath(cacheDir, '123')
    await writeCachedText(path, 'build-index-content')

    expect(await readCachedText(path)).toBe('build-index-content')
    expect(await readFile(path, 'utf8')).toBe('build-index-content')
  })

  it('writes and reads cached maps', async () => {
    const path = resfileMapPath(cacheDir, '123')
    const map = new Map([
      ['res:/icons/icon.png', 'icons/icon.png'],
      ['res:/ui/window.png', 'ui/window.png'],
    ])

    await writeCachedMap(path, map)

    expect(await readCachedMap(path)).toEqual(map)
  })

  it('returns null for missing cache entries', async () => {
    expect(await readCachedText(buildIndexPath(cacheDir, 'missing'))).toBeNull()
    expect(await readCachedMap(resfileMapPath(cacheDir, 'missing'))).toBeNull()
  })
})
