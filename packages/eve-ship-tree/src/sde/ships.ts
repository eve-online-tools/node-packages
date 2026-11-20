import { defineDataset } from '@eve-online-tools/eve-sde'

import type { Skills } from '../skills-provider/context'
import { dogmaAttributes, requiredSkills, rigSize, techLevel } from './dogma'

const shipCategoryId = 6

export type Ship = {
  name: string
  shipTreeGroupID?: number
  factionID?: number
  metaGroupID?: number
  techLevel: number
  graphicID?: number
  requiredSkills: Skills
  rigSize: number
}

/** Every type in the Ship category, by type ID, with the dogma values the ship tree needs. */
export const shipsDataset = defineDataset({
  id: 'eve-ship-tree:ships',
  version: '1',
  tables: ['groups', 'types', 'typeDogma'],
  build: async ({ table }) => {
    const groupIds = new Set<number>()
    for await (const group of table('groups').list({ fields: ['groupID', 'categoryID'] })) {
      if (group.categoryID === shipCategoryId) {
        groupIds.add(group.groupID)
      }
    }

    const types = []
    for await (const type of table('types').list({
      fields: ['typeID', 'groupID', 'name', 'shipTreeGroupID', 'factionID', 'metaGroupID', 'techLevel', 'graphicID'],
    })) {
      if (groupIds.has(type.groupID)) {
        types.push(type)
      }
    }

    const dogma = await table('typeDogma').getMany(types.map((type) => type.typeID))
    const ships: Record<number, Ship> = {}
    for (const type of types) {
      const attributes = dogmaAttributes(dogma.get(type.typeID)?.dogmaAttributes)
      ships[type.typeID] = {
        name: type.name.en,
        shipTreeGroupID: type.shipTreeGroupID,
        factionID: type.factionID,
        metaGroupID: type.metaGroupID,
        techLevel: techLevel(type.techLevel, attributes),
        graphicID: type.graphicID,
        requiredSkills: requiredSkills(attributes),
        rigSize: rigSize(type.shipTreeGroupID, attributes),
      }
    }
    return ships
  },
})
