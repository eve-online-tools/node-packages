/**
 * React's thenable protocol: `use()` reads `status` / `value` synchronously, so a settled promise renders without
 * suspending.
 */
type Tracked<T> = Promise<T> & { status?: 'pending' | 'fulfilled' | 'rejected'; value?: T; reason?: unknown }

export const track = <T>(promise: Promise<T>): Promise<T> => {
  const tracked = promise as Tracked<T>
  if (tracked.status === undefined) {
    tracked.status = 'pending'
    tracked.then(
      (value) => {
        tracked.status = 'fulfilled'
        tracked.value = value
      },
      (reason: unknown) => {
        tracked.status = 'rejected'
        tracked.reason = reason
      },
    )
  }
  return promise
}

export const fulfilled = <T>(value: T): Promise<T> =>
  Object.assign(Promise.resolve(value), { status: 'fulfilled' as const, value })

/** The value of a fulfilled tracked promise. */
export const settledValue = <T>(promise: Promise<T>): { value: T } | undefined => {
  const tracked = promise as Tracked<T>
  return tracked.status === 'fulfilled' ? { value: tracked.value as T } : undefined
}
