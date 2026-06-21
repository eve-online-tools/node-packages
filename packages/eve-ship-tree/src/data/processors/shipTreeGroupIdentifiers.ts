import type { SdeProcessor } from '@eve-online-tools/eve-sde'

import { generateIdentifierModule, type IdentifierEntry } from './utils/identifier-map'

const outputPath = 'identifiers/shipTreeGroups.ts'

type ShipTreeGroupRecord = {
  name?: { en?: string }
}

export const shipTreeGroupIdentifiersProcessor = (): SdeProcessor => ({
  id: 'shipTreeGroupIdentifiers',
  version: '1',
  run: async ({ loadStream, writeText }) => {
    const entries: IdentifierEntry[] = []

    for await (const record of loadStream('shipTreeGroups')) {
      const group = record.value as ShipTreeGroupRecord
      const name = group.name?.en

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
