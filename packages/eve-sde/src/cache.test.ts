import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'

import { readCachedJson } from './cache'

describe('readCachedJson', () => {
  it('reports corrupt cache files and can invalidate them', async () => {
    const cacheDir = await mkdtemp(join(tmpdir(), 'eve-sde-cache-'))
    const path = join(cacheDir, 'types.compact.json')

    try {
      await mkdir(cacheDir, { recursive: true })
      await writeFile(path, '{"broken":')

      await expect(readCachedJson(path)).rejects.toThrow(
        `Corrupt SDE cache at ${path}. Delete the file or run with force: true.`,
      )

      await expect(readCachedJson(path, { invalidateOnCorrupt: true })).resolves.toBeNull()
      await expect(readCachedJson(path)).resolves.toBeNull()
    } finally {
      await rm(cacheDir, { recursive: true, force: true })
    }
  })
})
