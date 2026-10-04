import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { sde } from '@eve-online-tools/eve-sde/vite'
import { mapDataProcessor } from '@eve-online-tools/eve-map/sde'
import { createWorkspaceAliases } from '../../internal/vite-config/workspace-aliases'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../')

export default defineConfig({
  plugins: [
    react(),
    sde({
      outputDir: 'src/generated/sde',
      buildNumber: 3569502,
      processors: [mapDataProcessor()],
    }),
  ],
  resolve: {
    alias: createWorkspaceAliases(monorepoRoot),
  },
})
