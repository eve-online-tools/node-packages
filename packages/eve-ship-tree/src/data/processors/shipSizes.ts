import type { SdeProcessor } from '@eve-online-tools/eve-sde'

import { collectGeneratedKeys } from './utils/collect-generated-keys'
import { resolveRigSize } from './utils/ship-type-sizes'
import type { TypeDogmaAttribute } from './utils/ship-type-requirements'

const shipSizesJsonlPath = 'generated/shipSizes.jsonl'

type TypeRecord = {
  shipTreeGroupID?: number
}

type RawTypeDogma = {
  dogmaAttributes?: Array<{ attributeID: number; value: number }>
}

const toTypeDogmaAttributes = (dogmaAttributes: RawTypeDogma['dogmaAttributes']): TypeDogmaAttribute[] =>
  (dogmaAttributes ?? []).map(({ attributeID, value }) => [attributeID, value])

export const shipSizesProcessor = (): SdeProcessor => ({
  id: 'shipSizes',
  version: '1',
  run: async ({ generatedStream, loadStream, streamJson }) => {
    const typeIds = await collectGeneratedKeys(generatedStream, 'types')
    const typeRecords = new Map<number, TypeRecord>()

    for await (const row of generatedStream('types')) {
      const record = row as { _key: number } & TypeRecord
      typeRecords.set(record._key, record)
    }

    const attributesByTypeId = new Map<number, TypeDogmaAttribute[]>()

    for await (const record of loadStream('typeDogma')) {
      if (!typeIds.has(record.key)) {
        continue
      }

      const { dogmaAttributes } = record.value as RawTypeDogma
      attributesByTypeId.set(record.key as number, toTypeDogmaAttributes(dogmaAttributes))
    }

    const typeIdsByRigSize = new Map<number, number[]>()

    for (const [typeId, typeRecord] of typeRecords) {
      const rigSize = resolveRigSize(typeRecord.shipTreeGroupID, attributesByTypeId.get(typeId))
      const typeIds = typeIdsByRigSize.get(rigSize)

      if (typeIds === undefined) {
        typeIdsByRigSize.set(rigSize, [typeId])
      } else {
        typeIds.push(typeId)
      }
    }

    const shipSizesOut = await streamJson(shipSizesJsonlPath)

    for (const rigSize of [...typeIdsByRigSize.keys()].sort((left, right) => left - right)) {
      const typeIDs = typeIdsByRigSize.get(rigSize)!

      typeIDs.sort((left, right) => left - right)

      await shipSizesOut.write({
        _key: rigSize,
        typeIDs,
      })
    }

    await shipSizesOut.close()
  },
})
