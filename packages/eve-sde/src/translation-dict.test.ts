import { applyStripFields, isTranslationDict, stripTranslationDict } from './translation-dict'

describe('translation-dict', () => {
  it('detects translation dicts', () => {
    expect(isTranslationDict({ en: 'Ship', de: 'Schiff' })).toBe(true)
    expect(isTranslationDict({ en: 'Ship', count: 1 })).toBe(false)
  })

  it('strips languages and fills missing kept locales from fallback', () => {
    expect(
      stripTranslationDict({ en: 'B', ko: 'K' }, { mode: 'keep', keepLanguages: ['en', 'de'], fallbackLanguage: 'en' }),
    ).toEqual({ en: 'B', de: 'B' })

    expect(stripTranslationDict({ de: 'A', en: 'B', fr: 'C' }, { mode: 'remove', languages: ['de', 'fr'] })).toEqual({
      en: 'B',
    })
  })

  it('applies field deletion and language stripping together', () => {
    const input = {
      icon: 'res:/icon.png',
      name: { de: 'Corp', en: 'Corporation', fr: 'Corp FR' },
      nested: [{ description: { en: 'Desc', fr: 'Desc FR' } }],
    }

    expect(
      applyStripFields(input, {
        fields: ['icon'],
        keepLanguages: ['en'],
        fallbackLanguage: 'en',
      }),
    ).toEqual({
      name: { en: 'Corporation' },
      nested: [{ description: { en: 'Desc' } }],
    })
  })
})
