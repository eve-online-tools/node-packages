import {
  asJsLoadResult,
  emptyResfileModule,
  formatRollupAssetModule,
  isEmptyResfileUrl,
  loadResfileAssetModule,
  lookupOrThrow,
  lookupResPath,
  resolveEveResfileOptions,
  resolveResfileId,
  resPathFromVirtualId,
  virtualIdForResPath,
} from './plugin-core'
import type { ResfileIndex } from './types'

describe('plugin-core', () => {
  const index: ResfileIndex = {
    buildNumber: '123456',
    resPathToCdnPath: new Map([['res:/icons/64/icon.png', 'icons/icon_123.png']]),
  }

  it('resolves res imports to virtual module ids', () => {
    expect(resolveResfileId('res:/icons/64/icon.png')).toBe(virtualIdForResPath('res:/icons/64/icon.png'))
    expect(resolveResfileId('./local-file.png')).toBeNull()
  })

  it('extracts res paths from virtual ids', () => {
    const virtualId = virtualIdForResPath('res:/icons/64/icon.png')
    expect(resPathFromVirtualId(virtualId)).toBe('res:/icons/64/icon.png')
  })

  it('throws when a res path is missing from the index', () => {
    expect(() => lookupOrThrow(index, 'res:/missing.png')).toThrow(
      'res:/missing.png not found in resfileindex (build 123456).',
    )
  })

  it('returns empty lookup results when warn-and-empty is configured', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    expect(lookupResPath(index, 'res:/missing.png', 'warn-and-empty')).toEqual({ ok: false })
    expect(warnSpy).toHaveBeenCalledWith(
      '[eve-resfile] Res path not found in resfileindex: res:/missing.png (build 123456)\n',
    )

    warnSpy.mockClear()
    expect(lookupResPath(index, 'res:/missing.png', 'warn-and-empty')).toEqual({ ok: false })
    expect(warnSpy).not.toHaveBeenCalled()

    warnSpy.mockRestore()
  })

  it('wraps generated module sources for Rolldown load hooks', () => {
    expect(asJsLoadResult('export default "asset-url"')).toEqual({
      code: 'export default "asset-url"',
      moduleType: 'js',
    })
  })

  it('returns dev proxy modules in watch mode', async () => {
    const moduleSource = await loadResfileAssetModule({
      watchMode: true,
      assetOrigin: 'https://resources.test',
      index,
      resPath: 'res:/icons/64/icon.png',
      missingResPath: 'throw',
      fetchOptions: { timeoutMs: 30_000 },
      emitAsset: () => 'asset-ref',
      formatAssetModule: formatRollupAssetModule,
    })

    expect(moduleSource).toBe('export default "/__eve_res__/icons%2F64%2Ficon.png"')
  })

  it('fetches assets and emits file references in build mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(Buffer.from('png-bytes'))),
    )

    const moduleSource = await loadResfileAssetModule({
      watchMode: false,
      assetOrigin: 'https://resources.test',
      index,
      resPath: 'res:/icons/64/icon.png',
      missingResPath: 'throw',
      fetchOptions: { timeoutMs: 30_000 },
      emitAsset: (name, source) => {
        expect(name).toBe('icon.png')
        expect(source.toString()).toBe('png-bytes')
        return 'asset-ref'
      },
      formatAssetModule: formatRollupAssetModule,
    })

    expect(moduleSource).toBe('export default import.meta.ROLLUP_FILE_URL_asset-ref')
    vi.unstubAllGlobals()
  })

  it('uses a custom asset module formatter in build mode', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(Buffer.from('png-bytes'))),
    )

    const moduleSource = await loadResfileAssetModule({
      watchMode: false,
      assetOrigin: 'https://resources.test',
      index,
      resPath: 'res:/icons/64/icon.png',
      missingResPath: 'throw',
      fetchOptions: { timeoutMs: 30_000 },
      emitAsset: () => 'emitted/icon.png',
      formatAssetModule: (filename) => `export default __webpack_public_path__ + ${JSON.stringify(filename)}`,
    })

    expect(moduleSource).toBe('export default __webpack_public_path__ + "emitted/icon.png"')
    vi.unstubAllGlobals()
  })

  it('returns an empty module when a res path is missing and warn-and-empty is configured', async () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const moduleSource = await loadResfileAssetModule({
      watchMode: true,
      assetOrigin: 'https://resources.test',
      index,
      resPath: 'res:/icons/64/missing-for-load.png',
      missingResPath: 'warn-and-empty',
      fetchOptions: { timeoutMs: 30_000 },
      emitAsset: () => 'asset-ref',
      formatAssetModule: formatRollupAssetModule,
    })

    expect(moduleSource).toBe(emptyResfileModule())
    expect(warnSpy).toHaveBeenCalledWith(
      '[eve-resfile] Res path not found in resfileindex: res:/icons/64/missing-for-load.png (build 123456)\n',
    )

    warnSpy.mockRestore()
  })

  it('returns an empty module when CDN fetch fails and warn-and-empty is configured', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('missing', { status: 404 })),
    )
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)

    const moduleSource = await loadResfileAssetModule({
      watchMode: false,
      assetOrigin: 'https://resources.test',
      index,
      resPath: 'res:/icons/64/icon.png',
      missingResPath: 'warn-and-empty',
      fetchOptions: { timeoutMs: 30_000 },
      emitAsset: () => 'asset-ref',
      formatAssetModule: formatRollupAssetModule,
    })

    expect(moduleSource).toBe(emptyResfileModule())
    expect(warnSpy).toHaveBeenCalledWith(
      '[eve-resfile] Failed to fetch resfile from CDN: res:/icons/64/icon.png → https://resources.test/icons/icon_123.png (build 123456) — Not found: https://resources.test/icons/icon_123.png (HTTP 404).\n',
    )

    warnSpy.mockRestore()
    vi.unstubAllGlobals()
  })

  it('identifies empty resfile url exports', () => {
    expect(emptyResfileModule()).toBe('export default ""')
    expect(isEmptyResfileUrl('')).toBe(true)
    expect(isEmptyResfileUrl('/assets/icon.png')).toBe(false)
  })

  it('rejects unsafe origins during option resolution', () => {
    expect(() => resolveEveResfileOptions({ indexOrigin: 'http://169.254.169.254' }, '/tmp/pkg')).toThrow(
      'private or link-local hosts are not allowed',
    )
  })

  it('normalizes numeric buildNumber values to strings', () => {
    const resolved = resolveEveResfileOptions({ buildNumber: 123456 }, '/tmp/pkg')

    expect(resolved.buildNumber).toBe('123456')
  })

  it('rejects invalid buildNumber values at config time', () => {
    expect(() => resolveEveResfileOptions({ buildNumber: 'latest' }, '/tmp/pkg')).toThrow('Invalid buildNumber')
  })
})
