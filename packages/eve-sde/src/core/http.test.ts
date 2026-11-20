import { SdeNetworkError } from './errors'
import { request } from './http'

describe('request', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('names the URL when the network fails after retries', async () => {
    vi.useFakeTimers()
    const fetch = vi.fn(() => Promise.reject(new TypeError('fetch failed')))
    const result = request(fetch, 'https://sde.evetech.net/latest/').catch((error: unknown) => error)
    await vi.runAllTimersAsync()

    const error = await result
    expect(error).toBeInstanceOf(SdeNetworkError)
    expect((error as Error).message).toContain('https://sde.evetech.net/latest/')
    expect(fetch).toHaveBeenCalledTimes(4)
  })
})
