import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { cacheSchemaVersion } from './constants'
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

  it('writes and reads cached maps with schema metadata', async () => {
    const path = resfileMapPath(cacheDir, '123')
    const map = new Map([
      ['res:/icons/icon.png', 'icons/icon.png'],
      ['res:/ui/window.png', 'ui/window.png'],
    ])

    await writeCachedMap(path, '123', map)

    expect(await readCachedMap(path, '123')).toEqual(map)
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({
      version: cacheSchemaVersion,
      buildNumber: '123',
      entries: {
        'res:/icons/icon.png': 'icons/icon.png',
        'res:/ui/window.png': 'ui/window.png',
      },
    })
  })

  it('returns null for missing cache entries', async () => {
    expect(await readCachedText(buildIndexPath(cacheDir, 'missing'))).toBeNull()
    expect(await readCachedMap(resfileMapPath(cacheDir, 'missing'), 'missing')).toBeNull()
  })

  it('recovers from corrupt map files', async () => {
    const path = resfileMapPath(cacheDir, '123')
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await mkdir(join(cacheDir, '123'), { recursive: true })
    await writeFile(path, '{not-json', 'utf8')

    expect(await readCachedMap(path, '123')).toBeNull()
    expect(warnSpy).toHaveBeenCalled()
    await expect(readFile(path, 'utf8')).rejects.toThrow(/ENOENT/)

    warnSpy.mockRestore()
  })

  it('rejects map files with the wrong build number', async () => {
    const path = resfileMapPath(cacheDir, '123')
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await writeCachedMap(path, '999', new Map([['res:/icons/icon.png', 'icons/icon.png']]))

    expect(await readCachedMap(path, '123')).toBeNull()
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('rejects legacy map files without schema metadata', async () => {
    const path = resfileMapPath(cacheDir, '123')
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    await mkdir(join(cacheDir, '123'), { recursive: true })
    await writeFile(path, JSON.stringify({ 'res:/icons/icon.png': 'icons/icon.png' }), 'utf8')

    expect(await readCachedMap(path, '123')).toBeNull()
    expect(warnSpy).toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('normalizes legacy map keys when reading cached maps', async () => {
    const path = resfileMapPath(cacheDir, '123')
    const map = new Map([['res:/Icons/64/Icon.png', 'icons/icon_123.png']])

    await writeCachedMap(path, '123', map)

    expect(await readCachedMap(path, '123')).toEqual(new Map([['res:/icons/64/icon.png', 'icons/icon_123.png']]))
  })
})
