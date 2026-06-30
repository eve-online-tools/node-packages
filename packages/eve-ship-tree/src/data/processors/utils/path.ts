export const normalizeResPath = (path: string): string => {
  const normalized = path.toLowerCase().replace(/\\/g, '/')
  const scheme = 'res:/'

  if (!normalized.startsWith(scheme)) {
    return normalized.replace(/\/+/g, '/')
  }

  return scheme + normalized.slice(scheme.length).replace(/\/+/g, '/')
}
