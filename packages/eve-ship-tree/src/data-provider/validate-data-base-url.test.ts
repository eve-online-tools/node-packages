import { describe, expect, it } from 'vitest'

import { assertSafeDataBaseUrl } from './validate-data-base-url'

describe('assertSafeDataBaseUrl', () => {
  it('rejects private network hosts', () => {
    expect(() => assertSafeDataBaseUrl('http://127.0.0.1/data')).toThrow(/private networks/)
    expect(() => assertSafeDataBaseUrl('http://localhost/data')).toThrow(/private networks/)
  })

  it('rejects origins outside an allowlist', () => {
    expect(() => assertSafeDataBaseUrl('https://evil.example/data', ['https://cdn.example.com'])).toThrow(/not allowed/)
  })

  it('accepts allowed public origins', () => {
    expect(() =>
      assertSafeDataBaseUrl('https://cdn.example.com/ship-tree-data', ['https://cdn.example.com']),
    ).not.toThrow()
  })
})
