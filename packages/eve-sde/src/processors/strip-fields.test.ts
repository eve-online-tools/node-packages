import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { archivePath } from '../cache'
import { createFixtureArchive } from '../fixtures/create-fixture-archive'
import { processSde } from '../index'
import { stripFields } from './strip-fields'

describe('stripFields processor', () => {
  let rootDir: string
  let cacheDir: string
  let outputDir: string

  beforeEach(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'eve-sde-strip-fields-'))
    cacheDir = join(rootDir, 'cache')
    outputDir = join(rootDir, 'generated')

    await mkdir(join(cacheDir, '123456'), { recursive: true })
    await writeFile(
      archivePath(cacheDir, '123456'),
      createFixtureArchive({
        types: `${[
          '{"_key": 2, "name": {"de": "Corporation", "en": "Corporation", "fr": "Corporation"}, "groupID": 2, "icon": "res:/icon.png"}',
          '{"_key": 999, "name": {"en": "Alex\'s Ship", "ko": "KO", "zh": "ZH"}, "groupID": 999}',
        ].join('\n')}\n`,
        masteries:
          '{"_key": 582, "_value": [{"_key": 0, "_value": [96, 139]}, {"_key": 1, "description": {"de": "A", "en": "B"}}]}\n',
      }),
    )
  })

  afterEach(async () => {
    await rm(rootDir, { recursive: true, force: true })
  })

  it('writes stripped SDE JSONL for object and _value rows', async () => {
    await processSde({
      root: rootDir,
      outputDir,
      cacheDir,
      buildNumber: '123456',
      processors: [
        stripFields('types', { keepLanguages: ['en'], fallbackLanguage: 'en' }),
        stripFields('masteries', { keepLanguages: ['en'], fallbackLanguage: 'en' }),
      ],
    })

    const typeLines = (await readFile(join(outputDir, 'types.jsonl'), 'utf8')).trim().split('\n')
    expect(JSON.parse(typeLines[0]!)).toEqual({
      _key: 2,
      name: { en: 'Corporation' },
      groupID: 2,
      icon: 'res:/icon.png',
    })

    const masteryLine = (await readFile(join(outputDir, 'masteries.jsonl'), 'utf8')).trim()
    expect(JSON.parse(masteryLine)).toEqual({
      _key: 582,
      _value: [
        { _key: 0, _value: [96, 139] },
        { _key: 1, description: { en: 'B' } },
      ],
    })
  })

  it('deletes fields and filters rows by key', async () => {
    await processSde({
      root: rootDir,
      outputDir,
      cacheDir,
      buildNumber: '123456',
      processors: [
        stripFields('types', {
          fields: ['icon'],
          keys: [999],
          keepLanguages: ['en'],
          fallbackLanguage: 'en',
        }),
      ],
    })

    const lines = (await readFile(join(outputDir, 'types.jsonl'), 'utf8')).trim().split('\n')
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0]!)).toEqual({
      _key: 2,
      name: { en: 'Corporation' },
      groupID: 2,
    })
  })

  it('validates mutually exclusive options', () => {
    expect(() => stripFields('types', { languages: ['de'], keepLanguages: ['en'], fallbackLanguage: 'en' })).toThrow(
      'set either "languages" or "keepLanguages", not both.',
    )
    expect(() => stripFields('types', { keys: [1], keepKeys: [2] })).toThrow(
      'set either "keys" or "keepKeys", not both.',
    )
    expect(() => stripFields('types', { keepLanguages: ['en'] })).toThrow(
      '"fallbackLanguage" is required when "keepLanguages" is set.',
    )
  })
})
