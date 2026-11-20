import { describe, expect, it } from 'vitest'
import { normalizeResPath } from './path'

describe('normalizeResPath', () => {
  it('lowercases the path', () => {
    expect(normalizeResPath('res:/UI/Texture/Icon.PNG')).toBe('res:/ui/texture/icon.png')
  })

  it('converts backslashes to forward slashes', () => {
    expect(normalizeResPath('res:\\ui\\texture\\icon.png')).toBe('res:/ui/texture/icon.png')
  })

  it('collapses duplicate slashes after the res scheme', () => {
    expect(normalizeResPath('res:/dx9/model/ship/ore/battleship/oreb1/icons//oreb1_t1c_isis.png')).toBe(
      'res:/dx9/model/ship/ore/battleship/oreb1/icons/oreb1_t1c_isis.png',
    )
  })
})
