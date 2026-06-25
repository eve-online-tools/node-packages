import { normalizeTables, resolveOutputPath, resolveSdeOptions } from './plugin-core'
import { stripFields } from './processors/strip-fields'

describe('plugin-core', () => {
  it('normalizes table config', () => {
    expect(normalizeTables(['types', 'groups'])).toEqual(
      new Map([
        ['types', 'types.json'],
        ['groups', 'groups.json'],
      ]),
    )
    expect(normalizeTables({ types: 'custom-types.json' })).toEqual(new Map([['types', 'custom-types.json']]))
    expect(() => normalizeTables(['types.jsonl'])).toThrow('Invalid table name "types.jsonl"')
  })

  it('validates processor config', () => {
    expect(() => resolveSdeOptions({ outputDir: '', tables: ['types'] }, '/tmp')).toThrow(
      'SdeOptions.outputDir is required.',
    )
    expect(() => resolveSdeOptions({ outputDir: 'generated' }, '/tmp')).toThrow(
      'At least one of SdeOptions.tables or SdeOptions.processors must be set.',
    )
    expect(() =>
      resolveSdeOptions(
        {
          outputDir: 'generated',
          processors: [
            { id: 'dup', version: '1', run: async () => {} },
            { id: 'dup', version: '1', run: async () => {} },
          ],
        },
        '/tmp',
      ),
    ).toThrow('Duplicate SdeProcessor id "dup".')
    expect(() =>
      resolveSdeOptions(
        {
          outputDir: 'generated',
          processors: [{ id: 'names', run: async () => {} } as never],
        },
        '/tmp',
      ),
    ).toThrow('SdeProcessor "names" is missing required "version".')
    expect(() =>
      resolveSdeOptions(
        {
          outputDir: 'generated',
          processors: [
            stripFields('types', { keepLanguages: ['en'], fallbackLanguage: 'en' }),
            { id: 'types', version: '1', run: async () => {} },
          ],
        },
        '/tmp',
      ),
    ).toThrow('SdeProcessor "types" conflicts with stripFields("types").')
  })

  it('resolves paths against root', () => {
    const resolved = resolveSdeOptions(
      {
        outputDir: 'generated/sde',
        cacheDir: 'cache/eve-sde',
        tables: ['types'],
      },
      '/project',
    )

    expect(resolved.outputDir).toBe('/project/generated/sde')
    expect(resolved.cacheDir).toBe('/project/cache/eve-sde')
  })

  it('rejects output paths outside outputDir', () => {
    expect(() => resolveOutputPath('/tmp/output', '../outside.json')).toThrow(
      'Output path escapes outputDir: ../outside.json',
    )
    expect(resolveOutputPath('/tmp/output', 'subdir', 'file.json')).toBe('/tmp/output/subdir/file.json')
  })
})
