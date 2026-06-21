import { defaultFetchTimeoutMs, initialFetchBackoffMs, maxFetchRetries, maxRetryAfterMs } from './constants'
import { describeFetchFailure } from './fetch-cause'
import type { FetchConcurrencyGate } from './fetch-concurrency'

export type FetchOptions = {
  timeoutMs?: number
  signal?: AbortSignal
  concurrencyGate?: FetchConcurrencyGate
}

const diagnosticHeaderNames = [
  'retry-after',
  'x-ratelimit-limit',
  'x-ratelimit-remaining',
  'x-ratelimit-reset',
  'ratelimit-limit',
  'ratelimit-remaining',
  'ratelimit-reset',
  'x-cache',
  'cf-ray',
] as const

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

/** For 429 responses: wait at least Retry-After when present, otherwise use exponential backoff. */
const parseRetryAfterMs = (header: string | null): number | undefined => {
  if (!header) {
    return undefined
  }

  const seconds = Number(header)
  if (!Number.isNaN(seconds)) {
    return Math.min(seconds * 1000, maxRetryAfterMs)
  }

  const date = Date.parse(header)
  if (!Number.isNaN(date)) {
    return Math.min(Math.max(0, date - Date.now()), maxRetryAfterMs)
  }

  return undefined
}

const waitBeforeRetry = (attempt: number, response?: Response): Promise<void> => {
  const backoffMs = initialFetchBackoffMs * 2 ** attempt
  const retryAfterMs = response?.status === 429 ? parseRetryAfterMs(response.headers.get('Retry-After')) : undefined

  return sleep(Math.max(backoffMs, retryAfterMs ?? 0))
}

const collectDiagnosticHeaders = (response: Response): Record<string, string> => {
  const headers: Record<string, string> = {}

  for (const name of diagnosticHeaderNames) {
    const value = response.headers.get(name)
    if (value) {
      headers[name] = value
    }
  }

  return headers
}

const mergeDiagnosticHeaders = (
  current: Record<string, string>,
  next: Record<string, string>,
): Record<string, string> => ({ ...current, ...next })

const formatStatusHistory = (statusHistory: number[]): string | undefined => {
  if (statusHistory.length === 0) {
    return undefined
  }

  return statusHistory.join(' → ')
}

const formatCauseHistory = (causeHistory: string[]): string | undefined => {
  if (causeHistory.length === 0) {
    return undefined
  }

  return causeHistory.join(' → ')
}

const formatDiagnosticHeaders = (headers: Record<string, string>): string | undefined => {
  const entries = Object.entries(headers)
  if (entries.length === 0) {
    return undefined
  }

  return entries.map(([name, value]) => `${name}: ${value}`).join(', ')
}

const formatAttemptCount = (attempts: number): string => `${attempts} attempt${attempts === 1 ? '' : 's'}`

export type FetchErrorDetails = {
  url: string
  attempts: number
  statusHistory: number[]
  causeHistory: string[]
  rateLimitHeaders: Record<string, string>
}

export class FetchError extends Error {
  readonly url: string
  readonly attempts: number
  readonly statusHistory: number[]
  readonly causeHistory: string[]
  readonly rateLimitHeaders: Record<string, string>

  constructor(details: FetchErrorDetails) {
    super(formatFetchErrorMessage(details))
    this.name = 'FetchError'
    this.url = details.url
    this.attempts = details.attempts
    this.statusHistory = details.statusHistory
    this.causeHistory = details.causeHistory
    this.rateLimitHeaders = details.rateLimitHeaders
  }

  formatDetail(): string {
    const parts: string[] = []
    const statusHistory = formatStatusHistory(this.statusHistory)
    const causeHistory = formatCauseHistory(this.causeHistory)

    if (statusHistory) {
      parts.push(`HTTP ${statusHistory}`)
    } else if (causeHistory) {
      parts.push(`network: ${causeHistory}`)
    }

    parts.push(`after ${formatAttemptCount(this.attempts)}`)

    const headers = formatDiagnosticHeaders(this.rateLimitHeaders)
    if (headers) {
      parts.push(headers)
    }

    return parts.join('; ')
  }
}

export const isFetchError = (error: unknown): error is FetchError => error instanceof FetchError

export const formatFetchErrorDetail = (error: unknown): string | undefined => {
  if (error instanceof FetchError) {
    return error.formatDetail()
  }

  if (error instanceof Error) {
    return error.message
  }

  if (error !== undefined) {
    return String(error)
  }

  return undefined
}

const formatFetchErrorMessage = (details: FetchErrorDetails): string => {
  const statusHistory = formatStatusHistory(details.statusHistory)
  const causeHistory = formatCauseHistory(details.causeHistory)
  const headers = formatDiagnosticHeaders(details.rateLimitHeaders)
  const parts = [`Failed to fetch ${details.url} after ${formatAttemptCount(details.attempts)}`]

  if (statusHistory) {
    parts.push(`HTTP ${statusHistory}`)
  } else if (causeHistory) {
    parts.push(`network: ${causeHistory}`)
  }

  if (headers) {
    parts.push(headers)
  }

  return parts.join('; ')
}

const createFetchError = (
  url: string,
  attempts: number,
  state: Omit<FetchErrorDetails, 'url' | 'attempts'>,
): FetchError => new FetchError({ url, attempts, ...state })

const wasRequestTimedOut = (
  error: unknown,
  timeoutController: AbortController,
  externalSignal?: AbortSignal,
): boolean => {
  if (!timeoutController.signal.aborted || externalSignal?.aborted) {
    return false
  }

  return error instanceof DOMException && error.name === 'AbortError'
}

const fetchWithRetry = async (url: string, options: FetchOptions = {}): Promise<Response> => {
  const timeoutMs = options.timeoutMs ?? defaultFetchTimeoutMs
  const maxAttempts = maxFetchRetries + 1

  await options.concurrencyGate?.acquire()

  try {
    let statusHistory: number[] = []
    let causeHistory: string[] = []
    let rateLimitHeaders: Record<string, string> = {}

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      if (options.signal?.aborted) {
        const reason = options.signal.reason
        throw reason instanceof Error ? reason : new Error('The operation was aborted.')
      }

      const timeoutController = new AbortController()
      const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs)
      const signal =
        options.signal !== undefined
          ? AbortSignal.any([options.signal, timeoutController.signal])
          : timeoutController.signal

      try {
        const response = await fetch(url, { signal })

        if (response.ok) {
          return response
        }

        statusHistory = [...statusHistory, response.status]
        rateLimitHeaders = mergeDiagnosticHeaders(rateLimitHeaders, collectDiagnosticHeaders(response))

        if (response.status === 404) {
          throw new Error(`Not found: ${url} (HTTP 404).`)
        }

        if (attempt === maxFetchRetries) {
          break
        }

        if (options.signal?.aborted) {
          throw options.signal.reason ?? new Error('The operation was aborted.')
        }

        await waitBeforeRetry(attempt, response)
      } catch (error) {
        if (error instanceof Error && error.message.startsWith('Not found:')) {
          throw error
        }

        if (options.signal?.aborted) {
          throw error
        }

        const timedOut = wasRequestTimedOut(error, timeoutController, options.signal)
        causeHistory = [
          ...causeHistory,
          describeFetchFailure(error, {
            timedOut,
            timeoutMs,
          }),
        ]

        if (attempt === maxFetchRetries) {
          throw createFetchError(url, maxAttempts, {
            statusHistory,
            causeHistory,
            rateLimitHeaders,
          })
        }

        await waitBeforeRetry(attempt)
      } finally {
        clearTimeout(timeoutId)
      }
    }

    throw createFetchError(url, maxAttempts, {
      statusHistory,
      causeHistory,
      rateLimitHeaders,
    })
  } finally {
    options.concurrencyGate?.release()
  }
}

export const fetchText = async (url: string, options?: FetchOptions): Promise<string> => {
  const response = await fetchWithRetry(url, options)
  return response.text()
}

export const fetchBuffer = async (url: string, options?: FetchOptions): Promise<Buffer> => {
  const response = await fetchWithRetry(url, options)
  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
