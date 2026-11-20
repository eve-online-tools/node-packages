import { parseJsonLines } from './jsonl'

const streamOf = (...chunks: Uint8Array[]): ReadableStream<Uint8Array> =>
  new ReadableStream({
    start: (controller) => {
      chunks.forEach((chunk) => controller.enqueue(chunk))
      controller.close()
    },
  })

const collect = async (body: ReadableStream<Uint8Array>) => {
  const values = []
  for await (const value of parseJsonLines(body)) {
    values.push(value)
  }
  return values
}

describe('parseJsonLines', () => {
  it('parses lines split across chunks, including inside multi-byte characters', async () => {
    const bytes = new TextEncoder().encode('{"a":"リ"}\n\n{"b":2}')
    const splitInsideChar = 7
    expect(await collect(streamOf(bytes.subarray(0, splitInsideChar), bytes.subarray(splitInsideChar)))).toEqual([
      { a: 'リ' },
      { b: 2 },
    ])
  })

  it('throws on a malformed line', async () => {
    await expect(collect(streamOf(new TextEncoder().encode('{"a":\n')))).rejects.toThrow(SyntaxError)
  })
})
