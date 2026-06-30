import path from 'node:path'
import { sde, type SdeOptions } from '@eve-online-tools/eve-sde/rollup'
import { createEveResfileIntegration, type EveResfileOptions } from '@eve-online-tools/eve-resfile/integration'
import { rollupPlugin } from '@eve-online-tools/eve-resfile/rollup'
import { postcssPlugin } from '@eve-online-tools/eve-resfile/postcss'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import replace from '@rollup/plugin-replace'
import { createGenerateScopedName } from 'hash-css-selector'
import type { InputPluginOption, RollupOptions } from 'rollup'
import banner from 'rollup-plugin-banner2'
import esbuild from 'rollup-plugin-esbuild'
import nodeExternals from 'rollup-plugin-node-externals'
import postcssImport from 'postcss-import'
import postcss from 'rollup-plugin-postcss'

export interface MantineRollupConfigOptions {
  packageDir: string
  cssPrefix: string
  /** Runs before resfile so generated artifacts can reference res:/ imports. */
  sde?: SdeOptions
  resfile?: EveResfileOptions
  plugins?: InputPluginOption[]
}

export function createMantineRollupConfig({
  packageDir,
  cssPrefix,
  sde: sdeOptions,
  resfile,
  plugins,
}: MantineRollupConfigOptions): RollupOptions {
  const outputDir = path.join(packageDir, 'dist')
  const tsconfigBuildPath = path.join(packageDir, 'tsconfig.build.json')
  const resfileIntegration = resfile
    ? createEveResfileIntegration({
        ...resfile,
        root: resfile.root ?? packageDir,
      })
    : null

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
      ...(sdeOptions ? [sde({ ...sdeOptions, root: sdeOptions.root ?? packageDir })] : []),
      // eve-resfile must run before rollup-plugin-postcss so writeBundle can rewrite extracted CSS.
      ...(resfileIntegration ? [rollupPlugin(resfileIntegration)] : []),
      postcss({
        extract: true,
        modules: { generateScopedName: createGenerateScopedName(cssPrefix) },
        minimize: true,
        plugins: [postcssImport(), ...(resfileIntegration ? [postcssPlugin(resfileIntegration)] : [])],
      }),
      banner((chunk) => {
        if (chunk.fileName !== 'index.js' && chunk.fileName !== 'index.mjs') {
          return "'use client';\n"
        }

        return undefined
      }),
      ...(plugins ?? []),
    ],
  }
}

export type { EveResfileOptions, SdeOptions }
