import { FetchError, formatFetchErrorDetail } from './fetch'

export type FetchFailureKind = 'http' | 'network' | 'timeout' | 'not-found'

export const classifyFetchFailure = (error: unknown): FetchFailureKind => {
  if (error instanceof Error && error.message.startsWith('Not found:')) {
    return 'not-found'
  }

  if (error instanceof FetchError) {
    if (error.statusHistory.length > 0) {
      return 'http'
    }

    if (error.causeHistory.some((cause) => cause.includes('timed out'))) {
      return 'timeout'
    }
  }

  return 'network'
}

export type MissingResPathWarnContext = {
  error?: unknown
  cdnUrl?: string
}

type RecordedFetchFailure = {
  resPath: string
  buildNumber: string
  cdnUrl?: string
  detail: string
  kind: FetchFailureKind
}

const warnedMissingResPaths = new Set<string>()
const fetchFailures: RecordedFetchFailure[] = []

export const resetFetchFailureLog = (): void => {
  warnedMissingResPaths.clear()
  fetchFailures.length = 0
}

export const warnMissingResPath = (
  resPath: string,
  buildNumber: string,
  reason: string,
  context?: MissingResPathWarnContext,
): void => {
  if (warnedMissingResPaths.has(resPath)) {
    return
  }

  warnedMissingResPaths.add(resPath)

  const detail = formatFetchErrorDetail(context?.error)
  const cdnUrl =
    context?.cdnUrl ??
    (context?.error && 'url' in (context.error as object) ? String((context.error as { url: string }).url) : undefined)
  const cdnSuffix = cdnUrl ? ` → ${cdnUrl}` : ''
  const detailSuffix = detail ? ` — ${detail}` : ''

  process.stderr.write(`[eve-resfile] ${reason}: ${resPath}${cdnSuffix} (build ${buildNumber})${detailSuffix}\n`)

  if (context?.error && reason.includes('CDN')) {
    fetchFailures.push({
      resPath,
      buildNumber,
      cdnUrl,
      detail: detail ?? 'unknown error',
      kind: classifyFetchFailure(context.error),
    })
  }
}

const failureKindLabels: Record<FetchFailureKind, string> = {
  http: 'HTTP error responses',
  network: 'network/connection errors (no HTTP response)',
  timeout: 'request timeouts',
  'not-found': 'not found (HTTP 404)',
}

export const summarizeFetchFailures = (fetchConcurrency: number): void => {
  if (fetchFailures.length === 0) {
    return
  }

  const byKind = new Map<FetchFailureKind, number>()
  for (const failure of fetchFailures) {
    byKind.set(failure.kind, (byKind.get(failure.kind) ?? 0) + 1)
  }

  const buildNumber = fetchFailures[0]?.buildNumber ?? 'unknown'
  process.stderr.write(
    `[eve-resfile] CDN fetch summary (build ${buildNumber}): ${fetchFailures.length} asset(s) failed\n`,
  )

  for (const kind of ['network', 'http', 'timeout', 'not-found'] as const) {
    const count = byKind.get(kind)
    if (count) {
      process.stderr.write(`  - ${count} ${failureKindLabels[kind]}\n`)
    }
  }

  const networkCount = byKind.get('network') ?? 0
  if (networkCount > 0) {
    process.stderr.write(
      `  Hint: connection errors without HTTP status usually mean the CDN dropped requests before responding — often from too many parallel fetches (fetchConcurrency=${fetchConcurrency}). Try lowering fetchConcurrency in eve-resfile options.\n`,
    )
  }
}
