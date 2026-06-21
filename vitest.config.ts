import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const virtualJestAxe = '\0virtual:jest-axe'

export default defineConfig({
  resolve: {
    dedupe: ['react', 'react-dom', '@mantine/core', '@mantine/hooks'],
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
    include: ['packages/**/src/**/*.test.{ts,tsx}'],
    server: {
      deps: {
        inline: ['@mantine-tests/core', '@mantine/core', '@mantine/hooks', 'react', 'react-dom'],
      },
    },
  },
})
