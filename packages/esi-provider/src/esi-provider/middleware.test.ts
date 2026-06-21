import { describe, expect, it } from 'vitest'
import { assertUniqueMiddlewareKeys, combineInitialState, createRootReducer } from './middleware'
import type { Middleware } from './types'

const createStubMiddleware = (key: string): Middleware => ({
  key,
  initialState: { value: key },
  reducer: (state) => state,
  onRequest: () => {},
})

describe('assertUniqueMiddlewareKeys', () => {
  it('accepts unique middleware keys', () => {
    expect(() =>
      assertUniqueMiddlewareKeys([createStubMiddleware('auth'), createStubMiddleware('rateLimit')]),
    ).not.toThrow()
  })

  it('throws when middleware keys are duplicated', () => {
    expect(() =>
      assertUniqueMiddlewareKeys([createStubMiddleware('rateLimit'), createStubMiddleware('rateLimit')]),
    ).toThrowError('Duplicate middleware key "rateLimit"')
  })
})

describe('combineInitialState', () => {
  it('throws for duplicate keys before building state', () => {
    expect(() =>
      combineInitialState([createStubMiddleware('rateLimit'), createStubMiddleware('rateLimit')]),
    ).toThrowError('Duplicate middleware key "rateLimit"')
  })
})

describe('createRootReducer', () => {
  it('throws for duplicate keys before creating reducer', () => {
    expect(() =>
      createRootReducer([createStubMiddleware('rateLimit'), createStubMiddleware('rateLimit')]),
    ).toThrowError('Duplicate middleware key "rateLimit"')
  })
})
