import { findResfileIndexCdnPath, parseEveClientManifest, parseFirstTwoColumns, parseResfileIndex } from './parse'
import { eveClientManifest, resfileIndexPath } from './constants'

describe('parse', () => {
  it('parses eveclient_TQ.json manifests', () => {
    expect(parseEveClientManifest({ buildNumber: '123456' }, 'binaries.test')).toEqual({ buildNumber: '123456' })
    expect(parseEveClientManifest({ buildNumber: 123456 }, 'binaries.test')).toEqual({ buildNumber: '123456' })
  })

  it('rejects invalid eveclient_TQ.json manifests', () => {
    expect(() => parseEveClientManifest(null, 'binaries.test')).toThrow(
      `Invalid ${eveClientManifest} from binaries.test: expected an object.`,
    )
    expect(() => parseEveClientManifest({}, 'binaries.test')).toThrow(
      `Invalid ${eveClientManifest} from binaries.test: missing buildNumber.`,
    )
    expect(() => parseEveClientManifest({ buildNumber: { bad: true } }, 'binaries.test')).toThrow(
      `Invalid ${eveClientManifest} from binaries.test: buildNumber must be a string or number.`,
    )
  })

  it('parses the first two CSV columns', () => {
    expect(parseFirstTwoColumns('res:/icons/icon.png,icons/icon.png,deadbeef')).toEqual([
      'res:/icons/icon.png',
      'icons/icon.png',
    ])
    expect(parseFirstTwoColumns('invalid-line')).toBeNull()
    expect(parseFirstTwoColumns(',missing-path')).toBeNull()
  })

  it('parses resfile index lines into a map', () => {
    const content = [
      'res:/icons/64/icon.png,icons/icon_123.png,hash',
      '',
      'res:/ui/window.png,ui/window_456.png,hash2',
    ].join('\n')

    expect(parseResfileIndex(content)).toEqual(
      new Map([
        ['res:/icons/64/icon.png', 'icons/icon_123.png'],
        ['res:/ui/window.png', 'ui/window_456.png'],
      ]),
    )
  })

  it('stores res paths using lowercase lookup keys', () => {
    const content = 'res:/Icons/64/Icon.PNG,icons/icon_123.png,hash'

    expect(parseResfileIndex(content)).toEqual(new Map([['res:/icons/64/icon.png', 'icons/icon_123.png']]))
  })

  it('finds the resfile index CDN path in a build index', () => {
    const buildIndex = [
      'other:/file.txt,other/file.txt,hash',
      `${resfileIndexPath},resindex/resfileindex_789.txt,hash`,
    ].join('\n')

    expect(findResfileIndexCdnPath(buildIndex)).toBe('resindex/resfileindex_789.txt')
  })

  it('throws when the resfile index path is missing', () => {
    expect(() => findResfileIndexCdnPath('other:/file.txt,other/file.txt,hash')).toThrow(
      `${resfileIndexPath} not found in build index.`,
    )
  })
})
