import { parseJsonlLine, parseJsonlTable } from './parse-jsonl'

describe('parseJsonlTable', () => {
  it('parses object rows, _value rows, and blank lines', () => {
    expect(
      parseJsonlTable(`
{"_key": 1, "name": {"en": "Frigate"}}
{"_key": 2, "name": {"en": "Destroyer"}}

{"_key": 3, "_value": "alpha"}
`),
    ).toEqual({
      1: { name: { en: 'Frigate' } },
      2: { name: { en: 'Destroyer' } },
      3: 'alpha',
    })

    expect(parseJsonlLine('{"_key": 2, "groupID": 2}')).toEqual({
      key: 2,
      value: { groupID: 2 },
      kind: 'object',
    })
  })

  it('throws on duplicate keys by default', () => {
    expect(() =>
      parseJsonlTable(`
{"_key": 1, "name": {"en": "First"}}
{"_key": 1, "name": {"en": "Second"}}
`),
    ).toThrow('Duplicate _key 1 at line 3.')
  })
})
