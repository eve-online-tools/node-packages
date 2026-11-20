import { describe, expect, it } from 'vitest'
import { generateCssImportModule, generateCssVariablesModule, generateResfileCssModule } from './css-variables'

describe('generateCssVariablesModule', () => {
  it('generates data-attribute-scoped custom properties', () => {
    const module = generateCssVariablesModule({
      dataAttribute: 'faction',
      prefix: 'factions',
      entries: [
        {
          id: 500001,
          variables: {
            flatLogo: 'url("res:/ui/texture/eveicon/faction_logos/caldari_logo_256px.png")',
          },
        },
      ],
    })

    expect(module).toBe(
      [
        '[data-faction="500001"] {',
        '  --factions-flat-logo: url("res:/ui/texture/eveicon/faction_logos/caldari_logo_256px.png");',
        '}',
        '',
      ].join('\n'),
    )
  })

  it('sorts entries by id and property names alphabetically', () => {
    const module = generateCssVariablesModule({
      dataAttribute: 'faction',
      prefix: 'factions',
      entries: [
        {
          id: 500002,
          variables: { zLogo: 'url(z)', aLogo: 'url(a)' },
        },
        {
          id: 500001,
          variables: { flatLogo: 'url(a)' },
        },
      ],
    })

    expect(module.indexOf('[data-faction="500001"]')).toBeLessThan(module.indexOf('[data-faction="500002"]'))
    expect(module.indexOf('--factions-a-logo')).toBeLessThan(module.indexOf('--factions-z-logo'))
  })
})

describe('generateResfileCssModule', () => {
  it('wraps resource paths as url values', () => {
    const module = generateResfileCssModule({
      dataAttribute: 'faction',
      prefix: 'factions',
      maps: [
        {
          exportName: 'flatLogo',
          entries: [
            {
              key: 500001,
              resPath: 'res:/ui/texture/eveicon/faction_logos/caldari_logo_256px.png',
            },
          ],
        },
      ],
    })

    expect(module).toContain(
      '  --factions-flat-logo: url("res:/ui/texture/eveicon/faction_logos/caldari_logo_256px.png");',
    )
  })

  it('normalizes paths before generating values', () => {
    const module = generateResfileCssModule({
      dataAttribute: 'group',
      prefix: 'ship-tree-groups',
      maps: [
        {
          exportName: 'icon',
          entries: [
            {
              key: 1,
              resPath: 'res:\\UI\\Texture\\Icons\\Icon.PNG',
            },
          ],
        },
      ],
    })

    expect(module).toContain('  --ship-tree-groups-icon: url("res:/ui/texture/icons/icon.png");')
  })

  it('merges maps that share the same key into one selector block', () => {
    const module = generateResfileCssModule({
      dataAttribute: 'faction',
      prefix: 'factions',
      maps: [
        {
          exportName: 'flatLogo',
          entries: [{ key: 500001, resPath: 'res:/ui/flat.png' }],
        },
        {
          exportName: 'roundLogo',
          entries: [{ key: 500001, resPath: 'res:/ui/round.png' }],
        },
      ],
    })

    expect(module.match(/\[data-faction="500001"\]/g)).toHaveLength(1)
    expect(module).toContain('  --factions-flat-logo: url("res:/ui/flat.png");')
    expect(module).toContain('  --factions-round-logo: url("res:/ui/round.png");')
  })
})

describe('generateCssImportModule', () => {
  it('generates import lines for each path', () => {
    const module = generateCssImportModule(['./factions/flatLogo.css', './shipTreeFactions/icons.css'])

    expect(module).toBe(
      ['@import "./factions/flatLogo.css";', '@import "./shipTreeFactions/icons.css";', ''].join('\n'),
    )
  })

  it('returns only a trailing newline for an empty list', () => {
    expect(generateCssImportModule([])).toBe('\n')
  })
})
