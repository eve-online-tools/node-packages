const PRIVATE_IPV4_RANGES = [
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\./,
  /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
] as const

const isPrivateIpv4 = (hostname: string): boolean => PRIVATE_IPV4_RANGES.some((pattern) => pattern.test(hostname))

const isPrivateIpv6 = (hostname: string): boolean => {
  const normalized = hostname.toLowerCase()

  return (
    normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:')
  )
}

export const assertSafeDataBaseUrl = (baseUrl: string, allowedOrigins: string[] = []): void => {
  let parsed: URL

  try {
    parsed = new URL(baseUrl)
  } catch {
    throw new Error('Invalid ship tree data base URL.')
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Ship tree data base URL must use http or https.')
  }

  const hostname = parsed.hostname

  if (hostname === 'localhost' || isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) {
    throw new Error('Ship tree data base URL must not target private networks.')
  }

  if (allowedOrigins.length > 0) {
    const origin = parsed.origin
    const allowed = allowedOrigins.some((candidate) => {
      try {
        return new URL(candidate).origin === origin
      } catch {
        return false
      }
    })

    if (!allowed) {
      throw new Error('Ship tree data base URL origin is not allowed.')
    }
  }
}
