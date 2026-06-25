import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { archivePath } from './cache'
import {
  clearArchiveEntryCache,
  ensureArchive,
  extractTableFromArchive,
  getListZipEntriesInvocations,
  isValidZipBuffer,
  listArchiveTableNames,
} from './archive'
import { createFixtureArchive } from './fixtures/create-fixture-archive'
import * as fetchModule from './fetch'

describe('archive', () => {
  let cacheDir: string
  const buildNumber = '123456'

  beforeEach(async () => {
    clearArchiveEntryCache()
    cacheDir = await mkdtemp(join(tmpdir(), 'eve-sde-archive-'))
    const zipBuffer = createFixtureArchive({
      types: '{"_key": 1, "name": {"en": "Frigate"}}\n',
      groups: '{"_key": 1, "_value": "Group A"}\n',
    })

    await mkdir(join(cacheDir, buildNumber), { recursive: true })
    await writeFile(archivePath(cacheDir, buildNumber), zipBuffer)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    await rm(cacheDir, { recursive: true, force: true })
  })

  it('extracts and lists tables from the cached archive', async () => {
    expect((await extractTableFromArchive(cacheDir, buildNumber, 'types')).toString('utf8')).toContain('"Frigate"')
    expect((await listArchiveTableNames(cacheDir, buildNumber)).sort()).toEqual(['groups', 'types'])
  })

  it('throws when a table is missing from the archive', async () => {
    await expect(extractTableFromArchive(cacheDir, buildNumber, 'missing')).rejects.toThrow(
      'Table file "missing.jsonl" not found in SDE archive.',
    )
  })

  it('lists every table in a multi-file archive', async () => {
    const tables = Object.fromEntries(
      Array.from({ length: 12 }, (_, index) => [`table${index}`, `{"_key": ${index}}\n`]),
    )
    await writeFile(archivePath(cacheDir, buildNumber), createFixtureArchive(tables))

    const tableNames = await listArchiveTableNames(cacheDir, buildNumber)
    expect(tableNames.sort()).toEqual(Object.keys(tables).sort())

    for (const tableName of Object.keys(tables)) {
      const content = await extractTableFromArchive(cacheDir, buildNumber, tableName)
      expect(content.toString('utf8')).toContain(`"_key":`)
    }
  })

  it('reuses the archive entry list for multiple table extracts', async () => {
    await extractTableFromArchive(cacheDir, buildNumber, 'types')
    expect(getListZipEntriesInvocations()).toBe(1)

    await extractTableFromArchive(cacheDir, buildNumber, 'groups')
    expect(getListZipEntriesInvocations()).toBe(1)
  })

  it('replaces invalid cached archives on the next ensure', async () => {
    await writeFile(archivePath(cacheDir, buildNumber), Buffer.from('not-a-zip'))
    const fixture = createFixtureArchive({
      types: '{"_key": 1, "name": {"en": "Frigate"}}\n',
    })
    const fetchSpy = vi.spyOn(fetchModule, 'fetchBuffer').mockResolvedValue(fixture)

    const buffer = await ensureArchive(cacheDir, buildNumber)

    expect(fetchSpy).toHaveBeenCalled()
    expect(isValidZipBuffer(buffer)).toBe(true)
    expect(existsSync(archivePath(cacheDir, buildNumber))).toBe(true)
  })
})
