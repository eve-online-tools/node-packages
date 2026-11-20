import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import type { Plugin, RollupOptions } from 'rollup'
import esbuild from 'rollup-plugin-esbuild'
import nodeExternals from 'rollup-plugin-node-externals'
import { createReactRollupConfig } from '../../internal/react-build/create-rollup-config'

const fontPackageDir = path.dirname(
  createRequire(import.meta.url).resolve('@fontsource/saira-semi-condensed/package.json'),
)

// postcss-import inlines the fontsource CSS but leaves its relative url(files/...) untouched.
const fontAssetsPlugin = (outDir: string): Plugin => ({
  name: 'font-assets',
  writeBundle() {
    const assetsDir = path.join(outDir, 'dist/assets')
    mkdirSync(assetsDir, { recursive: true })
    for (const fileName of readdirSync(path.join(fontPackageDir, 'files'))) {
      if (/^saira-semi-condensed-latin-(400|700)-normal\.woff2?$/.test(fileName)) {
        copyFileSync(path.join(fontPackageDir, 'files', fileName), path.join(assetsDir, fileName))
      }
    }
  },
  closeBundle() {
    for (const cssPath of ['dist/esm/index.css', 'dist/cjs/index.css'].map((p) => path.join(outDir, p))) {
      if (existsSync(cssPath)) {
        writeFileSync(cssPath, readFileSync(cssPath, 'utf-8').replaceAll('url(files/', 'url(../assets/'))
      }
    }
  },
})

const packageDir = path.dirname(fileURLToPath(import.meta.url))
// Game resources follow the client build the locked SDE release came from.
const { buildNumber } = JSON.parse(readFileSync(path.join(packageDir, 'eve-sde.lock.json'), 'utf8')) as {
  buildNumber: number
}

// `@eve-online-tools/eve-ship-tree/sde` runs in the app's build tooling, so it is plain ESM without React or CSS.
const sdeEntry: RollupOptions = {
  input: path.join(packageDir, 'src/sde/index.ts'),
  output: { file: path.join(packageDir, 'dist/sde/index.mjs'), format: 'es', sourcemap: true },
  plugins: [
    nodeExternals({ packagePath: path.join(packageDir, 'package.json') }),
    nodeResolve({ extensions: ['.ts'] }),
    esbuild({ tsconfig: path.join(packageDir, 'tsconfig.build.json') }),
  ],
}

export default [
  createReactRollupConfig({
    packageDir,
    cssPrefix: 'est',
    resfile: { root: packageDir, buildNumber: String(buildNumber) },
    sde: { root: packageDir },
    plugins: [fontAssetsPlugin(packageDir)],
  }),
  sdeEntry,
]
