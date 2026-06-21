import type { SdeProcessor } from '@eve-online-tools/eve-sde'

import { shipSizeAttributeIds } from './utils/ship-type-sizes'
import { shipTypeRequirementAttributeIds } from './utils/ship-type-requirements'
import { generateIdentifierModule, type IdentifierEntry } from './utils/identifier-map'

const outputPath = 'identifiers/dogmaAttributes.ts'

type DogmaAttributeRecord = {
  name?: string
}

export const dogmaAttributeIdentifiersProcessor = (): SdeProcessor => ({
  id: 'dogmaAttributeIdentifiers',
  version: '1',
  run: async ({ loadStream, writeText }) => {
    const entries: IdentifierEntry[] = []

    for await (const record of loadStream('dogmaAttributes')) {
      if (
        !shipTypeRequirementAttributeIds.has(record.key as number) &&
        !shipSizeAttributeIds.has(record.key as number)
      ) {
        continue
      }

      const name = (record.value as DogmaAttributeRecord).name

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
        preserveNames: true,
      }),
    )
  },
})
