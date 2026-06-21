import { defaultAllowedHosts } from './constants'

const privateIpv4Patterns = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
]

const isIpv4Literal = (host: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(host)

const isPrivateOrReservedHost = (host: string): boolean => {
  const normalized = host.toLowerCase()

  if (normalized === 'localhost' || normalized.endsWith('.localhost')) {
    return true
  }

  if (
    normalized === '::1' ||
    normalized.startsWith('fe80:') ||
    normalized.startsWith('fc') ||
    normalized.startsWith('fd')
  ) {
    return true
  }

  if (isIpv4Literal(normalized)) {
    return privateIpv4Patterns.some((pattern) => pattern.test(normalized))
  }

  return false
}

export const assertAllowedOrigin = (
  origin: string,
  label: string,
  allowedHosts: readonly string[] = defaultAllowedHosts,
): string => {
  let url: URL

  try {
    url = new URL(origin)
  } catch {
    throw new Error(`Invalid ${label}: must be an absolute URL.`)
  }

  if (url.username || url.password) {
    throw new Error(`Invalid ${label}: credentials are not allowed in origin URLs.`)
  }

  if (url.pathname !== '/' || url.search || url.hash) {
    throw new Error(`Invalid ${label}: only scheme and host are allowed (no path, query, or hash).`)
  }

  const host = url.hostname.toLowerCase()
  const localhostHttpAllowed =
    url.protocol === 'http:' && (host === 'localhost' || host.endsWith('.localhost')) && allowedHosts.includes(host)

  if (isPrivateOrReservedHost(host) && !localhostHttpAllowed) {
    throw new Error(`Invalid ${label}: private or link-local hosts are not allowed (${host}).`)
  }

  const protocolAllowed =
    url.protocol === 'https:' || (url.protocol === 'http:' && (host === 'localhost' || host === '127.0.0.1'))

  if (!protocolAllowed) {
    throw new Error(`Invalid ${label}: only https origins are allowed (${url.protocol}//${host}).`)
  }

  if (!allowedHosts.includes(host)) {
    throw new Error(`Invalid ${label}: host "${host}" is not in the allowed host list.`)
  }

  return `${url.protocol}//${url.host}`
}
