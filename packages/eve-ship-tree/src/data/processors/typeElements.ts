import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

const typeElementsJsonlPath = 'generated/typeElements.jsonl'

export const typeElementsProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'typeElements',
  version: [...keepLanguages].sort().join(','),
  run: async ({ loadStream, streamJson }) => {
    const out = await streamJson(typeElementsJsonlPath)

    for await (const record of loadStream('typeElements')) {
      const stripped = applyStripFields(record.value, {
        keepLanguages,
        fallbackLanguage,
      })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()
  },
})
