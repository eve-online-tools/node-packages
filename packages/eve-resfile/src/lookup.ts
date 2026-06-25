import { devProxyPrefix, resImportPrefix } from './constants'

export const resPathLookupKey = (resPath: string): string => resPath.toLowerCase()

export const normalizeResPath = (source: string): string => {
  const withoutQuery = source.split(/[?#]/)[0] ?? source

  let normalized: string

  if (withoutQuery.startsWith(resImportPrefix)) {
    normalized = withoutQuery
  } else if (withoutQuery.startsWith('res:')) {
    const path = withoutQuery.slice('res:'.length)
    normalized = path.startsWith('/') ? `res:${path}` : `res:/${path}`
  } else {
    throw new Error(`Invalid res import "${source}". Expected a path starting with "res:/".`)
  }

  return resPathLookupKey(normalized)
}

export const lookupCdnPath = (index: Map<string, string>, resPath: string): string | undefined => {
  return index.get(resPathLookupKey(resPath))
}

export const devProxyUrl = (resPath: string): string => {
  const encoded = encodeURIComponent(resPath.slice(resImportPrefix.length))
  return `${devProxyPrefix}${encoded}`
}

export const resPathFromDevProxyUrl = (pathname: string): string | null => {
  if (!pathname.startsWith(devProxyPrefix)) {
    return null
  }

  const encoded = pathname.slice(devProxyPrefix.length)
  if (!encoded) {
    return null
  }

  return `${resImportPrefix}${decodeURIComponent(encoded)}`
}
