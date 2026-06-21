import { dirname, resolve } from 'node:path'

export const assertRollupOutputDir = (distDir: string, outputDir: string): void => {
  const normalizedOutput = resolve(outputDir)
  const normalizedDist = resolve(distDir)
  const outputParent = dirname(normalizedOutput)

  if (outputParent !== normalizedDist) {
    throw new Error(
      `[eve-resfile] Rollup output.dir must be a subdirectory of ${normalizedDist} (for example dist/esm). ` +
        `Received ${normalizedOutput}. Set distDir to match your Rollup layout or use the default dist/esm + dist/cjs outputs.`,
    )
  }
}
