import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMantineRollupConfig } from '../../internal/mantine-build/create-rollup-config'

const packageDir = path.dirname(fileURLToPath(import.meta.url))

export default createMantineRollupConfig({
  packageDir,
  cssPrefix: 'esipro',
})
