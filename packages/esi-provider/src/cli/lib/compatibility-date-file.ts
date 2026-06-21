import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { compatibilityDateFileName } from './constants'

const COMPATIBILITY_DATE_RE = /const compatibilityDate = "([^"]+)"/

export const formatCompatibilityDateFile = (date: string): string =>
  `const compatibilityDate = "${date}";\nexport default compatibilityDate;\n`

export const parseCompatibilityDateFile = (content: string): string | null => {
  const match = content.match(COMPATIBILITY_DATE_RE)
  return match?.[1] ?? null
}

export const readCompatibilityDate = (outputDir: string): string | null => {
  try {
    const content = readFileSync(join(outputDir, compatibilityDateFileName), 'utf8')
    return parseCompatibilityDateFile(content)
  } catch {
    return null
  }
}

export const writeCompatibilityDate = (outputDir: string, date: string): void => {
  writeFileSync(join(outputDir, compatibilityDateFileName), formatCompatibilityDateFile(date), 'utf8')
}

export const compatibilityDateExists = (outputDir: string): boolean =>
  existsSync(join(outputDir, compatibilityDateFileName))
