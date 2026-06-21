type BucketRef = {
  group: string
  rateLimitKey: string
}

const compositeKey = (group: string, rateLimitKey: string): string => `${group}\0${rateLimitKey}`

/**
 * Per-bucket mutex and in-flight tracking so parallel requests to the same
 * group/subject account for outstanding calls when computing wait time.
 */
export class BucketGate {
  private locks = new Map<string, Promise<void>>()
  private inFlight = new Map<string, number>()
  private pending = new Map<string, BucketRef>()

  getInFlight(group: string, rateLimitKey: string): number {
    return this.inFlight.get(compositeKey(group, rateLimitKey)) ?? 0
  }

  async runWithBucket<T>(id: string, group: string, rateLimitKey: string, fn: () => Promise<T>): Promise<T> {
    const key = compositeKey(group, rateLimitKey)
    const previous = this.locks.get(key) ?? Promise.resolve()
    let releaseLock!: () => void
    const current = new Promise<void>((resolve) => {
      releaseLock = resolve
    })
    this.locks.set(
      key,
      previous.then(() => current),
    )

    await previous
    try {
      const result = await fn()
      this.inFlight.set(key, (this.inFlight.get(key) ?? 0) + 1)
      this.pending.set(id, { group, rateLimitKey })
      return result
    } finally {
      releaseLock()
    }
  }

  release(id: string): void {
    const ref = this.pending.get(id)
    if (!ref) {
      return
    }

    this.pending.delete(id)
    const key = compositeKey(ref.group, ref.rateLimitKey)
    const count = this.inFlight.get(key) ?? 0
    if (count <= 1) {
      this.inFlight.delete(key)
    } else {
      this.inFlight.set(key, count - 1)
    }
  }
}
