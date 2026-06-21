import { RES_IMPORT_PREFIX } from './constants'

export const normalizeResPath = (source: string): string => {
  const withoutQuery = source.split(/[?#]/)[0] ?? source

  if (withoutQuery.startsWith(RES_IMPORT_PREFIX)) {
    return withoutQuery
  }

  if (withoutQuery.startsWith('res:')) {
    const path = withoutQuery.slice('res:'.length)
    return path.startsWith('/') ? `res:${path}` : `res:/${path}`
  }

  throw new Error(`Invalid res import "${source}". Expected a path starting with "res:/".`)
}

export const lookupCdnPath = (index: Map<string, string>, resPath: string): string | undefined => index.get(resPath)

export const devProxyUrl = (resPath: string): string => {
  const encoded = encodeURIComponent(resPath.slice(RES_IMPORT_PREFIX.length))
  return `/__eve_res__/${encoded}`
}

export const resPathFromDevProxyUrl = (pathname: string): string | null => {
  if (!pathname.startsWith('/__eve_res__/')) {
    return null
  }

  const encoded = pathname.slice('/__eve_res__/'.length)
  if (!encoded) {
    return null
  }

  return `${RES_IMPORT_PREFIX}${decodeURIComponent(encoded)}`
}
