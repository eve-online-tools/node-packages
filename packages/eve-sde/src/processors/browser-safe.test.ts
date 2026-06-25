import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '../..')

const listProcessorDistFiles = (): string[] => {
  const entryContent = readFileSync(join(packageRoot, 'dist/processors/index.js'), 'utf8')
  const chunkImports = [...entryContent.matchAll(/from "\.\.\/(chunk-[^"]+\.js)"/g)].map((match) =>
    join('dist', match[1]!),
  )

  return [join('dist/processors/index.js'), join('dist/processors/index.cjs'), ...chunkImports]
}

describe('processors dist bundle', () => {
  it('does not reference Buffer so browser consumers can import parseJsonlTable', () => {
    const files = listProcessorDistFiles()

    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const content = readFileSync(join(packageRoot, file), 'utf8')
      expect(content, file).not.toMatch(/\bBuffer\b/)
    }
  })

  it('parseJsonlTable works when Buffer is unavailable', async () => {
    const originalBuffer = globalThis.Buffer
    // @ts-expect-error simulate browser globals
    delete globalThis.Buffer

    vi.resetModules()
    const { parseJsonlTable } = await import('./index')

    expect(parseJsonlTable('{"_key": 1, "name": "Rifter"}\n')).toEqual({
      1: { name: 'Rifter' },
    })

    globalThis.Buffer = originalBuffer
  })
})
