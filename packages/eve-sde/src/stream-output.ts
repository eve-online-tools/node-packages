import { createWriteStream } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { finished } from 'node:stream/promises'

import type { SdeJsonStreamWriter, SdeTextStreamWriter } from './types'

const writeToStream = (stream: NodeJS.WritableStream, chunk: string): Promise<void> =>
  new Promise((resolve, reject) => {
    stream.write(chunk, (error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

export const createJsonStreamWriter = async (path: string): Promise<SdeJsonStreamWriter> => {
  await mkdir(join(path, '..'), { recursive: true })
  const stream = createWriteStream(path, { encoding: 'utf8' })

  return {
    write: async (value) => {
      await writeToStream(stream, `${JSON.stringify(value)}\n`)
    },
    close: async () => {
      stream.end()
      await finished(stream)
    },
  }
}

export const createTextStreamWriter = async (path: string): Promise<SdeTextStreamWriter> => {
  await mkdir(join(path, '..'), { recursive: true })
  const stream = createWriteStream(path, { encoding: 'utf8' })

  return {
    write: async (chunk) => {
      await writeToStream(stream, chunk)
    },
    close: async () => {
      stream.end()
      await finished(stream)
    },
  }
}
