import { mkdtemp, readFile, rm, unlink, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { loadResfileIndexData } from './index-loader'
import { readCachedMap, resfileMapPath } from './cache'
import {
  mockBuildNumber,
  sampleCdnPath,
  sampleResPath,
  stubResfileCdnFetch,
  testAllowedHosts,
} from './test-utils/mock-cdn'

const loaderOptions = (cacheDir: string) => ({
  buildNumber: mockBuildNumber,
  indexOrigin: 'https://binaries.test',
  assetOrigin: 'https://resources.test',
  allowedHosts: testAllowedHosts,
  cacheDir,
})

describe('loadResfileIndexData', () => {
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'eve-resfile-loader-'))
  })

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('downloads index files on a cold cache', async () => {
    const fetchMock = stubResfileCdnFetch()

    const index = await loadResfileIndexData(loaderOptions(cacheDir), cacheDir)

    expect(index.buildNumber).toBe(mockBuildNumber)
    expect(index.resPathToCdnPath.get(sampleResPath)).toBe(sampleCdnPath)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      `https://binaries.test/eveonline_${mockBuildNumber}.txt`,
      'https://binaries.test/resindex/resfileindex.txt',
    ])
  })

  it('reads the cached map without additional fetches on a warm cache', async () => {
    const fetchMock = stubResfileCdnFetch()

    const first = await loadResfileIndexData(loaderOptions(cacheDir), cacheDir)
    const second = await loadResfileIndexData(loaderOptions(cacheDir), cacheDir)

    expect(second.resPathToCdnPath).toEqual(first.resPathToCdnPath)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not fetch eveclient_TQ.json when buildNumber is pinned', async () => {
    const fetchMock = stubResfileCdnFetch()

    await loadResfileIndexData(loaderOptions(cacheDir), cacheDir)

    expect(fetchMock.mock.calls.some(([url]) => String(url).endsWith('/eveclient_TQ.json'))).toBe(false)
  })

  it('rebuilds the map from cached text files when only the map cache is deleted', async () => {
    const fetchMock = stubResfileCdnFetch()

    const first = await loadResfileIndexData(loaderOptions(cacheDir), cacheDir)
    await unlink(resfileMapPath(cacheDir, mockBuildNumber))

    const second = await loadResfileIndexData(loaderOptions(cacheDir), cacheDir)

    expect(second.resPathToCdnPath).toEqual(first.resPathToCdnPath)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    await expect(readCachedMap(resfileMapPath(cacheDir, mockBuildNumber), mockBuildNumber)).resolves.toEqual(
      first.resPathToCdnPath,
    )
  })

  it('accepts partial options and applies EVE defaults', async () => {
    stubResfileCdnFetch()

    const index = await loadResfileIndexData({ buildNumber: mockBuildNumber, cacheDir }, cacheDir)

    expect(index.buildNumber).toBe(mockBuildNumber)
    expect(index.resPathToCdnPath.get(sampleResPath)).toBe(sampleCdnPath)
  })

  it('fetches eveclient_TQ.json when buildNumber is omitted', async () => {
    const fetchMock = stubResfileCdnFetch()

    await loadResfileIndexData(
      {
        cacheDir,
        indexOrigin: 'https://binaries.test',
        assetOrigin: 'https://resources.test',
        allowedHosts: testAllowedHosts,
      },
      cacheDir,
    )

    expect(fetchMock.mock.calls[0]?.[0]).toBe('https://binaries.test/eveclient_TQ.json')
  })

  it('shares cache between numeric and string buildNumber values', async () => {
    const fetchMock = stubResfileCdnFetch()

    await loadResfileIndexData({ ...loaderOptions(cacheDir), buildNumber: 123456 }, cacheDir)
    fetchMock.mockClear()

    const second = await loadResfileIndexData({ ...loaderOptions(cacheDir), buildNumber: '123456' }, cacheDir)

    expect(second.resPathToCdnPath.get(sampleResPath)).toBe(sampleCdnPath)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('recovers from corrupt map cache files using cached text files', async () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const fetchMock = stubResfileCdnFetch()

    await loadResfileIndexData(loaderOptions(cacheDir), cacheDir)
    await writeFile(resfileMapPath(cacheDir, mockBuildNumber), '{bad-json', 'utf8')

    const index = await loadResfileIndexData(loaderOptions(cacheDir), cacheDir)

    expect(index.resPathToCdnPath.get(sampleResPath)).toBe(sampleCdnPath)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(warnSpy).toHaveBeenCalled()
    await expect(readFile(resfileMapPath(cacheDir, mockBuildNumber), 'utf8')).resolves.toContain(sampleResPath)

    warnSpy.mockRestore()
  })
})
