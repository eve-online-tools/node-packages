import path from 'node:path'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import { createGenerateScopedName } from 'hash-css-selector'
import type { RollupOptions } from 'rollup'
import banner from 'rollup-plugin-banner2'
import esbuild from 'rollup-plugin-esbuild'
import nodeExternals from 'rollup-plugin-node-externals'
import postcss from 'rollup-plugin-postcss'

export interface MantineRollupConfigOptions {
  packageDir: string
  cssPrefix: string
}

export function createMantineRollupConfig({ packageDir, cssPrefix }: MantineRollupConfigOptions): RollupOptions {
  const outputDir = path.join(packageDir, 'dist')
  const tsconfigBuildPath = path.join(packageDir, 'tsconfig.build.json')

  return {
    input: path.join(packageDir, 'src/index.ts'),
    output: [
      {
        format: 'es',
        entryFileNames: '[name].mjs',
        dir: path.join(outputDir, 'esm'),
        preserveModules: true,
        sourcemap: true,
      },
      {
        format: 'cjs',
        entryFileNames: '[name].cjs',
        dir: path.join(outputDir, 'cjs'),
        preserveModules: true,
        sourcemap: true,
      },
    ],
    plugins: [
      nodeExternals({
        packagePath: path.join(packageDir, 'package.json'),
      }),
      nodeResolve({ extensions: ['.ts', '.tsx', '.js', '.jsx'] }),
      esbuild({
        sourceMap: false,
        tsconfig: tsconfigBuildPath,
      }),
      replace({ preventAssignment: true }),
      postcss({
        extract: true,
        modules: { generateScopedName: createGenerateScopedName(cssPrefix) },
        minimize: true,
      }),
      banner((chunk) => {
        if (chunk.fileName !== 'index.js' && chunk.fileName !== 'index.mjs') {
          return "'use client';\n"
        }

        return undefined
      }),
    ],
  }
}
