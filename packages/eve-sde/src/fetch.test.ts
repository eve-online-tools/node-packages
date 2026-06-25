import { fetchText } from './fetch'

describe('fetch', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('retries retryable HTTP status codes', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchText('https://example.com/sde')).resolves.toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('aborts hung requests after the timeout', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          const error = new Error('The operation was aborted')
          error.name = 'AbortError'
          reject(error)
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchText('https://example.com/sde', { timeoutMs: 25, retries: 1 })).rejects.toMatchObject({
      name: 'AbortError',
    })
  })
})
