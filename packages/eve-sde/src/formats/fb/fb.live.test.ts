import { isDeepStrictEqual } from 'node:util'

import { fetchLiveFile, fetchLiveManifest, parseJsonLines } from '../../test-utils/live-sde'
import { openFbTable } from './table'

const manifest = await fetchLiveManifest()
const maxReportedMismatches = 3

const loadTable = async (name: string) => {
  const table = manifest.tables[name]!
  const [data, schema, jsonl] = await Promise.all([
    fetchLiveFile(table.flatbuffers.binaryUrl),
    fetchLiveFile(table.flatbuffers.binarySchemaUrl),
    fetchLiveFile(table.jsonl.url),
  ])
  return { fb: openFbTable(data, schema), expected: parseJsonLines(jsonl) }
}

describe(`SDE release ${manifest.release}`, () => {
  describe.each(Object.keys(manifest.tables).sort())('%s', (name) => {
    it('decodes every row identically to the JSONL export', async () => {
      const { fb, expected } = await loadTable(name)
      const mismatches: unknown[] = []

      for (const row of expected) {
        const key = row[fb.keyField] as string | number
        const actual = fb.get(key)
        if (!isDeepStrictEqual(actual, row) && mismatches.length < maxReportedMismatches) {
          mismatches.push({ key, expected: row, actual })
        }
      }

      expect(mismatches).toEqual([])
      expect(fb.size).toBe(expected.length)
    })

    it('iterates rows in key order', async () => {
      const { fb } = await loadTable(name)
      let previous: string | number | undefined
      let count = 0

      for (const row of fb.rows({ fields: [fb.keyField] })) {
        const key = row[fb.keyField] as string | number
        if (previous !== undefined && !(previous < key)) {
          throw new Error(`Row ${count} key ${String(key)} does not sort after ${String(previous)}.`)
        }
        previous = key
        count++
      }

      expect(count).toBe(fb.size)
    })
  })
})

describe('projection', () => {
  it('decodes only the requested fields', async () => {
    const { fb } = await loadTable('types')
    expect(fb.get(587, { fields: ['typeID', 'groupID'] })).toEqual({ typeID: 587, groupID: 25 })
    expect(fb.get(587, { omit: ['description', 'name'] })).not.toHaveProperty('name')
    expect(() => fb.get(587, { fields: ['nope'] })).toThrow('Unknown field(s) for')
  })
})
