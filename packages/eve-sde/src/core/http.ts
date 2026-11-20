import { SdeHttpError } from './errors'

export type FetchFn = typeof fetch

const retryableStatus = new Set([429, 502, 503, 504])
const retryDelaysMs = [250, 1_000, 4_000]

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))

const isNetworkError = (error: unknown): boolean => error instanceof TypeError

/**
 * GETs a URL, retrying network failures and transient statuses. Returns `undefined` for 404 so callers can tell
 * "missing" from failure; other non-2xx statuses throw `SdeHttpError`.
 */
export const request = async (fetchFn: FetchFn, url: string): Promise<Response | undefined> => {
  for (let attempt = 0; ; attempt++) {
    const canRetry = attempt < retryDelaysMs.length
    let response: Response
    try {
      response = await fetchFn(url)
    } catch (error) {
      if (!canRetry || !isNetworkError(error)) {
        throw error
      }
      await sleep(retryDelaysMs[attempt]!)
      continue
    }

    if (response.ok) {
      return response
    }
    await response.body?.cancel()
    if (response.status === 404) {
      return undefined
    }
    if (!canRetry || !retryableStatus.has(response.status)) {
      throw new SdeHttpError(url, response.status)
    }
    await sleep(retryDelaysMs[attempt]!)
  }
}

/** Like `request`, but a 404 is an error. */
export const requestOk = async (fetchFn: FetchFn, url: string): Promise<Response> => {
  const response = await request(fetchFn, url)
  if (!response) {
    throw new SdeHttpError(url, 404)
  }
  return response
}
