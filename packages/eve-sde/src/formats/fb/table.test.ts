import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { openFbTable } from './table'

// Fixtures are generated from the .fbs and .json files next to them: flatc -b --schema <name>.fbs && flatc -b <name>.fbs <name>.json
const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__')

const fixture = (name: string) => {
  const read = (extension: string) => new Uint8Array(readFileSync(join(fixturesDir, `${name}.${extension}`)))
  return openFbTable(read('fb'), read('bfbs'))
}

describe('openFbTable', () => {
  const table = fixture('numeric')

  it('finds the key field and iterates rows in key order', () => {
    expect(table.keyField).toBe('id')
    expect(table.size).toBe(3)
    expect([...table.rows()].map((row) => row.id)).toEqual([1, 2, 30])
  })

  it('decodes nested tables, vectors, longs, enums and scalar defaults', () => {
    expect(table.get(1)).toEqual({
      id: 1,
      name: { en: 'First' },
      kind: 'Hull',
      big: -5,
      ratio: 0.5,
      published: false,
      level: 3,
      tags: [
        { name: 'a', weight: 1.25 },
        { name: 'b', weight: 0 },
      ],
      aliases: ['one', 'eins'],
      ids: [3, -4],
    })
    expect(table.get(30)).toEqual({
      id: 30,
      name: { en: 'Third' },
      kind: 'module',
      big: Number.MAX_SAFE_INTEGER,
      ratio: 0.5,
      published: false,
      level: 0,
      aliases: [],
    })
  })

  it('leaves absent optional scalars out', () => {
    expect(table.get(2)).toEqual({
      id: 2,
      name: { en: 'Second', de: 'Zweite' },
      kind: 'Hull',
      big: 0,
      ratio: 2.5,
      published: true,
    })
  })

  it('returns undefined for missing keys', () => {
    expect(table.get(0)).toBeUndefined()
    expect(table.get(3)).toBeUndefined()
    expect(table.get(31)).toBeUndefined()
  })

  it('projects top-level fields', () => {
    expect(table.get(1, { fields: ['id', 'kind'] })).toEqual({ id: 1, kind: 'Hull' })
    expect(Object.keys(table.get(1, { omit: ['tags', 'aliases', 'ids', 'name'] })!).sort()).toEqual([
      'big',
      'id',
      'kind',
      'level',
      'published',
      'ratio',
    ])
    expect(() => table.get(1, { fields: ['nope'] })).toThrow('Unknown field(s)')
  })

  it('looks up string keys in UTF-8 byte order', () => {
    const strings = fixture('string')
    expect([...strings.rows()].map((row) => row.name)).toEqual(['a', 'b', 'ä'])
    expect(strings.get('ä')).toEqual({ name: 'ä', value: 3 })
    expect(strings.get('c')).toBeUndefined()
  })
})
