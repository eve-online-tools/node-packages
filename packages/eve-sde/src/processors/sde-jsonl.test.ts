import { formatSdeJsonlRecord } from './sde-jsonl'

describe('sde-jsonl', () => {
  it('formats object and _value rows', () => {
    expect(formatSdeJsonlRecord({ key: 2, value: { groupID: 2 }, kind: 'object' }, { groupID: 2 })).toBe(
      '{"_key":2,"groupID":2}\n',
    )
    expect(formatSdeJsonlRecord({ key: 582, value: [1], kind: 'value' }, [1, 2])).toBe('{"_key":582,"_value":[1,2]}\n')
  })
})
