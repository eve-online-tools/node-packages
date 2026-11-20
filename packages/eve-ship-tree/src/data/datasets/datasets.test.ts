import { fixture } from '@eve-online-tools/eve-sde'
import { buildDataset } from '@eve-online-tools/eve-sde/node'

import { iconsDataset } from './icons'
import { identifiersDataset } from './identifiers'

const name = (en: string) => ({ en })

const source = fixture({
  factions: [{ factionID: 500001, name: name('Caldari State'), flatLogo: 'caldari_logo' }],
  graphics: [{ graphicID: 1, iconFolder: 'res:/dx9/model/ship/Caldari/Icons', sofHullName: 'CF1_T1' }],
  groups: [{ groupID: 25, categoryID: 6 }],
  types: [{ typeID: 582, groupID: 25, name: name('Bantam'), graphicID: 1 }],
  typeDogma: [],
  shipTreeFactions: [{ factionID: 500001, icon: 'res:/UI/Texture/caldari.png' }],
  shipTreeElements: [{ elementID: 30, icon: 'explorer' }],
  shipTreeGroups: [
    {
      groupID: 4,
      name: name("Corvette's"),
      icon: 'res:/icon.png',
      iconLarge: 'res:/large.png',
      iconSmall: '',
      iconSmallNPC: 'res:/npc.png',
    },
  ],
})

const run = async () => {
  const outputs = await Promise.all(
    [identifiersDataset, iconsDataset].map((dataset) => buildDataset(dataset, { source })),
  )
  const files = new Map(outputs.flatMap((output) => [...output.writes]))
  return async (path: string) => new TextDecoder().decode(files.get(path))
}

describe('source datasets', () => {
  it('writes identifier modules', async () => {
    const read = await run()

    expect(await read('identifiers/shipTreeGroups.ts')).toContain('corvettes: 4,')
    expect(await read('identifiers/shipTreeFactions.ts')).toContain('caldariState: 500001,')
  })

  it('writes icon maps, CSS modules and barrels', async () => {
    const read = await run()

    expect(await read('icons/types/holoIcon.ts')).toContain(
      'import resDx9ModelShipCaldariIconsCf1T1IsisPng from "res:/dx9/model/ship/caldari/icons/cf1_t1_isis.png";',
    )
    expect(await read('icons/factions/flatLogo.css')).toContain(
      '--factions-flat-logo: url("res:/ui/texture/eveicon/faction_logos/caldari_logo_256px.png");',
    )
    expect(await read('icons/shipTreeElements/icons.ts')).toContain('career_icons/explorer_32px.png')
    expect(await read('icons/shipTreeGroups/iconSmall.ts')).toContain('export const iconSmall = {\n\n}')
    expect(await read('icons/shipTreeGroups/index.ts')).toBe(
      ['icon', 'iconLarge', 'iconSmall', 'iconSmallNPC'].map((file) => `export * from "./${file}";\n`).join(''),
    )
    expect((await read('icons/index.css')).split('\n')[0]).toBe('@import "./factions/flatLogo.css";')
  })
})
