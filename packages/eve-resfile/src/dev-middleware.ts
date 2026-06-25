import { contentTypeForPath } from './content-type'
import { devProxyPrefix } from './constants'
import { fetchBuffer } from './fetch'
import { resPathFromDevProxyUrl } from './lookup'
import { lookupResPath, warnMissingResPath } from './plugin-core'
import type { MissingResPathBehavior, ResfileIndex } from './types'

type DevServerRequest = {
  url?: string
  method?: string
}

type DevServerResponse = {
  statusCode: number
  setHeader(name: string, value: string): void
  end(body?: string | Buffer): void
}

type DevServerNext = () => void

export type DevProxyMiddleware = (
  req: DevServerRequest,
  res: DevServerResponse,
  next: DevServerNext,
) => void | Promise<void>

export const createDevProxyMiddleware = (
  ensureIndex: () => Promise<ResfileIndex>,
  assetOrigin: string | (() => string),
  missingResPath: MissingResPathBehavior | (() => MissingResPathBehavior) = 'warn-and-empty',
  fetchTimeoutMs?: number | (() => number | undefined),
): DevProxyMiddleware => {
  const readAssetOrigin = () => (typeof assetOrigin === 'function' ? assetOrigin() : assetOrigin)
  const readMissingResPath = () => (typeof missingResPath === 'function' ? missingResPath() : missingResPath)
  const readFetchTimeoutMs = () => (typeof fetchTimeoutMs === 'function' ? fetchTimeoutMs() : fetchTimeoutMs)

  return async (req, res, next) => {
    if (!req.url || req.method !== 'GET') {
      next()
      return
    }

    const pathname = req.url.split(/[?#]/)[0] ?? req.url
    if (!pathname.startsWith(devProxyPrefix)) {
      next()
      return
    }

    const resPath = resPathFromDevProxyUrl(pathname)
    if (!resPath) {
      res.statusCode = 400
      res.end('Invalid resfile proxy path.')
      return
    }

    const missingBehavior = readMissingResPath()

    let cdnPath: string | undefined
    try {
      const index = await ensureIndex()
      const lookup = lookupResPath(index, resPath, missingBehavior)
      if (!lookup.ok) {
        res.statusCode = 404
        res.end('Resfile not found.')
        return
      }
      cdnPath = lookup.cdnPath
    } catch (error) {
      res.statusCode = 404
      res.end(error instanceof Error ? error.message : 'Resfile not found.')
      return
    }

    try {
      const buffer = await fetchBuffer(`${readAssetOrigin()}/${cdnPath}`, {
        timeoutMs: readFetchTimeoutMs(),
      })
      res.statusCode = 200
      res.setHeader('Content-Type', contentTypeForPath(resPath))
      res.setHeader('Cache-Control', 'public, max-age=86400')
      res.end(buffer)
    } catch (error) {
      if (missingBehavior === 'warn-and-empty') {
        const index = await ensureIndex()
        warnMissingResPath(resPath, index.buildNumber, 'Failed to fetch resfile from CDN', {
          error,
          cdnUrl: `${readAssetOrigin()}/${cdnPath}`,
        })
        res.statusCode = 404
        res.end('Resfile not found.')
        return
      }

      res.statusCode = 502
      res.end(error instanceof Error ? error.message : 'Failed to fetch resfile from CDN.')
    }
  }
}
