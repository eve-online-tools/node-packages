import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { archivePath } from './cache'
import { createFixtureArchive } from './fixtures/create-fixture-archive'
import { loadSdeTableStream } from './stream-table'
import { processSde } from './index'

describe('streaming processors', () => {
  let rootDir: string
  let cacheDir: string
  let outputDir: string

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'eve-sde-stream-'))
    cacheDir = join(rootDir, 'cache')
    outputDir = join(rootDir, 'generated')

    await mkdir(join(cacheDir, '123456'), { recursive: true })
    await writeFile(
      archivePath(cacheDir, '123456'),
      createFixtureArchive({
        types:
          '{"_key": 1, "name": {"en": "Frigate"}}\n{"_key": 2, "name": {"en": "Destroyer"}}\n{"_key": 3, "name": {"en": "Cruiser"}}\n',
      }),
    )
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('loadStream reads SDE tables line by line', async () => {
    const records = []
    for await (const record of loadSdeTableStream('types', { cacheDir, buildNumber: '123456' })) {
      records.push(record)
    }

    expect(records).toEqual([
      { key: 1, value: { name: { en: 'Frigate' } }, kind: 'object' },
      { key: 2, value: { name: { en: 'Destroyer' } }, kind: 'object' },
      { key: 3, value: { name: { en: 'Cruiser' } }, kind: 'object' },
    ])
  })

  it('streamJson and streamText write incrementally', async () => {
    await processSde({
      root: rootDir,
      outputDir,
      cacheDir,
      buildNumber: '123456',
      processors: [
        {
          id: 'stream-writer',
          version: '1',
          run: async ({ streamJson, streamText }) => {
            const json = await streamJson('items.json')
            await json.write({ id: 1 })
            await json.write({ id: 2 })
            await json.close()

            const text = await streamText('notes.txt')
            await text.write('alpha\n')
            await text.write('beta\n')
            await text.close()
          },
        },
      ],
    })

    expect(await readFile(join(outputDir, 'items.json'), 'utf8')).toBe('{"id":1}\n{"id":2}\n')
    expect(await readFile(join(outputDir, 'notes.txt'), 'utf8')).toBe('alpha\nbeta\n')
  })

  it('generatedStream reads prior processor streamed output', async () => {
    await processSde({
      root: rootDir,
      outputDir,
      cacheDir,
      buildNumber: '123456',
      processors: [
        {
          id: 'type-ids',
          version: '1',
          run: async ({ loadStream, streamJson }) => {
            const out = await streamJson('type-ids.json')
            for await (const record of loadStream('types')) {
              if (record.key === 3) {
                continue
              }
              await out.write(record.key)
            }
            await out.close()
            return [1, 2]
          },
        },
        {
          id: 'type-names',
          version: '1',
          run: async ({ generated, generatedStream, writeJson }) => {
            expect(generated('type-ids')).toEqual([1, 2])

            const streamedIds = []
            for await (const id of generatedStream('type-ids')) {
              streamedIds.push(id)
            }

            await writeJson('streamed-ids.json', streamedIds)
          },
        },
      ],
    })

    expect(JSON.parse(await readFile(join(outputDir, 'streamed-ids.json'), 'utf8'))).toEqual([1, 2])
  })
})
