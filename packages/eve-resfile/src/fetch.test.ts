import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { defaultFetchTimeoutMs } from './constants'
import { fetchBuffer, fetchText, FetchError, isFetchError } from './fetch'

describe('fetch helpers', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not retry HTTP 404', async () => {
    const fetchMock = vi.fn(async () => new Response('missing', { status: 404 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchText('https://cdn.test/missing.png')).rejects.toThrow(
      'Not found: https://cdn.test/missing.png (HTTP 404).',
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries transient HTTP errors and succeeds', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('error', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok'))

    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchText('https://cdn.test/index.txt')
    await vi.advanceTimersByTimeAsync(250)
    const result = await promise

    expect(result).toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('waits for Retry-After on HTTP 429', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('slow down', { status: 429, headers: { 'Retry-After': '1' } }))
      .mockResolvedValueOnce(new Response('ok'))

    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchText('https://cdn.test/index.txt')
    await vi.advanceTimersByTimeAsync(999)
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1)
    await expect(promise).resolves.toBe('ok')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting retries', async () => {
    const fetchMock = vi.fn(async () => new Response('error', { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchText('https://cdn.test/index.txt')
    let caught: unknown
    void promise.catch((error) => {
      caught = error
    })
    await vi.advanceTimersByTimeAsync(250 + 500 + 1000)

    expect(isFetchError(caught)).toBe(true)
    expect((caught as FetchError).formatDetail()).toBe('HTTP 503 → 503 → 503 → 503; after 4 attempts')

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('includes rate-limit headers in exhausted retry errors', async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response('slow down', {
          status: 429,
          headers: {
            'Retry-After': '2',
            'X-RateLimit-Remaining': '0',
          },
        }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchText('https://cdn.test/icon.png')
    let caught: unknown
    void promise.catch((error) => {
      caught = error
    })
    await vi.advanceTimersByTimeAsync(2_000 * 3 + 250 + 500 + 1_000)

    expect(isFetchError(caught)).toBe(true)
    expect((caught as FetchError).formatDetail()).toBe(
      'HTTP 429 → 429 → 429 → 429; after 4 attempts; retry-after: 2, x-ratelimit-remaining: 0',
    )

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('rejects when the request times out', async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      return new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal
        signal?.addEventListener('abort', () => {
          reject(new DOMException('The operation was aborted.', 'AbortError'))
        })
      })
    })
    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchText('https://cdn.test/slow.png', { timeoutMs: 1_000 })
    let caught: unknown
    void promise.catch((error) => {
      caught = error
    })
    await vi.advanceTimersByTimeAsync(4_000 + 250 + 500 + 1_000)

    expect(isFetchError(caught)).toBe(true)
    expect((caught as FetchError).formatDetail()).toMatch(
      /network: request timed out after 1000ms → request timed out after 1000ms/,
    )

    expect(fetchMock.mock.calls.length).toBeGreaterThanOrEqual(4)
  })

  it('does not retry when an external abort signal is triggered', async () => {
    const fetchMock = vi.fn(async () => new Response('error', { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    const controller = new AbortController()
    controller.abort()

    await expect(fetchText('https://cdn.test/index.txt', { signal: controller.signal })).rejects.toThrow(/aborted/i)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns buffers from successful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(Buffer.from('png-bytes'))),
    )

    await expect(fetchBuffer('https://cdn.test/icon.png')).resolves.toEqual(Buffer.from('png-bytes'))
  })

  it('includes nested network error causes after exhausting retries', async () => {
    const fetchMock = vi.fn(async () => {
      const cause = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
      throw new TypeError('fetch failed', { cause })
    })
    vi.stubGlobal('fetch', fetchMock)

    const promise = fetchText('https://cdn.test/icon.png')
    let caught: unknown
    void promise.catch((error) => {
      caught = error
    })
    await vi.advanceTimersByTimeAsync(250 + 500 + 1000)

    expect(isFetchError(caught)).toBe(true)
    expect((caught as FetchError).formatDetail()).toBe(
      'network: ECONNRESET ← read ECONNRESET → ECONNRESET ← read ECONNRESET → ECONNRESET ← read ECONNRESET → ECONNRESET ← read ECONNRESET; after 4 attempts',
    )

    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('limits parallel in-flight fetches when a concurrency gate is configured', async () => {
    let inFlight = 0
    let maxInFlight = 0

    const fetchMock = vi.fn(async () => {
      inFlight++
      maxInFlight = Math.max(maxInFlight, inFlight)
      await new Promise((resolve) => setTimeout(resolve, 50))
      inFlight--
      return new Response('ok')
    })
    vi.stubGlobal('fetch', fetchMock)

    const { createFetchConcurrencyGate } = await import('./fetch-concurrency')
    const gate = createFetchConcurrencyGate(2)

    const requests = Array.from({ length: 4 }, (_, index) =>
      fetchText(`https://cdn.test/icon-${index}.png`, { concurrencyGate: gate }),
    )

    await vi.advanceTimersByTimeAsync(200)
    await Promise.all(requests)

    expect(maxInFlight).toBeLessThanOrEqual(2)
    expect(fetchMock).toHaveBeenCalledTimes(4)
  })

  it('uses the default fetch timeout', () => {
    expect(defaultFetchTimeoutMs).toBe(30_000)
  })
})
