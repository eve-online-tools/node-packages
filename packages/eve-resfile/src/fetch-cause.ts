export type DescribeFetchFailureContext = {
  timedOut: boolean
  timeoutMs: number
}

const genericFetchMessages = new Set(['fetch failed', 'The operation was aborted.', 'terminated'])

const readErrorCode = (error: Error): string | undefined => {
  const code = (error as NodeJS.ErrnoException).code
  return typeof code === 'string' && code.length > 0 ? code : undefined
}

export const describeFetchFailure = (error: unknown, context: DescribeFetchFailureContext): string => {
  if (context.timedOut) {
    return `request timed out after ${context.timeoutMs}ms`
  }

  const parts: string[] = []
  const seen = new Set<unknown>()
  let current: unknown = error

  while (current !== undefined && current !== null && !seen.has(current)) {
    seen.add(current)

    if (current instanceof Error) {
      const code = readErrorCode(current)
      if (code && !parts.includes(code)) {
        parts.push(code)
      }

      const message = current.message.trim()
      if (message && !genericFetchMessages.has(message) && !parts.includes(message)) {
        parts.push(message)
      }

      current = current.cause
      continue
    }

    const value = String(current).trim()
    if (value && !parts.includes(value)) {
      parts.push(value)
    }
    break
  }

  if (parts.length === 0) {
    return 'network error (no HTTP response)'
  }

  return parts.join(' ← ')
}
