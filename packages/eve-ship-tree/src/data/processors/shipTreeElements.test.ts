import { describe, expect, it } from 'vitest'

import { elementIconPath } from './shipTreeElements'

describe('elementIconPath', () => {
  it('uses the 32px category icon', () => {
    expect(elementIconPath('stasis_webifying')).toBe('res:/ui/texture/eveicon/category_icons/stasis_webifying_32px.png')
  })

  it('uses the career icon for explorer', () => {
    expect(elementIconPath('explorer')).toBe('res:/ui/texture/eveicon/career_icons/explorer_32px.png')
  })
})
