import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { buildLockFile, lockMatchesConfig, readLockFile, shouldSkipProcessing, writeLockFile } from './fingerprint'
import { resolveSdeOptions } from './plugin-core'

describe('fingerprint', () => {
  let outputDir: string

  beforeEach(async () => {
    outputDir = await mkdtemp(join(tmpdir(), 'eve-sde-lock-'))
  })

  afterEach(async () => {
    await rm(outputDir, { recursive: true, force: true })
  })

  it('matches an equivalent lock file', async () => {
    const options = resolveSdeOptions(
      {
        outputDir,
        buildNumber: '123',
        tables: ['types', 'groups'],
        processors: [{ id: 'names', version: '1', run: async () => {} }],
      },
      outputDir,
    )

    await writeLockFile(outputDir, buildLockFile('123', options))
    const lock = await readLockFile(outputDir)

    expect(lock).not.toBeNull()
    expect(lockMatchesConfig(lock!, '123', options)).toBe(true)
    expect(await shouldSkipProcessing(outputDir, '123', options)).toBe(true)
  })

  it('does not match when build number changes', async () => {
    const options = resolveSdeOptions({ outputDir, tables: ['types'] }, outputDir)

    await writeLockFile(outputDir, buildLockFile('123', options))
    expect(await shouldSkipProcessing(outputDir, '456', options)).toBe(false)
  })

  it('does not skip when force is true', async () => {
    const options = resolveSdeOptions({ outputDir, buildNumber: '123', tables: ['types'], force: true }, outputDir)

    await writeLockFile(outputDir, buildLockFile('123', options))
    expect(await shouldSkipProcessing(outputDir, '123', options)).toBe(false)
  })

  it('invalidates when jsonSpace, output paths, or processor version change', async () => {
    const baseOptions = resolveSdeOptions({ outputDir, buildNumber: '123', tables: ['types'] }, outputDir)
    await writeLockFile(outputDir, buildLockFile('123', baseOptions))

    const jsonSpaceOptions = resolveSdeOptions(
      { outputDir, buildNumber: '123', tables: ['types'], jsonSpace: 2 },
      outputDir,
    )
    expect(await shouldSkipProcessing(outputDir, '123', jsonSpaceOptions)).toBe(false)

    await writeLockFile(outputDir, buildLockFile('123', baseOptions))

    const renamedOptions = resolveSdeOptions(
      { outputDir, buildNumber: '123', tables: { types: 'custom-types.json' } },
      outputDir,
    )
    expect(await shouldSkipProcessing(outputDir, '123', renamedOptions)).toBe(false)

    await writeLockFile(outputDir, buildLockFile('123', baseOptions))

    const bumpedOptions = resolveSdeOptions(
      {
        outputDir,
        buildNumber: '123',
        processors: [{ id: 'names', version: '2', run: async () => {} }],
      },
      outputDir,
    )
    expect(await shouldSkipProcessing(outputDir, '123', bumpedOptions)).toBe(false)
  })
})
