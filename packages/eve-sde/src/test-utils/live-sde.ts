import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const latestUrl = 'https://sde.evetech.net/tranquility/latest/'
const cacheDir = fileURLToPath(new URL('../../.cache/live', import.meta.url))

export type LiveTable = {
  version: string
  jsonl: { url: string }
  flatbuffers: { binaryUrl: string; binarySchemaUrl: string }
}

export type LiveManifest = {
  release: string
  tables: Record<string, LiveTable>
}

const fetchOk = async (url: string, init?: RequestInit): Promise<Response> => {
  const response = await fetch(url, init)
  if (!response.ok && !(response.status >= 300 && response.status < 400)) {
    throw new Error(`GET ${url} failed with ${response.status}.`)
  }
  return response
}

export const fetchLiveManifest = async (): Promise<LiveManifest> =>
  (await (await fetchOk(latestUrl)).json()) as LiveManifest

/** Downloads a table file, cached on disk by its content-addressed blob path when the URL redirects to one. */
export const fetchLiveFile = async (url: string): Promise<Uint8Array> => {
  const first = await fetchOk(url, { redirect: 'manual' })
  const location = first.headers.get('location')
  const resolvedUrl = location ? new URL(location, url).href : url
  const path = join(cacheDir, new URL(resolvedUrl).pathname.replaceAll('/', '_'))

  if (existsSync(path)) {
    await first.body?.cancel()
    return readFile(path)
  }

  const response = location ? await fetchOk(resolvedUrl) : first
  const bytes = new Uint8Array(await response.arrayBuffer())
  await mkdir(cacheDir, { recursive: true })
  await writeFile(path, bytes)
  return bytes
}

export const parseJsonLines = (bytes: Uint8Array): Record<string, unknown>[] =>
  new TextDecoder()
    .decode(bytes)
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => JSON.parse(line) as Record<string, unknown>)
