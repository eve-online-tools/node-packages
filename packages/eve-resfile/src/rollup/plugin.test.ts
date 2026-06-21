import { access, mkdtemp, readdir, readFile, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  cssPlaceholderToken,
  createResfileBuildContext,
  ensureResfileIndex,
  jsAssetSentinel,
  registerCssPlaceholder,
} from '../context'
import { virtualIdForResPath } from '../plugin-core'
import { getPluginHook, stubResfileCdnFetch } from '../test-utils/mock-cdn'
import { createRollupResfilePlugin, rewriteCssPlaceholders } from './plugin'
import { eveResfile } from './index'

describe('rollup plugin', () => {
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'eve-resfile-rollup-'))
  })

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  const stubIndexFetch = () => stubResfileCdnFetch({ includeAssets: true })

  it('resolves res imports and returns sentinel modules in build mode', async () => {
    stubIndexFetch()

    const plugin = eveResfile({ buildNumber: '123456', cacheDir, root: cacheDir })
    const context = {
      meta: { watchMode: false },
      info: vi.fn(),
    }

    await getPluginHook(plugin.buildStart)?.call(context as never, {} as never)

    const resolvedId = await getPluginHook(plugin.resolveId)?.call(
      context as never,
      'res:/icons/64/icon.png',
      undefined,
      {
        attributes: {},
        isEntry: false,
      } as never,
    )
    expect(resolvedId).toContain('res:/icons/64/icon.png')

    const moduleSource = await getPluginHook(plugin.load)?.call(context as never, resolvedId as string)
    expect(moduleSource).toEqual({
      code: `export default ${JSON.stringify(jsAssetSentinel('res:/icons/64/icon.png'))}`,
      moduleType: 'js',
    })

    const assetDir = join(cacheDir, 'dist', 'assets')
    const files = await readdir(assetDir)
    expect(files.some((file) => /^icon-[\w-]+\.png$/.test(file))).toBe(true)
  })

  it('rewrites css placeholders to shared dist/assets with relative urls', async () => {
    stubIndexFetch()

    const ctx = createResfileBuildContext({ buildNumber: '123456', cacheDir, root: cacheDir }, cacheDir)
    const placeholderId = registerCssPlaceholder(ctx, 'res:/icons/64/icon.png')
    const token = cssPlaceholderToken(placeholderId)

    await ensureResfileIndex(ctx)

    const css = await rewriteCssPlaceholders(ctx, 'index.css', `.icon { background: url("${token}"); }`, 'esm')

    expect(css).toMatch(/url\("\.\.\/assets\/icon-[\w-]+\.png"\)/)
    expect(ctx.resolvedAssets.size).toBe(1)
    await expect(access(join(cacheDir, 'dist', 'assets'))).resolves.toBeUndefined()
  })

  it('dedupes repeated css placeholders for the same res path', async () => {
    const fetchMock = stubIndexFetch()

    const ctx = createResfileBuildContext({ buildNumber: '123456', cacheDir, root: cacheDir }, cacheDir)
    const placeholderId = registerCssPlaceholder(ctx, 'res:/icons/64/icon.png')
    const token = cssPlaceholderToken(placeholderId)

    await ensureResfileIndex(ctx)

    await rewriteCssPlaceholders(
      ctx,
      'index.css',
      `.a { background: url("${token}"); } .b { background: url("${token}"); }`,
      'esm',
    )

    expect(ctx.resolvedAssets.size).toBe(1)
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith('/icons/icon_123.png'))).toHaveLength(1)
  })

  it('dedupes assets across esm and cjs css outputs', async () => {
    const fetchMock = stubIndexFetch()

    const ctx = createResfileBuildContext({ buildNumber: '123456', cacheDir, root: cacheDir }, cacheDir)
    const placeholderId = registerCssPlaceholder(ctx, 'res:/icons/64/icon.png')
    const token = cssPlaceholderToken(placeholderId)

    await ensureResfileIndex(ctx)

    const esmCss = await rewriteCssPlaceholders(ctx, 'index.css', `.icon { background: url("${token}"); }`, 'esm')
    const cjsCss = await rewriteCssPlaceholders(ctx, 'index.css', `.icon { background: url("${token}"); }`, 'cjs')

    expect(esmCss).toMatch(/url\("\.\.\/assets\/icon-[\w-]+\.png"\)/)
    expect(cjsCss).toMatch(/url\("\.\.\/assets\/icon-[\w-]+\.png"\)/)
    expect(ctx.resolvedAssets.size).toBe(1)
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith('/icons/icon_123.png'))).toHaveLength(1)
  })

  it('rewrites js sentinels in writeBundle for esm output', async () => {
    stubIndexFetch()

    const ctx = createResfileBuildContext({ buildNumber: '123456', cacheDir, root: cacheDir }, cacheDir)
    const plugin = createRollupResfilePlugin(ctx)
    const outputDir = join(cacheDir, 'dist', 'esm')
    const context = {
      meta: { watchMode: false },
      info: vi.fn(),
    }

    await getPluginHook(plugin.buildStart)?.call(context as never, {} as never)
    await getPluginHook(plugin.load)?.call(context as never, virtualIdForResPath('res:/icons/64/icon.png'))

    const sentinel = JSON.stringify(jsAssetSentinel('res:/icons/64/icon.png'))
    const chunkCode = `export default ${sentinel};`

    await getPluginHook(plugin.writeBundle)?.call(
      context as never,
      { dir: outputDir, format: 'es' } as never,
      {
        'nested/chunk.js': {
          type: 'chunk',
          code: chunkCode,
          fileName: 'nested/chunk.js',
        },
      } as never,
    )

    const written = await readFile(join(outputDir, 'nested/chunk.js'), 'utf8')
    expect(written).toMatch(
      /export default new URL\("\.\.\/\.\.\/assets\/icon-[\w-]+\.png", import\.meta\.url\)\.href;/,
    )
  })

  it('rewrites js sentinels in writeBundle for cjs output', async () => {
    stubIndexFetch()

    const ctx = createResfileBuildContext({ buildNumber: '123456', cacheDir, root: cacheDir }, cacheDir)
    const plugin = createRollupResfilePlugin(ctx)
    const outputDir = join(cacheDir, 'dist', 'cjs')
    const context = {
      meta: { watchMode: false },
      info: vi.fn(),
    }

    await getPluginHook(plugin.buildStart)?.call(context as never, {} as never)
    await getPluginHook(plugin.load)?.call(context as never, virtualIdForResPath('res:/icons/64/icon.png'))

    const sentinel = JSON.stringify(jsAssetSentinel('res:/icons/64/icon.png'))
    const chunkCode = `module.exports = ${sentinel};`

    await getPluginHook(plugin.writeBundle)?.call(
      context as never,
      { dir: outputDir, format: 'cjs' } as never,
      {
        'index.js': {
          type: 'chunk',
          code: chunkCode,
          fileName: 'index.js',
        },
      } as never,
    )

    const written = await readFile(join(outputDir, 'index.js'), 'utf8')
    expect(written).toMatch(
      /module\.exports = require\("url"\)\.pathToFileURL\(require\("path"\)\.join\(__dirname, "\.\.\/assets\/icon-[\w-]+\.png"\)\)\.href;/,
    )
  })

  it('shares one asset file when css and js reference the same res path', async () => {
    const fetchMock = stubIndexFetch()

    const ctx = createResfileBuildContext({ buildNumber: '123456', cacheDir, root: cacheDir }, cacheDir)
    const plugin = createRollupResfilePlugin(ctx)
    const placeholderId = registerCssPlaceholder(ctx, 'res:/icons/64/icon.png')
    const token = cssPlaceholderToken(placeholderId)
    const context = {
      meta: { watchMode: false },
      info: vi.fn(),
    }

    await getPluginHook(plugin.buildStart)?.call(context as never, {} as never)
    await getPluginHook(plugin.load)?.call(context as never, virtualIdForResPath('res:/icons/64/icon.png'))

    await rewriteCssPlaceholders(ctx, 'index.css', `.icon { background: url("${token}"); }`, 'esm')

    const sentinel = JSON.stringify(jsAssetSentinel('res:/icons/64/icon.png'))
    await getPluginHook(plugin.writeBundle)?.call(
      context as never,
      { dir: join(cacheDir, 'dist', 'esm'), format: 'es' } as never,
      {
        'index.js': {
          type: 'chunk',
          code: `export default ${sentinel};`,
          fileName: 'index.js',
        },
      } as never,
    )

    expect(ctx.resolvedAssets.size).toBe(1)
    expect(fetchMock.mock.calls.filter((call) => String(call[0]).endsWith('/icons/icon_123.png'))).toHaveLength(1)
  })

  it('rewrites sentinels after renderChunk-style prefixes are added to chunk code', async () => {
    stubIndexFetch()

    const ctx = createResfileBuildContext({ buildNumber: '123456', cacheDir, root: cacheDir }, cacheDir)
    const plugin = createRollupResfilePlugin(ctx)
    const outputDir = join(cacheDir, 'dist', 'esm')
    const context = {
      meta: { watchMode: false },
      info: vi.fn(),
    }

    await getPluginHook(plugin.buildStart)?.call(context as never, {} as never)
    await getPluginHook(plugin.load)?.call(context as never, virtualIdForResPath('res:/icons/64/icon.png'))

    const sentinel = JSON.stringify(jsAssetSentinel('res:/icons/64/icon.png'))
    const chunkCode = `/* renderChunk banner */\nexport default ${sentinel};`

    await getPluginHook(plugin.writeBundle)?.call(
      context as never,
      { dir: outputDir, format: 'es' } as never,
      {
        'nested/chunk.js': {
          type: 'chunk',
          code: chunkCode,
          fileName: 'nested/chunk.js',
        },
      } as never,
    )

    const written = await readFile(join(outputDir, 'nested/chunk.js'), 'utf8')
    expect(written).toMatch(/\/\* renderChunk banner \*\//)
    expect(written).toMatch(
      /export default new URL\("\.\.\/\.\.\/assets\/icon-[\w-]+\.png", import\.meta\.url\)\.href;/,
    )
  })

  it('rejects rollup output directories outside distDir', async () => {
    const ctx = createResfileBuildContext({ buildNumber: '123456', cacheDir, root: cacheDir }, cacheDir)
    const plugin = createRollupResfilePlugin(ctx)
    const context = {
      meta: { watchMode: false },
      info: vi.fn(),
    }

    await getPluginHook(plugin.buildStart)?.call(context as never, {} as never)

    await expect(
      getPluginHook(plugin.writeBundle)?.call(
        context as never,
        { dir: join(cacheDir, 'build', 'esm'), format: 'es' } as never,
        {} as never,
      ),
    ).rejects.toThrow('Rollup output.dir must be a subdirectory of')
  })
})
