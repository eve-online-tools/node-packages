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
