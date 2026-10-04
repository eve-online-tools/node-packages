import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

import { build } from 'esbuild'

const BUDGET_BYTES = 30 * 1024
const packageDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)))

// Bundles both browser entries from source, as an app would, with peers external.
const main = async () => {
  const result = await build({
    stdin: {
      contents: "export * from './src/index'\nexport * from './src/react/index'",
      resolveDir: packageDir,
      loader: 'ts',
    },
    bundle: true,
    minify: true,
    format: 'esm',
    target: 'es2022',
    write: false,
    jsx: 'automatic',
    external: ['three', 'react', 'react/jsx-runtime'],
    logLevel: 'silent',
  })

  const code = result.outputFiles[0].contents
  const gzipped = gzipSync(code).length
  const summary = `eve-map: ${(code.length / 1024).toFixed(1)} KB min, ${(gzipped / 1024).toFixed(1)} KB min+gz (budget ${BUDGET_BYTES / 1024} KB)`

  if (gzipped > BUDGET_BYTES) {
    console.error(`${summary}: over budget`)
    process.exit(1)
  }
  console.log(summary)
}

void main()
