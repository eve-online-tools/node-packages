import { assertRollupOutputDir } from './output-layout'

describe('assertRollupOutputDir', () => {
  it('accepts output directories inside distDir', () => {
    expect(() => assertRollupOutputDir('/tmp/pkg/dist', '/tmp/pkg/dist/esm')).not.toThrow()
    expect(() => assertRollupOutputDir('/tmp/pkg/dist', '/tmp/pkg/dist/cjs')).not.toThrow()
  })

  it('rejects output directories outside distDir', () => {
    expect(() => assertRollupOutputDir('/tmp/pkg/dist', '/tmp/pkg/build/esm')).toThrow(
      'Rollup output.dir must be a subdirectory of',
    )
  })
})
