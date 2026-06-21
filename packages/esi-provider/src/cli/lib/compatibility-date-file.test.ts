import { describe, expect, it } from 'vitest'

import { formatCompatibilityDateFile, parseCompatibilityDateFile } from './compatibility-date-file'

describe('compatibility-date-file', () => {
  it('formats and parses compatibility date files', () => {
    const content = formatCompatibilityDateFile('2026-06-09')

    expect(content).toBe('const compatibilityDate = "2026-06-09";\nexport default compatibilityDate;\n')
    expect(parseCompatibilityDateFile(content)).toBe('2026-06-09')
  })

  it('returns null for invalid content', () => {
    expect(parseCompatibilityDateFile("export default '2026-06-09';")).toBeNull()
  })
})
