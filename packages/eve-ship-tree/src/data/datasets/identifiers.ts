import { defineDataset } from '@eve-online-tools/eve-sde'

import { generateIdentifierModule, type IdentifierEntry } from './codegen'

const identifierModule = (entries: IdentifierEntry[]) =>
  generateIdentifierModule({
    entries,
    identifierVariableName: 'identifiers',
    nameVariableName: 'names',
    typeName: 'Identifier',
  })

/** Writes `identifiers/shipTreeGroups.ts` and `identifiers/shipTreeFactions.ts` under `src/data`. */
export const identifiersDataset = defineDataset({
  id: 'eve-ship-tree:identifiers',
  version: '1',
  tables: ['factions', 'shipTreeFactions', 'shipTreeGroups'],
  outDir: 'src/data',
  build: async ({ table, write }) => {
    const groups: IdentifierEntry[] = []
    for await (const { groupID, name } of table('shipTreeGroups').list({ fields: ['groupID', 'name'] })) {
      groups.push({ id: groupID, name: name.en })
    }
    await write('identifiers/shipTreeGroups.ts', identifierModule(groups))

    const factionIds = []
    for await (const { factionID } of table('shipTreeFactions').list({ fields: ['factionID'] })) {
      factionIds.push(factionID)
    }
    const factions = [...(await table('factions').getMany(factionIds))].map(([id, faction]) => ({
      id,
      name: faction.name.en,
    }))
    await write('identifiers/shipTreeFactions.ts', identifierModule(factions))
  },
})
