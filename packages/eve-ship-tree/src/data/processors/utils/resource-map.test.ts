import { describe, expect, it } from 'vitest'
import { generateResfileMapModule } from './resource-map'

describe('generateResfileMapModule', () => {
  it('generates imports and export maps for resource paths', () => {
    const module = generateResfileMapModule([
      {
        exportName: 'icons',
        entries: [{ key: 1, resPath: 'res:/ui/texture/icons/icon.png' }],
      },
    ])

    expect(module).toBe(
      [
        'import resUiTextureIconsIconPng from "res:/ui/texture/icons/icon.png";',
        '',
        'export const icons = {',
        '  1: resUiTextureIconsIconPng,',
        '} as const;',
        '',
      ].join('\n'),
    )
  })

  it('reuses imports for duplicate paths and sorts keys', () => {
    const module = generateResfileMapModule([
      {
        exportName: 'icons',
        entries: [
          { key: 2, resPath: 'res:/ui/texture/icons/icon.png' },
          { key: 1, resPath: 'res:/ui/texture/icons/icon.png' },
        ],
      },
    ])

    expect(module.match(/^import /gm)).toHaveLength(1)
    expect(module).toContain('  1: resUiTextureIconsIconPng,')
    expect(module).toContain('  2: resUiTextureIconsIconPng,')
    expect(module.indexOf('  1:')).toBeLessThan(module.indexOf('  2:'))
  })

  it('normalizes paths before generating imports', () => {
    const module = generateResfileMapModule([
      {
        exportName: 'icons',
        entries: [{ key: 1, resPath: 'res:\\UI\\Texture\\Icons\\Icon.PNG' }],
      },
    ])

    expect(module).toContain('import resUiTextureIconsIconPng from "res:/ui/texture/icons/icon.png";')
  })

  it('adds a default export when requested', () => {
    const module = generateResfileMapModule([
      {
        exportName: 'icons',
        exportDefault: true,
        entries: [{ key: 1, resPath: 'res:/ui/icon.png' }],
      },
    ])

    expect(module).toContain('\nexport default icons;\n')
  })

  it('throws when multiple maps request a default export', () => {
    expect(() =>
      generateResfileMapModule([
        {
          exportName: 'icons',
          exportDefault: true,
          entries: [{ key: 1, resPath: 'res:/ui/icon.png' }],
        },
        {
          exportName: 'textures',
          exportDefault: true,
          entries: [{ key: 1, resPath: 'res:/ui/texture.png' }],
        },
      ]),
    ).toThrow('Multiple default exports found')
  })
})
