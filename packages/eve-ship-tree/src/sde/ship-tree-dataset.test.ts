import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { fixture } from '@eve-online-tools/eve-sde'
import { runDatasets, type Lockfile } from '@eve-online-tools/eve-sde/node'

import type { Data } from '../data-provider/types'
import { dogmaAttributeIds as ids } from './dogma'
import { shipTreeDataset } from './ship-tree-dataset'

const name = (en: string) => ({ en, de: `${en} (de)` })
const bonus = (text: string) => ({ bonus: 5, bonusText: name(text), importance: 1, unitID: 105 })

const source = fixture({
  groups: [
    { groupID: 25, categoryID: 6 },
    { groupID: 255, categoryID: 16 },
  ],
  types: [
    { typeID: 582, groupID: 25, name: name('Bantam'), shipTreeGroupID: 4, factionID: 500001, metaGroupID: 1 },
    { typeID: 670, groupID: 25, name: name('Capsule') },
    { typeID: 3330, groupID: 255, name: name('Caldari Frigate') },
    { typeID: 3327, groupID: 255, name: name('Spaceship Command') },
  ],
  typeDogma: [
    {
      typeID: 582,
      dogmaAttributes: [
        { attributeID: ids.requiredSkill1, value: 3330 },
        { attributeID: ids.requiredSkill1Level, value: 1 },
        { attributeID: ids.rigSize, value: 1 },
      ],
    },
  ],
  masteries: [{ typeID: 582, levels: [{ level: 0, certificateIDs: [96] }] }],
  certificates: [
    {
      certificateID: 96,
      name: name('Core'),
      skillTypes: [{ typeID: 3327, basic: 1, standard: 2, improved: 3, advanced: 4, elite: 5 }],
    },
    { certificateID: 97, name: name('Unused'), skillTypes: [] },
  ],
  cloneGrades: [{ cloneGradeID: 1, name: 'Alpha Caldari', skills: [{ typeID: 3330, level: 4 }] }],
  shipTreeGroups: [
    {
      groupID: 4,
      name: name('Corvette'),
      icon: 'res:/icon.png',
      elements: [{ position: 1, elementID: 30 }],
      preReqSkills: [{ factionID: 500001, skills: [{ skillTypeID: 3327, display: false, level: 1 }] }],
    },
  ],
  shipTreeElements: [{ elementID: 30, name: name('Small'), description: name('Small ships'), icon: 'small' }],
  shipTreeFactions: [{ factionID: 500001, description: name('Missiles'), elements: [{ position: 1, elementID: 9 }] }],
  typeBonus: [
    { typeID: 582, types: [{ typeID: 3330, bonuses: [bonus('bonus to range')] }], roleBonuses: [bonus('role')] },
    { typeID: 670, roleBonuses: [bonus('not in the tree')] },
  ],
  typeElements: [{ typeID: 582, elements: [{ position: 1, elementID: 30 }] }],
})

const locked = { version: 'v1', fb: 'f', bfbs: 'b' }
const lockfile: Lockfile = {
  lockfileVersion: 1,
  release: '20261119T000000Z',
  buildNumber: 1,
  releaseDate: '2026-11-19T00:00:00Z',
  tables: Object.fromEntries([...shipTreeDataset().tables, 'groups', 'typeDogma'].map((table) => [table, locked])),
}

const run = async () => {
  const root = await mkdtemp(join(tmpdir(), 'eve-ship-tree-'))
  const dataset = shipTreeDataset()
  const result = await (
    await runDatasets({ datasets: [dataset], lockfile, source, root, cacheDir: join(root, 'cache') })
  )
    .get(dataset.id)!
    .load()
  const file = result.assets.get('ship-tree-data.json')!
  return { value: result.value, data: JSON.parse(new TextDecoder().decode(file)) as Data }
}

describe('shipTreeDataset', () => {
  it('emits one data file and returns its url', async () => {
    const { value } = await run()

    expect(value).toEqual({ url: { __eveSdeAsset: 'ship-tree-data.json' } })
  })

  it('builds the tables for ships in the tree', async () => {
    const { data } = await run()

    expect(data.types).toEqual({
      582: { name: { en: 'Bantam' }, shipTreeGroupID: 4, factionID: 500001, metaGroupID: 1, techLevel: 1 },
    })
    expect(data.requiredSkills).toEqual({ 582: { requiredSkills: { 3330: 1 } } })
    expect(data.shipSizes).toEqual({ 1: { typeIDs: [582] } })
    expect(data.masteries).toEqual({ 582: { levels: [{ level: 0, certificateIDs: [96] }] } })
    expect(data.certificates).toEqual({
      96: { skillTypes: [{ typeID: 3327, basic: 1, standard: 2, improved: 3, advanced: 4, elite: 5 }] },
    })
    expect(data.cloneGrades).toEqual({ 1: { skills: [{ typeID: 3330, level: 4 }] } })
    expect(data.typeElements).toEqual({ 582: { elements: [{ position: 1, elementID: 30 }] } })
    expect(Object.keys(data.typeBonus)).toEqual(['582'])
  })

  it('keeps English text only', async () => {
    const { data } = await run()

    expect(data.shipTreeGroups[4]).toEqual({
      name: { en: 'Corvette' },
      elements: [{ position: 1, elementID: 30 }],
      preReqSkills: [{ factionID: 500001, skills: [{ skillTypeID: 3327, display: false, level: 1 }] }],
    })
    expect(data.shipTreeElements[30]).toEqual({ name: { en: 'Small' }, description: { en: 'Small ships' } })
    expect(data.shipTreeFactions[500001]).toEqual({
      description: { en: 'Missiles' },
      elements: [{ position: 1, elementID: 9 }],
    })
    expect(data.typeBonus[582].types?.[0].bonuses[0].bonusText).toEqual({ en: 'bonus to range' })
  })

  it('names the skills that groups, bonuses and requirements reference', async () => {
    const { data } = await run()

    expect(data.skills).toEqual({
      3327: { name: { en: 'Spaceship Command' } },
      3330: { name: { en: 'Caldari Frigate' } },
    })
  })
})
