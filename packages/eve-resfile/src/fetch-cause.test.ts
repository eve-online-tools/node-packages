import { describe, expect, it } from 'vitest'

import { describeFetchFailure } from './fetch-cause'

describe('describeFetchFailure', () => {
  it('labels request timeouts explicitly', () => {
    expect(
      describeFetchFailure(new DOMException('The operation was aborted.', 'AbortError'), {
        timedOut: true,
        timeoutMs: 30_000,
      }),
    ).toBe('request timed out after 30000ms')
  })

  it('walks nested error causes and surfaces errno codes', () => {
    const cause = Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' })
    const error = new TypeError('fetch failed', { cause })

    expect(
      describeFetchFailure(error, {
        timedOut: false,
        timeoutMs: 30_000,
      }),
    ).toBe('ECONNRESET ← read ECONNRESET')
  })

  it('falls back when no useful details are available', () => {
    expect(
      describeFetchFailure(new TypeError('fetch failed'), {
        timedOut: false,
        timeoutMs: 30_000,
      }),
    ).toBe('network error (no HTTP response)')
  })
})
