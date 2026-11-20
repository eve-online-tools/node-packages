import { defineConfig } from 'vitest/config'

// Downloads the full live SDE; run locally only (`pnpm test:live`).
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['src/**/*.live.test.ts'],
    testTimeout: 600_000,
    hookTimeout: 600_000,
  },
})
