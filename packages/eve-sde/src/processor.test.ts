import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { archivePath } from './cache'
import { createFixtureArchive } from './fixtures/create-fixture-archive'
import { processSde } from './index'

describe('processSde', () => {
  let rootDir: string
  let cacheDir: string
  let outputDir: string

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'eve-sde-process-'))
    cacheDir = join(rootDir, 'cache')
    outputDir = join(rootDir, 'generated')
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  const seedArchive = async () => {
    await mkdir(join(cacheDir, '123456'), { recursive: true })
    await writeFile(
      archivePath(cacheDir, '123456'),
      createFixtureArchive({
        types: '{"_key": 1, "name": {"en": "Frigate"}}\n{"_key": 2, "name": {"en": "Destroyer"}}\n',
        groups: '{"_key": 10, "name": {"en": "Group"}}\n',
      }),
    )
  }

  it('dumps configured tables to outputDir', async () => {
    await seedArchive()

    const result = await processSde({
      root: rootDir,
      outputDir,
      cacheDir,
      buildNumber: '123456',
      tables: ['types'],
    })

    expect(result.skipped).toBe(false)
    expect(result.buildNumber).toBe('123456')
    expect(existsSync(join(outputDir, 'types.json'))).toBe(true)

    const types = JSON.parse(await readFile(join(outputDir, 'types.json'), 'utf8'))
    expect(types['1'].name.en).toBe('Frigate')
    expect(existsSync(join(outputDir, '.sde-lock.json'))).toBe(true)
  })

  it('runs custom processors', async () => {
    await seedArchive()

    await processSde({
      root: rootDir,
      outputDir,
      cacheDir,
      buildNumber: '123456',
      processors: [
        {
          id: 'type-names',
          version: '1',
          run: async ({ load, writeJson }) => {
            const types = (await load('types')) as Record<string, { name: { en: string } }>
            const names = Object.fromEntries(Object.entries(types).map(([id, row]) => [id, row.name.en]))
            await writeJson('type-names.json', names)
          },
        },
      ],
    })

    const names = JSON.parse(await readFile(join(outputDir, 'type-names.json'), 'utf8'))
    expect(names['1']).toBe('Frigate')
  })

  it('lets later processors read data returned by earlier processors', async () => {
    await seedArchive()

    await processSde({
      root: rootDir,
      outputDir,
      cacheDir,
      buildNumber: '123456',
      processors: [
        {
          id: 'type-ids',
          version: '1',
          run: async ({ load }) => {
            const types = (await load('types')) as Record<string, { name: { en: string } }>
            return Object.keys(types)
          },
        },
        {
          id: 'type-names',
          version: '1',
          run: async ({ load, generated, writeJson }) => {
            const typeIds = generated('type-ids') as string[]
            const types = (await load('types')) as Record<string, { name: { en: string } }>
            const names = Object.fromEntries(
              typeIds.map((id) => [id, types[id]?.name.en]).filter(([, name]) => name !== undefined),
            )
            await writeJson('type-names.json', names)
          },
        },
      ],
    })

    const names = JSON.parse(await readFile(join(outputDir, 'type-names.json'), 'utf8'))
    expect(names).toEqual({
      1: 'Frigate',
      2: 'Destroyer',
    })
  })

  it('skips processing when lock file matches', async () => {
    await seedArchive()

    const options = {
      root: rootDir,
      outputDir,
      cacheDir,
      buildNumber: '123456',
      tables: ['types'],
    }

    await processSde(options)
    const result = await processSde(options)
    expect(result.skipped).toBe(true)
  })

  it('rejects table names with extensions', async () => {
    await expect(
      processSde({
        root: rootDir,
        outputDir,
        cacheDir,
        buildNumber: '123456',
        tables: ['types.jsonl'],
      }),
    ).rejects.toThrow('Invalid table name "types.jsonl"')
  })

  it('rejects processor output paths outside outputDir', async () => {
    await seedArchive()

    await expect(
      processSde({
        root: rootDir,
        outputDir,
        cacheDir,
        buildNumber: '123456',
        processors: [
          {
            id: 'escape',
            version: '1',
            run: async ({ writeJson }) => {
              await writeJson('../outside.json', { leaked: true })
            },
          },
        ],
      }),
    ).rejects.toThrow('Output path escapes outputDir: ../outside.json')
  })
})
