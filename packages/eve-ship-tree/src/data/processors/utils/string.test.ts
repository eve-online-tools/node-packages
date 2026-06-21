import { describe, expect, it } from 'vitest'
import { toCamelCase, toKebabCase } from './string'

describe('toCamelCase', () => {
  it('converts a single word to lowercase camelCase', () => {
    expect(toCamelCase('Test')).toBe('test')
    expect(toCamelCase('FRIGATE')).toBe('frigate')
  })

  it('converts space-separated words to camelCase', () => {
    expect(toCamelCase('Navy Frigate')).toBe('navyFrigate')
    expect(toCamelCase('some-name_with spaces')).toBe('someNameWithSpaces')
  })

  it('strips apostrophes before splitting', () => {
    expect(toCamelCase("O'Reilly")).toBe('oreilly')
    expect(toCamelCase("Navy's Frigate")).toBe('navysFrigate')
  })

  it('converts resource paths to camelCase identifiers', () => {
    expect(toCamelCase('res:/ui/texture/icons/icon.png')).toBe('resUiTextureIconsIconPng')
  })

  it('throws when the input has no alphanumeric characters', () => {
    expect(() => toCamelCase('')).toThrow('Cannot convert empty string to camelCase')
    expect(() => toCamelCase('---')).toThrow('Cannot convert empty string to camelCase')
  })
})

describe('toKebabCase', () => {
  it('converts a single word to lowercase kebab-case', () => {
    expect(toKebabCase('Test')).toBe('test')
    expect(toKebabCase('FRIGATE')).toBe('frigate')
  })

  it('converts space-separated words to kebab-case', () => {
    expect(toKebabCase('Navy Frigate')).toBe('navy-frigate')
    expect(toKebabCase('some-name_with spaces')).toBe('some-name-with-spaces')
  })

  it('splits camelCase boundaries', () => {
    expect(toKebabCase('flatLogo')).toBe('flat-logo')
    expect(toKebabCase('iconSmallNPC')).toBe('icon-small-npc')
  })

  it('strips apostrophes before splitting', () => {
    expect(toKebabCase("O'Reilly")).toBe('oreilly')
    expect(toKebabCase("Navy's Frigate")).toBe('navys-frigate')
  })

  it('throws when the input has no alphanumeric characters', () => {
    expect(() => toKebabCase('')).toThrow('Cannot convert empty string to kebab-case')
    expect(() => toKebabCase('---')).toThrow('Cannot convert empty string to kebab-case')
  })
})
