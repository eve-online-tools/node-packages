import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

const cloneGradesJsonlPath = 'generated/cloneGrades.jsonl'

export const cloneGradesProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'cloneGrades',
  version: [...keepLanguages].sort().join(','),
  run: async ({ loadStream, streamJson }) => {
    const out = await streamJson(cloneGradesJsonlPath)

    for await (const record of loadStream('cloneGrades')) {
      const stripped = applyStripFields(record.value, {
        keepLanguages,
        fallbackLanguage,
      })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()
  },
})
