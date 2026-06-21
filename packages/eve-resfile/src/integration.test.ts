import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import postcss from 'postcss'

import { createEveResfileIntegration } from './integration-factory'
import { postcssPlugin } from './postcss/index'
import {
  getPluginHook,
  mockBuildNumber,
  samplePngBytes,
  sampleResPath,
  stubResfileCdnFetch,
} from './test-utils/mock-cdn'
import { vitePlugin } from './vite/index'

describe('vite + postcss integration', () => {
  let cacheDir: string

  beforeEach(async () => {
    cacheDir = await mkdtemp(join(tmpdir(), 'eve-resfile-integration-'))
  })

  afterEach(async () => {
    await rm(cacheDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('shares one integration context across JS and CSS in dev mode', async () => {
    const fetchMock = stubResfileCdnFetch({ includeAssets: false })
    const integration = createEveResfileIntegration({ buildNumber: mockBuildNumber, cacheDir, root: cacheDir })
    const plugin = vitePlugin(integration)
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
    const moduleSource = await getPluginHook(plugin.load)?.call(context as never, resolvedId as string)

    const cssResult = await postcss([postcssPlugin(integration, { target: 'dev-proxy' })]).process(
      `.icon { background-image: url("${sampleResPath}"); }`,
      { from: undefined },
    )

    expect(moduleSource).toEqual({
      code: 'export default "/__eve_res__/icons%2F64%2Ficon.png"',
      moduleType: 'js',
    })
    expect(cssResult.css).toBe('.icon { background-image: url(/__eve_res__/icons%2F64%2Ficon.png); }')
    expect(integration.ctx.cssPlaceholders.size).toBe(0)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('loads the index once for both JS and CSS plugin hooks', async () => {
    const fetchMock = stubResfileCdnFetch({ includeAssets: true })
    const integration = createEveResfileIntegration({ buildNumber: mockBuildNumber, cacheDir, root: cacheDir })
    const plugin = vitePlugin(integration)
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
    await getPluginHook(plugin.load)?.call(context as never, resolvedId as string)

    const cssResult = await postcss([postcssPlugin(integration)]).process(
      `.icon { background-image: url("${sampleResPath}"); }`,
      { from: undefined },
    )

    expect(integration.ctx.index).not.toBeNull()
    expect(integration.ctx.cssPlaceholders.size).toBe(1)
    expect(cssResult.css).toMatch(/__EVE_RESFILE_[a-f0-9]+__/)
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it('wires configureServer middleware for dev proxy requests', async () => {
    stubResfileCdnFetch({ includeAssets: true })
    const integration = createEveResfileIntegration({ buildNumber: mockBuildNumber, cacheDir, root: cacheDir })
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
    const headers = new Map<string, string>()
    let body: Buffer | undefined
    const response = {
      statusCode: 200,
      setHeader(name: string, value: string) {
        headers.set(name, value)
      },
      end(value?: Buffer) {
        body = value
      },
    }

    await middlewares[0]?.({ url: '/__eve_res__/icons%2F64%2Ficon.png', method: 'GET' }, response, next)

    expect(next).not.toHaveBeenCalled()
    expect(response.statusCode).toBe(200)
    expect(headers.get('Content-Type')).toBe('image/png')
    expect(body).toEqual(samplePngBytes)
  })
})
