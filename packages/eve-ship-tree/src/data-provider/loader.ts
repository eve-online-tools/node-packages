import { parseJsonlTable } from '@eve-online-tools/eve-sde/processors'

import { filenames } from '../data/generated'
import type { Data, DataTableName, LoadDataOptions } from './types'
import { assertSafeDataBaseUrl } from './validate-data-base-url'

const DEFAULT_TIMEOUT_MS = 30_000
const DEFAULT_MAX_BYTES_PER_FILE = 50 * 1024 * 1024

const normalizeBaseUrl = (baseUrl: string): string => baseUrl.replace(/\/+$/, '')

const toTableName = (fileName: string): DataTableName => fileName.replace(/\.jsonl$/, '') as DataTableName

const isAbsoluteBaseUrl = (baseUrl: string): boolean => /^https?:\/\//i.test(baseUrl)

const fetchWithTimeout = async (url: string, fetchImpl: typeof fetch, timeoutMs: number): Promise<Response> => {
  if (typeof AbortSignal !== 'undefined' && 'timeout' in AbortSignal) {
    return fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs) })
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetchImpl(url, { signal: controller.signal })
  } finally {
    clearTimeout(timeoutId)
  }
}

const readResponseText = async (response: Response, fileName: string, maxBytesPerFile: number): Promise<string> => {
  const contentLength = response.headers.get('content-length')

  if (contentLength !== null && Number(contentLength) > maxBytesPerFile) {
    throw new Error(`Ship tree data file "${fileName}" exceeds size limit.`)
  }

  const content = await response.text()

  if (content.length > maxBytesPerFile) {
    throw new Error(`Ship tree data file "${fileName}" exceeds size limit.`)
  }

  return content
}

export const loadShipTreeData = async ({
  baseUrl,
  fetch: fetchImpl = fetch,
  validateBaseUrl,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  maxBytesPerFile = DEFAULT_MAX_BYTES_PER_FILE,
}: LoadDataOptions): Promise<Data> => {
  const normalizedBaseUrl = normalizeBaseUrl(baseUrl)

  if (validateBaseUrl && isAbsoluteBaseUrl(normalizedBaseUrl)) {
    assertSafeDataBaseUrl(normalizedBaseUrl)
  }

  const entries = await Promise.all(
    filenames.map(async (fileName) => {
      const response = await fetchWithTimeout(`${normalizedBaseUrl}/${fileName}`, fetchImpl, timeoutMs)

      if (!response.ok) {
        throw new Error(`Failed to load ship tree data file "${fileName}": ${response.status} ${response.statusText}`)
      }

      const content = await readResponseText(response, fileName, maxBytesPerFile)

      return [toTableName(fileName), parseJsonlTable(content)] as const
    }),
  )

  return Object.fromEntries(entries) as Data
}
