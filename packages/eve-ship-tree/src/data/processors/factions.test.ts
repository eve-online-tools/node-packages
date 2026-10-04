import { describe, expect, it } from 'vitest'

import { factionLogoPath } from './factions'

describe('factionLogoPath', () => {
  it('uses the 256px logo', () => {
    expect(factionLogoPath('caldari_logo')).toBe('res:/ui/texture/eveicon/faction_logos/caldari_logo_256px.png')
  })

  it('uses the 264px logo where the 256px one is a placeholder', () => {
    expect(factionLogoPath('concord_logo')).toBe('res:/ui/texture/eveicon/faction_logos/concord_logo_264px.png')
  })
})
