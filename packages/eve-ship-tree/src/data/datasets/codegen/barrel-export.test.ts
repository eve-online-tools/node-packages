import { describe, expect, it } from 'vitest'
import { generateBarrelExportModule } from './barrel-export'

describe('generateBarrelExportModule', () => {
  it('generates re-export lines for each module name', () => {
    const module = generateBarrelExportModule(['icons', 'types'])

    expect(module).toBe(['export * from "./icons";', 'export * from "./types";', ''].join('\n'))
  })

  it('returns only a trailing newline for an empty list', () => {
    expect(generateBarrelExportModule([])).toBe('\n')
  })
})
