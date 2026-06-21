import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import {
  getPluginHook,
  mockBuildNumber,
  samplePngBytes,
  sampleResPath,
  stubResfileCdnFetch,
  testAllowedHosts,
} from '../test-utils/mock-cdn'
import { createEveResfileIntegration } from '../integration-factory'
import { eveResfile, vitePlugin } from './index'

describe('vite plugin', () => {
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'eve-resfile-vite-'))
  })

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('resolves res imports and loads dev proxy modules in watch mode', async () => {
    stubResfileCdnFetch()

    const plugin = eveResfile({ buildNumber: mockBuildNumber, cacheDir, root: cacheDir })
    const context = {
      meta: { watchMode: true },
      info: vi.fn(),
      emitFile: vi.fn(() => 'asset-ref'),
    }

    await getPluginHook(plugin.configResolved)?.call(context as never, { root: cacheDir } as never)
    await getPluginHook(plugin.buildStart)?.call(context as never, {} as never)

    const resolvedId = await getPluginHook(plugin.resolveId)?.call(
      context as never,
      sampleResPath,
      undefined,
      {} as never,
    )
    expect(resolvedId).toContain(sampleResPath)

    const moduleSource = await getPluginHook(plugin.load)?.call(context as never, resolvedId as string)
    expect(moduleSource).toEqual({
      code: 'export default "/__eve_res__/icons%2F64%2Ficon.png"',
      moduleType: 'js',
    })
  })

  it('emits CDN assets in production builds', async () => {
    stubResfileCdnFetch({ includeAssets: true })

    const plugin = eveResfile({ buildNumber: mockBuildNumber, cacheDir, root: cacheDir })
    const context = {
      meta: { watchMode: false },
      info: vi.fn(),
      emitFile: vi.fn(() => 'asset-ref'),
    }

    await getPluginHook(plugin.configResolved)?.call(context as never, { root: cacheDir } as never)
    await getPluginHook(plugin.buildStart)?.call(context as never, {} as never)

    const resolvedId = await getPluginHook(plugin.resolveId)?.call(
      context as never,
      sampleResPath,
      undefined,
      {} as never,
    )

    const moduleSource = await getPluginHook(plugin.load)?.call(context as never, resolvedId as string)
    expect(moduleSource).toEqual({
      code: 'export default import.meta.ROLLUP_FILE_URL_asset-ref',
      moduleType: 'js',
    })
    expect(context.emitFile).toHaveBeenCalledWith({
      type: 'asset',
      name: 'icon.png',
      source: samplePngBytes,
    })
  })

  it('throws when configureServer runs before configResolved', () => {
    const integration = createEveResfileIntegration({ buildNumber: mockBuildNumber, cacheDir, root: cacheDir })
    const plugin = vitePlugin(integration)
    const context = {
      meta: { watchMode: true },
      info: vi.fn(),
      emitFile: vi.fn(() => 'asset-ref'),
    }

    const configureServer = plugin.configureServer
    const handler = typeof configureServer === 'function' ? configureServer : configureServer?.handler

    expect(() =>
      handler?.call(
        context as never,
        {
          middlewares: {
            use: vi.fn(),
          },
        } as never,
      ),
    ).toThrow('configResolved must run before configureServer')
  })

  it('uses configured assetOrigin in dev middleware', async () => {
    const fetchMock = stubResfileCdnFetch({ includeAssets: true })

    const integration = createEveResfileIntegration({
      buildNumber: mockBuildNumber,
      cacheDir,
      root: cacheDir,
      indexOrigin: 'https://binaries.test',
      assetOrigin: 'https://resources.test',
      allowedHosts: testAllowedHosts,
    })
    const plugin = vitePlugin(integration)
    const context = {
      meta: { watchMode: true },
      info: vi.fn(),
      emitFile: vi.fn(() => 'asset-ref'),
    }

    await getPluginHook(plugin.configResolved)?.call(context as never, { root: cacheDir } as never)
    await getPluginHook(plugin.buildStart)?.call(context as never, {} as never)

    const middlewares: Array<
      (
        req: { url?: string; method?: string },
        res: { statusCode: number; setHeader: (name: string, value: string) => void; end: (body?: Buffer) => void },
        next: () => void,
      ) => void | Promise<void>
    > = []

    const configureServer = plugin.configureServer
    const handler = typeof configureServer === 'function' ? configureServer : configureServer?.handler

    handler?.call(
      context as never,
      {
        middlewares: {
          use(middleware: (typeof middlewares)[number]) {
            middlewares.push(middleware)
          },
        },
      } as never,
    )

    const next = vi.fn()
    const response = {
      statusCode: 200,
      setHeader: vi.fn(),
      end: vi.fn(),
    }

    await middlewares[0]?.({ url: '/__eve_res__/icons%2F64%2Ficon.png', method: 'GET' }, response, next)

    expect(next).not.toHaveBeenCalled()
    expect(fetchMock.mock.calls.some((call) => String(call[0]) === 'https://resources.test/icons/icon_123.png')).toBe(
      true,
    )
    expect(response.end).toHaveBeenCalledWith(samplePngBytes)
  })
})
