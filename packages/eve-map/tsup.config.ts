import type { Plugin } from 'esbuild'
import { defineConfig } from 'tsup'

// The React entry must share the root entry's module instance (e.g. `instanceof WebGLUnavailableError`).
const rootEntryExternal: Plugin = {
  name: 'root-entry-external',
  setup(build) {
    build.onResolve({ filter: /^\.\.\/index$/ }, () => ({ path: '@eve-online-tools/eve-map', external: true }))
  },
}

const shared = {
  format: ['esm', 'cjs'] as const,
  dts: true,
  sourcemap: true,
  target: 'es2022',
  external: ['three', 'react', '@eve-online-tools/eve-sde'],
}

export default defineConfig([
  { ...shared, entry: { index: 'src/index.ts' } },
  {
    ...shared,
    entry: { 'react/index': 'src/react/index.ts' },
    banner: { js: "'use client';" },
    esbuildPlugins: [rootEntryExternal],
  },
  { ...shared, entry: { 'sde/index': 'src/sde/index.ts' }, platform: 'node' },
])
