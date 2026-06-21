import { writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

import { collectGeneratedKeys } from './utils/collect-generated-keys'
import { extractRequiredSkills, resolveNumericTechLevel, type TypeDogmaAttribute } from './utils/ship-type-requirements'

const typesJsonlPath = 'generated/types.jsonl'
const requiredSkillsJsonlPath = 'generated/requiredSkills.jsonl'

type TypeRecord = {
  techLevel?: number
  [key: string]: unknown
}

type RawTypeDogma = {
  dogmaAttributes?: Array<{ attributeID: number; value: number }>
}

const toTypeDogmaAttributes = (dogmaAttributes: RawTypeDogma['dogmaAttributes']): TypeDogmaAttribute[] =>
  (dogmaAttributes ?? []).map(({ attributeID, value }) => [attributeID, value])

export const shipTypeRequirementsProcessor = (): SdeProcessor => ({
  id: 'shipTypeRequirements',
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

    const requiredSkillsOut = await streamJson(requiredSkillsJsonlPath)
    const typesOut = await streamJson(typesJsonlPath)

    for (const [typeId, typeRecord] of typeRecords) {
      const attributes = attributesByTypeId.get(typeId)
      const { _key: _ignoredKey, ...typeFields } = typeRecord
      const augmentedType = { ...typeFields } as TypeRecord

      if (augmentedType.techLevel === undefined) {
        augmentedType.techLevel = resolveNumericTechLevel(augmentedType, attributes)
      }

      await requiredSkillsOut.write({
        _key: typeId,
        requiredSkills: extractRequiredSkills(attributes),
      })

      await writeSdeRecord(typesOut, { key: typeId, value: augmentedType, kind: 'object' }, augmentedType)
    }

    await requiredSkillsOut.close()
    await typesOut.close()
  },
})
