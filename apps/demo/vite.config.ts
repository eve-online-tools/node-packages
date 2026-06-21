import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { createWorkspaceAliases } from '../../internal/vite-config/workspace-aliases'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const monorepoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../')

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: createWorkspaceAliases(monorepoRoot),
  },
})
