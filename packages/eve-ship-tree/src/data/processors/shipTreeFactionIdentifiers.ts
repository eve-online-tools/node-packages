import type { SdeProcessor } from '@eve-online-tools/eve-sde'

import { generateIdentifierModule, type IdentifierEntry } from './utils/identifier-map'

const outputPath = 'identifiers/shipTreeFactions.ts'

type FactionRecord = {
  name?: { en?: string }
}

export const shipTreeFactionIdentifiersProcessor = (): SdeProcessor => ({
  id: 'shipTreeFactionIdentifiers',
  version: '1',
  run: async ({ loadStream, writeText }) => {
    const shipTreeFactionIds = new Set<string | number>()

    for await (const record of loadStream('shipTreeFactions')) {
      shipTreeFactionIds.add(record.key)
    }

    const entries: IdentifierEntry[] = []

    for await (const record of loadStream('factions')) {
      if (!shipTreeFactionIds.has(record.key)) {
        continue
      }

      const faction = record.value as FactionRecord
      const name = faction.name?.en

      if (typeof name !== 'string') {
        continue
      }

      entries.push({
        id: record.key as number,
        name,
      })
    }

    await writeText(
      outputPath,
      generateIdentifierModule({
        entries,
        identifierVariableName: 'identifiers',
        nameVariableName: 'names',
        typeName: 'Identifier',
      }),
    )
  },
})
