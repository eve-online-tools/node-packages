import { describe, expect, it } from 'vitest'
import type { RateLimitBucket, RateLimitState } from './types'
import {
  applyInFlightPenalty,
  buildRateLimitsView,
  calculateWaitMs,
  estimateBucketUsage,
  extractRateLimitKey,
  parseRateLimitLimitHeader,
  parseSubIdentifier,
} from './utils'

const makeJwt = (sub: string): string => {
  const encode = (value: Record<string, string>) =>
    btoa(JSON.stringify(value)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  return `${encode({ alg: 'none' })}.${encode({ sub })}.signature`
}

const makeRequest = (authorization?: string): Request =>
  new Request('https://esi.evetech.net/latest/status/', {
    headers: authorization ? { Authorization: authorization } : undefined,
  })

const sampleBucket = (overrides: Partial<RateLimitBucket> = {}): RateLimitBucket => ({
  remaining: 100,
  maxTokens: 150,
  windowMs: 15 * 60 * 1000,
  windowLabel: '15m',
  updatedAt: 1_000_000,
  ...overrides,
})

describe('parseSubIdentifier', () => {
  it('extracts IDENTIFIER from valid sub', () => {
    expect(parseSubIdentifier('CHARACTER:EVE:12345678')).toBe('12345678')
  })

  it('returns null when sub does not have two colons', () => {
    expect(parseSubIdentifier('CHARACTER:EVE')).toBeNull()
    expect(parseSubIdentifier('invalid')).toBeNull()
  })
})

describe('extractRateLimitKey', () => {
  it('uses IDENTIFIER from JWT sub', () => {
    const request = makeRequest(`Bearer ${makeJwt('CHARACTER:EVE:12345678')}`)
    expect(extractRateLimitKey(request)).toBe('12345678')
  })

  it('falls back to global without Authorization header', () => {
    expect(extractRateLimitKey(makeRequest())).toBe('global')
  })

  it('falls back to global for malformed JWT', () => {
    expect(extractRateLimitKey(makeRequest('Bearer not-a-jwt'))).toBe('global')
  })

  it('falls back to global for invalid sub structure', () => {
    const request = makeRequest(`Bearer ${makeJwt('CHARACTER:EVE')}`)
    expect(extractRateLimitKey(request)).toBe('global')
  })
})

describe('parseRateLimitLimitHeader', () => {
  it('parses seconds', () => {
    expect(parseRateLimitLimitHeader('30/1s')).toEqual({
      maxTokens: 30,
      windowMs: 1000,
      windowLabel: '1s',
    })
  })

  it('parses minutes', () => {
    expect(parseRateLimitLimitHeader('150/15m')).toEqual({
      maxTokens: 150,
      windowMs: 15 * 60 * 1000,
      windowLabel: '15m',
    })
  })

  it('parses hours', () => {
    expect(parseRateLimitLimitHeader('100/1h')).toEqual({
      maxTokens: 100,
      windowMs: 60 * 60 * 1000,
      windowLabel: '1h',
    })
  })

  it('parses days', () => {
    expect(parseRateLimitLimitHeader('500/1d')).toEqual({
      maxTokens: 500,
      windowMs: 24 * 60 * 60 * 1000,
      windowLabel: '1d',
    })
  })

  it('parses years', () => {
    expect(parseRateLimitLimitHeader('1000/1y')).toEqual({
      maxTokens: 1000,
      windowMs: 365 * 24 * 60 * 60 * 1000,
      windowLabel: '1y',
    })
  })

  it('returns null for invalid input', () => {
    expect(parseRateLimitLimitHeader('invalid')).toBeNull()
    expect(parseRateLimitLimitHeader(null)).toBeNull()
  })
})

describe('estimateBucketUsage', () => {
  it('regenerates tokens linearly over elapsed time', () => {
    const bucket = sampleBucket({ remaining: 30, updatedAt: 0 })
    const usage = estimateBucketUsage(bucket, bucket.windowMs / 2)

    expect(usage.estimatedRemaining).toBe(30 + bucket.maxTokens / 2)
    expect(usage.used).toBe(bucket.maxTokens - usage.estimatedRemaining)
    expect(usage.usage).toBe(usage.used / bucket.maxTokens)
  })

  it('caps estimated remaining at maxTokens', () => {
    const bucket = sampleBucket({ remaining: 140, updatedAt: 0 })
    const usage = estimateBucketUsage(bucket, bucket.windowMs)

    expect(usage.estimatedRemaining).toBe(150)
  })
})

describe('calculateWaitMs', () => {
  it('waits until min tokens when below threshold', () => {
    const bucket = sampleBucket({ remaining: 2, updatedAt: 1_000_000 })
    const waitMs = calculateWaitMs(bucket, { minTokens: 5, now: 1_000_000 })

    const timePerToken = bucket.windowMs / bucket.maxTokens
    expect(waitMs).toBe(3 * timePerToken)
  })

  it('waits proportionally when usage exceeds threshold', () => {
    const bucket = sampleBucket({ remaining: 50, updatedAt: 1_000_000 })
    const waitMs = calculateWaitMs(bucket, {
      minTokens: 5,
      usageThreshold: 0.5,
      now: 1_000_000,
    })

    const timePerToken = bucket.windowMs / bucket.maxTokens
    expect(waitMs).toBe(0.6666666666666666 * 5 * timePerToken)
  })

  it('does not wait when usage is low', () => {
    const bucket = sampleBucket({ remaining: 140, updatedAt: 1_000_000 })
    expect(calculateWaitMs(bucket, { minTokens: 5, usageThreshold: 0.5, now: 1_000_000 })).toBe(0)
  })
})

describe('applyInFlightPenalty', () => {
  it('reduces remaining by in-flight token cost', () => {
    const bucket = sampleBucket({ remaining: 20 })
    const adjusted = applyInFlightPenalty(bucket, 3, 2)
    expect(adjusted.remaining).toBe(14)
  })
})

describe('buildRateLimitsView', () => {
  it('groups buckets and paths for display', () => {
    const bucket = sampleBucket()
    const state: RateLimitState = {
      pathGroups: {
        '/status/': 'status',
        '/characters/{character_id}/location/': 'char-location',
      },
      buckets: {
        status: {
          '12345678': bucket,
        },
        'char-location': {
          global: {
            ...bucket,
            remaining: 80,
          },
        },
      },
    }

    const view = buildRateLimitsView(state, bucket.updatedAt)

    expect(view.updatedAt).toBe(bucket.updatedAt)
    expect(view.groups).toHaveLength(2)

    const statusGroup = view.groups.find((group) => group.group === 'status')
    expect(statusGroup).toMatchObject({
      limit: '150/15m',
      maxTokens: 150,
      windowLabel: '15m',
      paths: ['/status/'],
    })
    expect(statusGroup?.buckets).toHaveLength(1)
    expect(statusGroup?.buckets[0].rateLimitKey).toBe('12345678')

    const locationGroup = view.groups.find((group) => group.group === 'char-location')
    expect(locationGroup?.paths).toEqual(['/characters/{character_id}/location/'])
    expect(locationGroup?.buckets[0].rateLimitKey).toBe('global')
  })
})
