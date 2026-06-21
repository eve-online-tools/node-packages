import { devProxyUrl, lookupCdnPath, normalizeResPath, resPathFromDevProxyUrl } from './lookup'

describe('lookup', () => {
  const index = new Map([
    ['res:/icons/64/icon.png', 'icons/icon_123.png'],
    ['res:/ui/window.png', 'ui/window_456.png'],
  ])

  it('normalizes res imports', () => {
    expect(normalizeResPath('res:/icons/64/icon.png')).toBe('res:/icons/64/icon.png')
    expect(normalizeResPath('res:icons/64/icon.png')).toBe('res:/icons/64/icon.png')
    expect(normalizeResPath('res:/icons/64/icon.png?v=1')).toBe('res:/icons/64/icon.png')
  })

  it('rejects invalid res imports', () => {
    expect(() => normalizeResPath('https://example.com/icon.png')).toThrow(
      'Invalid res import "https://example.com/icon.png". Expected a path starting with "res:/".',
    )
  })

  it('looks up CDN paths', () => {
    expect(lookupCdnPath(index, 'res:/icons/64/icon.png')).toBe('icons/icon_123.png')
    expect(lookupCdnPath(index, 'res:/missing.png')).toBeUndefined()
  })

  it('round-trips dev proxy URLs', () => {
    const resPath = 'res:/icons/64/icon.png'
    const proxyUrl = devProxyUrl(resPath)

    expect(proxyUrl).toBe('/__eve_res__/icons%2F64%2Ficon.png')
    expect(resPathFromDevProxyUrl(proxyUrl)).toBe(resPath)
    expect(resPathFromDevProxyUrl('/__eve_res__/')).toBeNull()
  })
})
