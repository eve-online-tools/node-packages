/** Manual requestAnimationFrame queue for deterministic frame tests. */
export const installFrameQueue = () => {
  let callbacks = new Map<number, FrameRequestCallback>()
  let nextId = 1
  let now = 0
  const originalRequest = window.requestAnimationFrame
  const originalCancel = window.cancelAnimationFrame

  window.requestAnimationFrame = (callback) => {
    const id = nextId++
    callbacks.set(id, callback)
    return id
  }
  window.cancelAnimationFrame = (id) => {
    callbacks.delete(id)
  }

  return {
    get pending() {
      return callbacks.size
    },
    /** Runs queued frames, advancing time by `step` ms each, until idle or `max` frames ran. */
    flush(step = 16, max = 1000) {
      let ran = 0
      while (callbacks.size > 0 && ran < max) {
        const current = callbacks
        callbacks = new Map()
        now += step
        current.forEach((callback) => callback(now))
        ran++
      }
      return ran
    },
    restore() {
      window.requestAnimationFrame = originalRequest
      window.cancelAnimationFrame = originalCancel
    },
  }
}
