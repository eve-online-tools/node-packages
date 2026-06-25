import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..')

const readBundle = (entry: string): string => readFileSync(join(packageRoot, 'dist', entry), 'utf8')

describe('entry bundle isolation', () => {
  it('rollup entry does not ship the vite plugin', () => {
    const bundle = readBundle('rollup/index.cjs')

    expect(bundle).not.toContain('eve-resfile-vite')
    expect(bundle).not.toContain('configureServer')
  })

  it('vite entry does not ship the rollup writeBundle plugin', () => {
    const bundle = readBundle('vite/index.cjs')

    expect(bundle).not.toContain('eve-resfile-rollup')
    expect(bundle).not.toContain('writeBundle')
  })

  it('rollup entry does not ship postcss value parsing', () => {
    const bundle = readBundle('rollup/index.cjs')

    expect(bundle).not.toContain('postcss-value-parser')
    expect(bundle).not.toContain('eve-resfile-postcss')
  })

  it('vite entry does not ship postcss value parsing', () => {
    const bundle = readBundle('vite/index.cjs')

    expect(bundle).not.toContain('postcss-value-parser')
    expect(bundle).not.toContain('eve-resfile-postcss')
  })
})
