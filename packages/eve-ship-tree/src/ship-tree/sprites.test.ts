import { afterEach, describe, expect, it, vi } from 'vitest'

describe('preloadShipTreeSprites', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.resetModules()
  })

  it('decodes every sprite once', async () => {
    const decoded: string[] = []
    vi.stubGlobal(
      'Image',
      class {
        src = ''
        decode() {
          decoded.push(this.src)
          return Promise.resolve()
        }
      },
    )
    const { preloadShipTreeSprites, shipTreeSprites } = await import('./sprites')
    await preloadShipTreeSprites()
    await preloadShipTreeSprites()
    expect(shipTreeSprites).toHaveLength(26)
    expect(decoded).toEqual(shipTreeSprites)
  })

  it('ignores decode failures', async () => {
    vi.stubGlobal(
      'Image',
      class {
        src = ''
        decode() {
          return Promise.reject(new Error('broken'))
        }
      },
    )
    const { preloadShipTreeSprites } = await import('./sprites')
    await expect(preloadShipTreeSprites()).resolves.toBeUndefined()
  })
})
