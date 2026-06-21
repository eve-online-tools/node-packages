export type FetchConcurrencyGate = {
  acquire: () => Promise<void>
  release: () => void
}

export const createFetchConcurrencyGate = (limit: number): FetchConcurrencyGate => {
  const normalizedLimit = Math.max(1, Math.floor(limit))
  let active = 0
  const queue: Array<() => void> = []

  const acquire = (): Promise<void> => {
    if (active < normalizedLimit) {
      active++
      return Promise.resolve()
    }

    return new Promise((resolve) => {
      queue.push(() => {
        active++
        resolve()
      })
    })
  }

  const release = (): void => {
    active--
    const next = queue.shift()
    if (next) {
      next()
    }
  }

  return { acquire, release }
}
