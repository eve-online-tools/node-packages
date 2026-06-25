import { access, mkdtemp, readFile, rm } from 'node:fs/promises'
import { basename, join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  createDistAssetPath,
  ensureResfileAssetWritten,
  relativeAssetUrl,
  replaceCssPlaceholderUrls,
  rewriteJsAssetSentinels,
} from './asset-emit'
import { createResfileBuildContext, jsAssetSentinel } from './context'
import type { ResfileIndex } from './types'

describe('replaceCssPlaceholderUrls', () => {
  it('replaces quoted and unquoted placeholder urls', () => {
    const token = '__EVE_RESFILE_abc__'
    const url = '../assets/icon-abc.png'

    expect(replaceCssPlaceholderUrls(`background: url("${token}");`, token, url)).toBe(`background: url("${url}");`)
    expect(replaceCssPlaceholderUrls(`background: url('${token}');`, token, url)).toBe(`background: url('${url}');`)
    expect(replaceCssPlaceholderUrls(`background: url(${token});`, token, url)).toBe(`background: url("${url}");`)
  })
})

describe('relativeAssetUrl', () => {
  it('returns asset paths relative to css at the format output root', () => {
    expect(relativeAssetUrl('index.css', 'assets/icon.png', 'esm')).toBe('../assets/icon.png')
  })

  it('returns nested relative paths when css is in a subdirectory', () => {
    expect(relativeAssetUrl('nested/index.css', 'assets/icon.png', 'esm')).toBe('../../assets/icon.png')
  })
})

describe('createDistAssetPath', () => {
  it('builds a stable hashed filename under assets/', () => {
    const path = createDistAssetPath('res:/icons/64/icon.png', Buffer.from('png-bytes'))
    expect(path).toMatch(/^assets\/icon-[\w-]+\.png$/)
  })
})

describe('ensureResfileAssetWritten', () => {
  let cacheDir: string
  const index: ResfileIndex = {
    buildNumber: '123456',
    resPathToCdnPath: new Map([['res:/icons/64/icon.png', 'icons/icon_123.png']]),
  }

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'eve-resfile-asset-'))
  })

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('writes once and returns cached distPath on subsequent calls', async () => {
    const fetchMock = vi.fn(async () => new Response(Buffer.from('png-bytes')))
    vi.stubGlobal('fetch', fetchMock)

    const ctx = createResfileBuildContext({ buildNumber: '123456', cacheDir, root: cacheDir }, cacheDir)

    const first = await ensureResfileAssetWritten(ctx, index, 'res:/icons/64/icon.png')
    const second = await ensureResfileAssetWritten(ctx, index, 'res:/icons/64/icon.png')

    expect(first).toBe(second)
    expect(ctx.resolvedAssets.size).toBe(1)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    expect(first).not.toBeNull()
    const written = await readFile(join(ctx.options.assetsDir, basename(first!)))
    expect(written.toString()).toBe('png-bytes')
    await expect(access(ctx.options.assetsDir)).resolves.toBeUndefined()
  })

  it('writes to a configured assetsDir', async () => {
    const fetchMock = vi.fn(async () => new Response(Buffer.from('png-bytes')))
    vi.stubGlobal('fetch', fetchMock)

    const ctx = createResfileBuildContext(
      { buildNumber: '123456', cacheDir, assetsDir: 'dist/static/res', root: cacheDir },
      cacheDir,
    )

    const distPath = await ensureResfileAssetWritten(ctx, index, 'res:/icons/64/icon.png')

    expect(distPath).toMatch(/^static\/res\/icon-[\w-]+\.png$/)
    await expect(readFile(join(ctx.options.assetsDir, basename(distPath!)))).resolves.toEqual(Buffer.from('png-bytes'))
  })

  it('returns null and caches missing assets when warn-and-empty is configured', async () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const ctx = createResfileBuildContext({ buildNumber: '123456', cacheDir, root: cacheDir }, cacheDir)

    const distPath = await ensureResfileAssetWritten(ctx, index, 'res:/icons/64/missing-for-emit.png')

    expect(distPath).toBeNull()
    expect(ctx.resolvedAssets.get('res:/icons/64/missing-for-emit.png')).toEqual({ distPath: null })
    expect(warnSpy).toHaveBeenCalledWith(
      '[eve-resfile] Res path not found in resfileindex: res:/icons/64/missing-for-emit.png (build 123456)\n',
    )

    warnSpy.mockRestore()
  })
})

describe('rewriteJsAssetSentinels', () => {
  it('replaces sentinels with esm url expressions', () => {
    const ctx = createResfileBuildContext({}, '/tmp/pkg')
    ctx.resolvedAssets.set('res:/icons/64/icon.png', { distPath: 'assets/icon-abc.png' })

    const code = `export default ${JSON.stringify(jsAssetSentinel('res:/icons/64/icon.png'))};`
    const next = rewriteJsAssetSentinels(ctx, 'nested/chunk.js', code, 'es', 'esm')

    expect(next).toBe('export default new URL("../../assets/icon-abc.png", import.meta.url).href;')
  })

  it('replaces sentinels with cjs url expressions', () => {
    const ctx = createResfileBuildContext({}, '/tmp/pkg')
    ctx.resolvedAssets.set('res:/icons/64/icon.png', { distPath: 'assets/icon-abc.png' })

    const code = `module.exports = ${JSON.stringify(jsAssetSentinel('res:/icons/64/icon.png'))};`
    const next = rewriteJsAssetSentinels(ctx, 'index.js', code, 'cjs', 'cjs')

    expect(next).toBe(
      'module.exports = require("url").pathToFileURL(require("path").join(__dirname, "../assets/icon-abc.png")).href;',
    )
  })

  it('replaces sentinels with empty strings for missing assets', () => {
    const ctx = createResfileBuildContext({}, '/tmp/pkg')
    ctx.resolvedAssets.set('res:/icons/64/missing.png', { distPath: null })

    const code = `export default ${JSON.stringify(jsAssetSentinel('res:/icons/64/missing.png'))};`
    const next = rewriteJsAssetSentinels(ctx, 'nested/chunk.js', code, 'es', 'esm')

    expect(next).toBe('export default "";')
  })

  it('replaces single-quoted sentinels with esm url expressions', () => {
    const ctx = createResfileBuildContext({}, '/tmp/pkg')
    ctx.resolvedAssets.set('res:/icons/64/icon.png', { distPath: 'assets/icon-abc.png' })

    const code = `export default '${jsAssetSentinel('res:/icons/64/icon.png')}';`
    const next = rewriteJsAssetSentinels(ctx, 'nested/chunk.js', code, 'es', 'esm')

    expect(next).toBe('export default new URL("../../assets/icon-abc.png", import.meta.url).href;')
  })

  it('throws when sentinels are present but not in a rewriteable string literal form', () => {
    const ctx = createResfileBuildContext({}, '/tmp/pkg')
    ctx.resolvedAssets.set('res:/icons/64/icon.png', { distPath: 'assets/icon-abc.png' })

    const code = `export default \`${jsAssetSentinel('res:/icons/64/icon.png')}\`;`

    expect(() => rewriteJsAssetSentinels(ctx, 'chunk.js', code, 'es', 'esm')).toThrow(
      'Found JS asset sentinels in chunk.js but could not rewrite them',
    )
  })
})
