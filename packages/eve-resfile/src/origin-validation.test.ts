import { assertAllowedOrigin } from './origin-validation'
import { defaultAllowedHosts } from './constants'

describe('assertAllowedOrigin', () => {
  it('accepts default EVE production origins', () => {
    expect(assertAllowedOrigin('https://binaries.eveonline.com', 'indexOrigin')).toBe('https://binaries.eveonline.com')
    expect(assertAllowedOrigin('https://resources.eveonline.com', 'assetOrigin')).toBe(
      'https://resources.eveonline.com',
    )
  })

  it('rejects private and link-local hosts', () => {
    expect(() => assertAllowedOrigin('http://127.0.0.1:8080', 'indexOrigin')).toThrow(
      'private or link-local hosts are not allowed',
    )
    expect(() => assertAllowedOrigin('https://169.254.169.254', 'indexOrigin')).toThrow(
      'private or link-local hosts are not allowed',
    )
  })

  it('rejects hosts outside the allowed list', () => {
    expect(() => assertAllowedOrigin('https://example.com', 'indexOrigin')).toThrow('not in the allowed host list')
  })

  it('allows custom mirrors through allowedHosts', () => {
    expect(assertAllowedOrigin('https://mirror.example', 'indexOrigin', ['mirror.example'])).toBe(
      'https://mirror.example',
    )
  })

  it('rejects non-https origins except localhost http', () => {
    expect(() => assertAllowedOrigin('http://binaries.eveonline.com', 'indexOrigin')).toThrow(
      'only https origins are allowed',
    )
    expect(assertAllowedOrigin('http://localhost:3000', 'indexOrigin', ['localhost'])).toBe('http://localhost:3000')
  })

  it('uses the default allowed host list', () => {
    expect(defaultAllowedHosts).toEqual(['binaries.eveonline.com', 'resources.eveonline.com'])
  })
})
