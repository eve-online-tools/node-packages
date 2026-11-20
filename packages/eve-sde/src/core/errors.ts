export class SdeError extends Error {
  override name = 'SdeError'
}

export class SdeHttpError extends SdeError {
  override name = 'SdeHttpError'

  constructor(
    readonly url: string,
    readonly status: number,
  ) {
    super(`GET ${url} failed with HTTP ${status}.`)
  }
}

/** The request did not get a response, such as when offline. `cause` holds the fetch error. */
export class SdeNetworkError extends SdeError {
  override name = 'SdeNetworkError'

  constructor(
    readonly url: string,
    cause: unknown,
  ) {
    super(
      `GET ${url} failed: ${cause instanceof Error ? cause.message : String(cause)}. Check the network connection.`,
      {
        cause,
      },
    )
  }
}

export class SdeRowNotFoundError extends SdeError {
  override name = 'SdeRowNotFoundError'

  constructor(
    readonly table: string,
    readonly key: string | number,
  ) {
    super(`No row with key ${JSON.stringify(key)} in SDE table "${table}".`)
  }
}

export class SdeUnknownTableError extends SdeError {
  override name = 'SdeUnknownTableError'

  constructor(readonly table: string) {
    super(`Unknown SDE table "${table}".`)
  }
}
