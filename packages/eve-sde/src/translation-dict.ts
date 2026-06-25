import type { StripFieldsOptions } from './types'

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value)

const deleteFieldAtPath = (value: unknown, segments: readonly string[]): unknown => {
  if (segments.length === 0 || !isPlainObject(value)) {
    return value
  }

  const [segment, ...rest] = segments
  if (!(segment in value)) {
    return value
  }

  if (rest.length === 0) {
    const copy = { ...value }
    delete copy[segment]
    return copy
  }

  const child = value[segment]
  if (!isPlainObject(child)) {
    return value
  }

  return { ...value, [segment]: deleteFieldAtPath(child, rest) }
}

const deleteFieldsByPaths = (value: unknown, paths: readonly string[]): unknown =>
  paths.reduce((current, path) => {
    const segments = path.split('.').filter((segment) => segment.length > 0)
    return deleteFieldAtPath(current, segments)
  }, value)

export const isTranslationDict = (value: unknown): value is Record<string, string> => {
  if (!isPlainObject(value) || !('en' in value)) {
    return false
  }

  return Object.values(value).every((entry) => typeof entry === 'string')
}

export type StripTranslationDictOptions =
  | {
      mode: 'keep'
      keepLanguages: readonly string[]
      fallbackLanguage: string
    }
  | {
      mode: 'remove'
      languages: readonly string[]
    }

export const stripTranslationDict = (
  dict: Record<string, string>,
  options: StripTranslationDictOptions,
): Record<string, string> => {
  if (options.mode === 'remove') {
    const stripped = { ...dict }
    for (const language of options.languages) {
      delete stripped[language]
    }
    return stripped
  }

  const fallback = dict[options.fallbackLanguage]
  if (fallback === undefined) {
    throw new Error(`Fallback language "${options.fallbackLanguage}" is missing from translation dict.`)
  }

  const stripped: Record<string, string> = {}
  for (const language of options.keepLanguages) {
    stripped[language] = dict[language] ?? fallback
  }

  return stripped
}

const applyLanguagesDeep = (value: unknown, options: StripTranslationDictOptions): unknown => {
  if (Array.isArray(value)) {
    return value.map((entry) => applyLanguagesDeep(entry, options))
  }

  if (!isPlainObject(value)) {
    return value
  }

  if (isTranslationDict(value)) {
    return stripTranslationDict(value, options)
  }

  const stripped: Record<string, unknown> = {}
  for (const [key, entry] of Object.entries(value)) {
    stripped[key] = applyLanguagesDeep(entry, options)
  }

  return stripped
}

export const applyStripFields = (value: unknown, options: StripFieldsOptions): unknown => {
  let result = value

  if (options.fields?.length) {
    result = deleteFieldsByPaths(result, options.fields)
  }

  if (options.keepLanguages) {
    result = applyLanguagesDeep(result, {
      mode: 'keep',
      keepLanguages: options.keepLanguages,
      fallbackLanguage: options.fallbackLanguage!,
    })
  } else if (options.languages) {
    result = applyLanguagesDeep(result, {
      mode: 'remove',
      languages: options.languages,
    })
  }

  return result
}
