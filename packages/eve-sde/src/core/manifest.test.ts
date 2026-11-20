import { parseManifest } from './manifest'

const table = {
  version: 'abc',
  jsonl: { url: 'https://x/types.jsonl', recordSchemaUrl: 'https://x/types.schema.json' },
  flatbuffers: {
    binaryUrl: 'https://x/types.fb',
    schemaUrl: 'https://x/types.fbs',
    binarySchemaUrl: 'https://x/types.bfbs',
  },
  record: { urlTemplate: 'https://x/types/{key}.json' },
}

describe('parseManifest', () => {
  it('maps the release body to a manifest', () => {
    expect(
      parseManifest({ release: 'R', buildNumber: 1, releaseDate: 'D', tables: { types: table } }).tables.types,
    ).toEqual({
      version: 'abc',
      jsonlUrl: 'https://x/types.jsonl',
      fbUrl: 'https://x/types.fb',
      bfbsUrl: 'https://x/types.bfbs',
      recordUrlTemplate: 'https://x/types/{key}.json',
    })
  })

  it('rejects a body missing table URLs', () => {
    expect(() =>
      parseManifest({ release: 'R', buildNumber: 1, releaseDate: 'D', tables: { types: { version: 'abc' } } }),
    ).toThrow('Invalid SDE release manifest: tables.types.jsonl is not an object.')
  })
})
