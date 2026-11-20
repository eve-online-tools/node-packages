/** Yields one parsed value per non-empty line of a JSON Lines byte stream. */
export async function* parseJsonLines(body: ReadableStream<Uint8Array>): AsyncGenerator<unknown> {
  const decoder = new TextDecoder('utf-8', { fatal: true })
  const reader = body.getReader()
  let pending = ''
  let finished = false

  try {
    for (;;) {
      const { done, value } = await reader.read()
      pending += done ? decoder.decode() : decoder.decode(value, { stream: true })
      const lines = pending.split('\n')
      pending = done ? '' : lines.pop()!
      for (const line of lines) {
        if (line.trim() !== '') {
          yield JSON.parse(line)
        }
      }
      if (done) {
        finished = true
        return
      }
    }
  } finally {
    // A consumer that stops early would otherwise keep the download running.
    if (!finished) {
      await reader.cancel().catch(() => undefined)
    }
    reader.releaseLock()
  }
}
