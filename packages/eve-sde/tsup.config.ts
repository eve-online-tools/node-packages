import { readFileSync } from 'node:fs'
import { readFile, writeFile } from 'node:fs/promises'

import { defineConfig } from 'tsup'

// React Server Components need the directive at the top of the client entries; esbuild drops module-level directives
// when bundling, so it is prepended after the build. `/react-query` stays server-safe for prefetching.
const clientEntries = ['dist/react/index.js']

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'node/index': 'src/node/index.ts',
    'vite/index': 'src/vite/index.ts',
    'rollup/index': 'src/rollup/index.ts',
    'react/index': 'src/react/index.ts',
    'react-query/index': 'src/react-query/index.ts',
    cli: 'src/node/cli.ts',
    config: 'src/runtime-config.ts',
  },
  // ESM only, so every entry shares one core chunk: one global `sde` and one internals registry.
  format: ['esm'],
  splitting: true,
  dts: true,
  sourcemap: true,
  clean: true,
  target: 'es2022',
  platform: 'node',
  // Deno and some edge runtimes only resolve Node builtins with the `node:` prefix.
  removeNodeProtocol: false,
  // The config is imported by package name so build plugins can replace it.
  define: { __EVE_SDE_VERSION__: JSON.stringify(JSON.parse(readFileSync('package.json', 'utf8')).version) },
  external: ['react', '@tanstack/react-query', 'vite', 'rollup', '@eve-online-tools/eve-sde/config'],
  onSuccess: async () => {
    for (const file of clientEntries) {
      await writeFile(file, `'use client';\n${await readFile(file, 'utf8')}`)
    }
  },
})
