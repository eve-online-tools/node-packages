import { createDevProxyMiddleware } from './dev-middleware'
import { devProxyUrl } from './lookup'
import type { ResfileIndex } from './types'

describe('dev-middleware', () => {
  const index: ResfileIndex = {
    buildNumber: '123456',
    resPathToCdnPath: new Map([['res:/icons/64/icon.png', 'icons/icon_123.png']]),
  }

  const createResponse = () => {
    const headers = new Map<string, string>()
    let body: string | Buffer | undefined

    return {
      statusCode: 200,
      setHeader(name: string, value: string) {
        headers.set(name, value)
      },
      end(value?: string | Buffer) {
        body = value
      },
      get headers() {
        return headers
      },
      get body() {
        return body
      },
    }
  }

  it('passes through unrelated requests', async () => {
    const middleware = createDevProxyMiddleware(async () => index, 'https://resources.test')
    const next = vi.fn()
    const res = createResponse()

    await middleware({ url: '/other', method: 'GET' }, res, next)

    expect(next).toHaveBeenCalled()
  })

  it('proxies resfile assets from the CDN', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(Buffer.from('png-bytes'))),
    )

    const middleware = createDevProxyMiddleware(async () => index, 'https://resources.test')
    const next = vi.fn()
    const res = createResponse()
    const proxyUrl = devProxyUrl('res:/icons/64/icon.png')

    await middleware({ url: proxyUrl, method: 'GET' }, res, next)

    expect(next).not.toHaveBeenCalled()
    expect(res.statusCode).toBe(200)
    expect(res.headers.get('Content-Type')).toBe('image/png')
    expect(res.body).toEqual(Buffer.from('png-bytes'))
    vi.unstubAllGlobals()
  })
})
