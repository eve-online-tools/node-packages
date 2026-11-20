import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { build, createServer, type InlineConfig } from 'vite'

import { defineDataset } from '../core/dataset'
import { sde } from './plugin'

const packageDir = fileURLToPath(new URL('../..', import.meta.url))
const cacheDir = join(packageDir, '.cache/live-plugin')

const frigateNames = defineDataset({
  id: 'test:frigate-names',
  version: '1',
  tables: ['types'],
  build: async ({ table, emit }) => {
    const names: string[] = []
    for await (const type of table('types').list({ fields: ['groupID', 'name', 'published'] })) {
      if (type.groupID === 25 && type.published) {
        names.push(type.name.en)
      }
    }
    return { count: names.length, file: emit('frigates.json', JSON.stringify(names.sort())) }
  },
})

const main = `import { sde } from '@eve-online-tools/eve-sde'
import frigates from 'eve-sde:dataset/test:frigate-names'

export const run = async () => ({
  category: await sde.table('categories').get(6),
  race: await sde.table('races').get(1),
  frigates,
  release: (await sde.manifest()).release,
})
`

const appConfig = (root: string): InlineConfig => ({
  root,
  configFile: false,
  logLevel: 'warn',
  plugins: [
    sde({
      cacheDir,
      tables: { categories: { client: 'embed', server: 'embed' }, races: { server: 'files' } },
      datasets: [frigateNames],
      dts: 'src/eve-sde.d.ts',
    }),
  ],
  resolve: {
    alias: [
      { find: /^@eve-online-tools\/eve-sde$/, replacement: join(packageDir, 'src/index.ts') },
      { find: /^@eve-online-tools\/eve-sde\/node$/, replacement: join(packageDir, 'src/node/index.ts') },
    ],
  },
})

const buildApp = async (root: string, ssr: boolean) => {
  await build({
    ...appConfig(root),
    build: ssr
      ? { ssr: 'src/main.ts', outDir: 'dist/server', emptyOutDir: true }
      : {
          outDir: 'dist/client',
          emptyOutDir: true,
          rollupOptions: {
            input: 'src/main.ts',
            preserveEntrySignatures: 'exports-only',
            output: { entryFileNames: '[name].js' },
          },
        },
  })
}

describe('vite plugin build', () => {
  let root: string
  beforeAll(async () => {
    await mkdir(join(packageDir, '.cache'), { recursive: true })
    root = await mkdtemp(join(packageDir, '.cache/live-app-'))
    await mkdir(join(root, 'src'))
    await writeFile(join(root, 'src/main.ts'), main)
  })

  it('serves embedded, file-backed and remote tables from a server build', async () => {
    await buildApp(root, true)
    const { run } = await import(pathToFileURL(join(root, 'dist/server/main.js')).href)
    const result = await run()
    const lock = JSON.parse(await readFile(join(root, 'eve-sde.lock.json'), 'utf8'))

    expect(result.category.name.en).toBe('Ship')
    expect(result.race.name.en).toBe('Caldari')
    expect(result.frigates.count).toBeGreaterThan(10)
    expect(result.release).toBe(lock.release)
    expect((await readdir(join(root, 'dist/server/eve-sde'))).some((file) => file.endsWith('.fb'))).toBe(true)
  })

  it('bundles embedded tables as chunks and leaves file sources out of a client build', async () => {
    await buildApp(root, false)
    const output = await readdir(join(root, 'dist/client'), { recursive: true })
    const code = (
      await Promise.all(
        output.filter((file) => file.endsWith('.js')).map((file) => readFile(join(root, 'dist/client', file), 'utf8')),
      )
    ).join('\n')

    expect(code).not.toContain('node:fs')
    expect(output.some((file) => file.includes('frigates'))).toBe(true)

    const { run } = await import(pathToFileURL(join(root, 'dist/client/main.js')).href)
    const result = await run()
    expect(result.category.name.en).toBe('Ship')
    expect(result.race.name.en).toBe('Caldari')
  })

  it('serves the same data from the dev server', async () => {
    const server = await createServer({ ...appConfig(root), server: { middlewareMode: true, ws: false } })
    try {
      const { run } = await server.ssrLoadModule('/src/main.ts')
      const result = await run()
      expect(result.category.name.en).toBe('Ship')
      expect(result.race.name.en).toBe('Caldari')
      expect(result.frigates.file).toMatch(/^\/@eve-sde\/test%3Afrigate-names\/frigates\.json$/)
    } finally {
      await server.close()
    }
  })

  it('writes row and dataset types', async () => {
    expect(await readFile(join(root, 'src/eve-sde.d.ts'), 'utf8')).toContain('interface SdeTypeRegistry')
    expect(await readFile(join(root, 'src/eve-sde.datasets.d.ts'), 'utf8')).toContain(
      'declare module "eve-sde:dataset/test:frigate-names"',
    )
  })
})
