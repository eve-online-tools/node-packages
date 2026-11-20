import { describe, expect, it } from 'vitest'
import { generateIdentifierModule } from './identifier-map'

describe('generateIdentifierModule', () => {
  it('generates identifier, type, and name exports', () => {
    const module = generateIdentifierModule({
      entries: [{ id: 1, name: 'Test' }],
      identifierVariableName: 'identifiers',
      nameVariableName: 'names',
      typeName: 'TestIdentifier',
    })

    expect(module).toBe(
      [
        'export const identifiers = {',
        '  test: 1,',
        '} as const;',
        '',
        'export type TestIdentifier = (typeof identifiers)[keyof typeof identifiers];',
        '',
        'export const names = {',
        '  1: "Test",',
        '} as const;',
        '',
      ].join('\n'),
    )
  })

  it('sorts entries by id and omits optional exports', () => {
    const module = generateIdentifierModule({
      entries: [
        { id: 2, name: 'Second' },
        { id: 1, name: 'First' },
      ],
      identifierVariableName: 'identifiers',
    })

    expect(module).toBe(['export const identifiers = {', '  first: 1,', '  second: 2,', '} as const;', ''].join('\n'))
  })

  it('deduplicates identifiers when names map to the same camelCase key', () => {
    const module = generateIdentifierModule({
      entries: [
        { id: 1, name: 'Test Name' },
        { id: 2, name: 'Test-Name' },
      ],
      identifierVariableName: 'identifiers',
      nameVariableName: 'names',
    })

    expect(module).toContain('  testName: 2,')
    expect(module).not.toContain('testName: 1,')
    expect(module).toContain('  1: "Test Name",')
    expect(module).toContain('  2: "Test-Name",')
  })
})
