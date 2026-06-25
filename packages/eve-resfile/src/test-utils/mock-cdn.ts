import { resfileIndexPath } from '../constants'

export const mockBuildNumber = '123456'
export const testAllowedHosts = ['binaries.test', 'resources.test'] as const
export const sampleResPath = 'res:/icons/64/icon.png'
export const sampleCdnPath = 'icons/icon_123.png'
export const samplePngBytes = Buffer.from('png-bytes')

export const mockBuildIndexLine = `${resfileIndexPath},resindex/resfileindex.txt,hash`

export const mockResfileIndexContent = `${sampleResPath},${sampleCdnPath},hash`

export const getPluginHook = <T extends (...args: never[]) => unknown>(
  hook: T | { handler: T } | undefined,
): T | undefined => {
  if (!hook) {
    return undefined
  }

  if (typeof hook === 'function') {
    return hook
  }

  return hook.handler
}

type StubResfileCdnFetchOptions = {
  buildNumber?: string
  includeAssets?: boolean
}

export const stubResfileCdnFetch = ({
  buildNumber = mockBuildNumber,
  includeAssets = false,
}: StubResfileCdnFetchOptions = {}) => {
  const fetchMock = vi.fn(async (url: string | URL) => {
    const href = String(url)

    if (href.endsWith('/eveclient_TQ.json')) {
      return new Response(JSON.stringify({ buildNumber }))
    }

    if (href.endsWith(`/eveonline_${buildNumber}.txt`)) {
      return new Response(mockBuildIndexLine)
    }

    if (href.endsWith('/resindex/resfileindex.txt')) {
      return new Response(mockResfileIndexContent)
    }

    if (includeAssets && href.endsWith(`/${sampleCdnPath}`)) {
      return new Response(samplePngBytes)
    }

    return new Response('not found', { status: 404 })
  })

  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}
