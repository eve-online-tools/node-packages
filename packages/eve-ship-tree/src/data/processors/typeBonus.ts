import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

const typeBonusJsonlPath = 'generated/typeBonus.jsonl'

export const typeBonusProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'typeBonus',
  version: [...keepLanguages].sort().join(','),
  run: async ({ loadStream, streamJson }) => {
    const out = await streamJson(typeBonusJsonlPath)

    for await (const record of loadStream('typeBonus')) {
      const stripped = applyStripFields(record.value, {
        keepLanguages,
        fallbackLanguage,
      })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()
  },
})
