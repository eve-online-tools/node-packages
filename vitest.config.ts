import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { configDefaults, defineConfig } from 'vitest/config'

const virtualJestAxe = '\0virtual:jest-axe'

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom'],
    alias: {
      // Replaced by the eve-sde build plugins in apps; tests use the package default.
      '@eve-online-tools/eve-sde/config': fileURLToPath(
        new URL('./packages/eve-sde/src/runtime-config.ts', import.meta.url),
      ),
    },
  },
  plugins: [
    {
      name: 'jest-axe-shim',
      enforce: 'pre',
      resolveId(source) {
        if (source === 'jest-axe') {
          return virtualJestAxe
        }
      },
      load(id) {
        if (id !== virtualJestAxe) {
          return
        }

        return `
          import { createRequire } from "node:module";
          const require = createRequire(import.meta.url);
          const jestAxe = require("jest-axe");
          export const { axe, configureAxe, toHaveNoViolations } = jestAxe;
          export default jestAxe;
        `
      },
    },
    {
      name: 'resfile-stub',
      enforce: 'pre',
      resolveId(source) {
        if (source.startsWith('res:')) {
          return `\0${source}`
        }
      },
      load(id) {
        if (id.startsWith('\0res:')) {
          return `export default ${JSON.stringify(id.slice(1))};`
        }
      },
    },
    react(),
    {
      name: 'css-module-stub',
      enforce: 'pre',
      resolveId(source) {
        if (source.endsWith('.css')) {
          return `\0${source}`
        }
      },
      load(id) {
        if (id.startsWith('\0') && id.endsWith('.css')) {
          return "import proxy from 'identity-obj-proxy'; export default proxy;"
        }
      },
    },
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/**/src/**/*.test.{ts,tsx}', 'internal/**/*.test.ts'],
    // Live SDE tests download the full export; run them with `pnpm test:live` in packages/eve-sde.
    exclude: [...configDefaults.exclude, '**/*.live.test.ts'],
    server: {
      deps: {
        inline: ['react', 'react-dom'],
      },
    },
  },
})
