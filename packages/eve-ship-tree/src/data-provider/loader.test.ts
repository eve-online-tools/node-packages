import { describe, expect, it, vi } from 'vitest'

import { filenames } from '../data/generated'
import { loadShipTreeData } from './loader'

const emptyJsonl = '\n'

const createFetchStub = (responses: Record<string, string | Response> = {}): typeof fetch =>
  vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input)
    const fileName = url.split('/').pop() ?? ''

    if (responses[fileName] instanceof Response) {
      return responses[fileName] as Response
    }

    if (responses[fileName] !== undefined) {
      return new Response(responses[fileName] as string, { status: 200 })
    }

    return new Response(emptyJsonl, { status: 200 })
  }) as typeof fetch

describe('loadShipTreeData', () => {
  it('loads every manifest table with normalized baseUrl', async () => {
    const fetchImpl = createFetchStub()

    const data = await loadShipTreeData({
      baseUrl: '/ship-tree-data/',
      fetch: fetchImpl,
      validateBaseUrl: false,
    })

    expect(Object.keys(data).sort()).toEqual(filenames.map((fileName) => fileName.replace(/\.jsonl$/, '')).sort())

    for (const fileName of filenames) {
      expect(fetchImpl).toHaveBeenCalledWith(
        `/ship-tree-data/${fileName}`,
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      )
    }
  })

  it('throws with the filename when a fetch fails', async () => {
    const fetchImpl = createFetchStub({
      'certificates.jsonl': new Response(null, {
        status: 500,
        statusText: 'Server Error',
      }),
    })

    await expect(
      loadShipTreeData({
        baseUrl: '/ship-tree-data',
        fetch: fetchImpl,
        validateBaseUrl: false,
      }),
    ).rejects.toThrow(/certificates\.jsonl.*500 Server Error/)
  })

  it('rejects unsafe absolute base URLs when validation is enabled', async () => {
    await expect(
      loadShipTreeData({ baseUrl: 'http://127.0.0.1/ship-tree-data', validateBaseUrl: true }),
    ).rejects.toThrow(/private networks/)
  })

  it('allows same-origin relative base URLs without validation', async () => {
    const fetchImpl = createFetchStub()

    await expect(
      loadShipTreeData({
        baseUrl: '/ship-tree-data',
        fetch: fetchImpl,
      }),
    ).resolves.toBeDefined()
  })
})
