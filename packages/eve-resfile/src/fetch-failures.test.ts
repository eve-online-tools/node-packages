import { describe, expect, it, vi } from 'vitest'

import { FetchError } from './fetch'
import { resetFetchFailureLog, summarizeFetchFailures, warnMissingResPath } from './fetch-failures'

describe('fetch failure logging', () => {
  afterEach(() => {
    resetFetchFailureLog()
    vi.restoreAllMocks()
  })

  it('includes CDN URLs and fetch error details in warnings', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const error = new FetchError({
      url: 'https://resources.test/icons/icon.png',
      attempts: 4,
      statusHistory: [],
      causeHistory: ['ECONNRESET ← read ECONNRESET'],
      rateLimitHeaders: {},
    })

    warnMissingResPath('res:/icons/64/icon.png', '123456', 'Failed to fetch resfile from CDN', {
      error,
      cdnUrl: 'https://resources.test/icons/icon.png',
    })

    expect(warnSpy).toHaveBeenCalledWith(
      '[eve-resfile] Failed to fetch resfile from CDN: res:/icons/64/icon.png → https://resources.test/icons/icon.png (build 123456) — network: ECONNRESET ← read ECONNRESET; after 4 attempts\n',
    )
  })

  it('prints a build summary with hints for network failures', () => {
    const warnSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    const error = new FetchError({
      url: 'https://resources.test/icons/icon.png',
      attempts: 4,
      statusHistory: [],
      causeHistory: ['ECONNRESET ← read ECONNRESET'],
      rateLimitHeaders: {},
    })

    warnMissingResPath('res:/icons/64/icon.png', '123456', 'Failed to fetch resfile from CDN', { error })
    summarizeFetchFailures(8)

    expect(warnSpy.mock.calls.at(-1)?.[0]).toBe(
      '  Hint: connection errors without HTTP status usually mean the CDN dropped requests before responding — often from too many parallel fetches (fetchConcurrency=8). Try lowering fetchConcurrency in eve-resfile options.\n',
    )
  })
})
