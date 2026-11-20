import { emptyData } from '../test/render-with-ship-tree-providers'
import { loadShipTreeData } from './loader'

const source = { url: '/assets/ship-tree-data.json' }

describe('loadShipTreeData', () => {
  it('fetches the dataset url and returns its tables', async () => {
    const data = { ...emptyData(), types: { 582: { name: { en: 'Bantam' }, shipTreeGroupID: 4 } } }
    const fetchImpl = vi.fn(async () => Response.json(data))

    await expect(loadShipTreeData(source, { fetch: fetchImpl })).resolves.toEqual(data)
    expect(fetchImpl).toHaveBeenCalledWith(source.url, expect.objectContaining({ signal: expect.any(AbortSignal) }))
  })

  it('throws with the status when the request fails', async () => {
    const fetchImpl = vi.fn(async () => new Response(null, { status: 404, statusText: 'Not Found' }))

    await expect(loadShipTreeData(source, { fetch: fetchImpl })).rejects.toThrow(/404 Not Found/)
  })

  it('rejects files without the required tables', async () => {
    const { masteries: _masteries, shipSizes: _shipSizes, ...partial } = emptyData()
    const fetchImpl = vi.fn(async () => Response.json(partial))

    await expect(loadShipTreeData(source, { fetch: fetchImpl })).rejects.toThrow('missing tables: masteries, shipSizes')
  })
})
