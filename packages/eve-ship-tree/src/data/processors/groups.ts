import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

const categoryShips = 6
const outputPath = 'generated/groups.jsonl'

export const groupsProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'groups',
  version: '1',
  run: async ({ loadStream, streamJson }) => {
    const out = await streamJson(outputPath)

    for await (const record of loadStream('groups')) {
      const group = record.value as { categoryID?: number }

      if (group.categoryID !== categoryShips) {
        continue
      }

      const stripped = applyStripFields(record.value, {
        keepLanguages,
        fallbackLanguage,
        fields: ['anchorable', 'anchored', 'fittableNonSingleton', 'iconID', 'useBasePrice'],
      })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()
  },
})
