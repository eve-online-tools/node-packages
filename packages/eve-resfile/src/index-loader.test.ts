import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { loadResfileIndexData } from './index-loader'
import { RESFILE_INDEX_PATH } from './constants'

describe('loadResfileIndexData', () => {
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'eve-resfile-loader-'))
  })

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('loads and caches resfile index data from mocked CDN responses', async () => {
    const fetchMock = vi.fn(async (url: string | URL) => {
      const href = String(url)

      if (href.endsWith('/eveonline_123456.txt')) {
        return new Response(`${RESFILE_INDEX_PATH},resindex/resfileindex.txt,hash`)
      }

      if (href.endsWith('/resindex/resfileindex.txt')) {
        return new Response('res:/icons/64/icon.png,icons/icon_123.png,hash')
      }

      throw new Error(`Unexpected fetch: ${href}`)
    })

    vi.stubGlobal('fetch', fetchMock)

    const first = await loadResfileIndexData({
      buildNumber: '123456',
      indexOrigin: 'https://binaries.test',
      assetOrigin: 'https://resources.test',
      cacheDir,
    })

    expect(first.buildNumber).toBe('123456')
    expect(first.resPathToCdnPath.get('res:/icons/64/icon.png')).toBe('icons/icon_123.png')

    const second = await loadResfileIndexData({
      buildNumber: '123456',
      indexOrigin: 'https://binaries.test',
      assetOrigin: 'https://resources.test',
      cacheDir,
    })

    expect(second.resPathToCdnPath).toEqual(first.resPathToCdnPath)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
