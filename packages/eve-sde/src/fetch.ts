import { defaultFetchRetries, defaultFetchTimeoutMs, fetchRetryableStatus, fetchRetryDelaysMs } from './constants'

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const fetchWithTimeout = async (url: string, timeoutMs: number): Promise<Response> => {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return fetch(url, { signal: AbortSignal.timeout(timeoutMs) })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

const isRetryableResponse = (response: Response): boolean => fetchRetryableStatus.has(response.status)

const isRetryableError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false
  }

  return error.name === 'AbortError' || error.name === 'TypeError'
}

export type FetchOptions = {
  timeoutMs?: number
  retries?: number
}

const fetchResponse = async (url: string, options: FetchOptions = {}): Promise<Response> => {
  const timeoutMs = options.timeoutMs ?? defaultFetchTimeoutMs
  const retries = options.retries ?? defaultFetchRetries
  let lastError: unknown

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs)
      if (response.ok || !isRetryableResponse(response) || attempt === retries - 1) {
        return response
      }
    } catch (error) {
      lastError = error
      if (!isRetryableError(error) || attempt === retries - 1) {
        throw error
      }
    }

    await sleep(fetchRetryDelaysMs[Math.min(attempt, fetchRetryDelaysMs.length - 1)]!)
  }

  throw lastError instanceof Error ? lastError : new Error(`Failed to fetch ${url}.`)
}

export const fetchText = async (url: string, options?: FetchOptions): Promise<string> => {
  const response = await fetchResponse(url, options)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status}).`)
  }

  return response.text()
}

export const fetchBuffer = async (url: string, options?: FetchOptions): Promise<Buffer> => {
  const response = await fetchResponse(url, options)

  if (!response.ok) {
    throw new Error(`Failed to fetch ${url} (${response.status}).`)
  }

  const arrayBuffer = await response.arrayBuffer()
  return Buffer.from(arrayBuffer)
}
