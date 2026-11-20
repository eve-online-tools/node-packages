import { elementIconPath, factionLogoPath, holoIconPath } from './icon-paths'

describe('elementIconPath', () => {
  it('uses the 32px category icon', () => {
    expect(elementIconPath('stasis_webifying')).toBe('res:/ui/texture/eveicon/category_icons/stasis_webifying_32px.png')
  })

  it('uses the career icon for explorer', () => {
    expect(elementIconPath('explorer')).toBe('res:/ui/texture/eveicon/career_icons/explorer_32px.png')
  })
})

describe('factionLogoPath', () => {
  it('uses the 256px logo', () => {
    expect(factionLogoPath('caldari_logo')).toBe('res:/ui/texture/eveicon/faction_logos/caldari_logo_256px.png')
  })

  it('uses the 264px logo where the 256px one is a placeholder', () => {
    expect(factionLogoPath('concord_logo')).toBe('res:/ui/texture/eveicon/faction_logos/concord_logo_264px.png')
  })
})

describe('holoIconPath', () => {
  it('lowercases the graphic icon folder and hull name', () => {
    expect(holoIconPath({ iconFolder: 'res:/dx9/model/ship/Amarr/icons', sofHullName: 'ABC1_T1' })).toBe(
      'res:/dx9/model/ship/amarr/icons/abc1_t1_isis.png',
    )
  })
})
