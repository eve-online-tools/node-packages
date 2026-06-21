import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

import { collectGeneratedKeys } from './utils/collect-generated-keys'

const masteriesJsonlPath = 'generated/masteries.jsonl'

export const masteriesProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'masteries',
  version: [...keepLanguages].sort().join(','),
  run: async ({ generatedStream, loadStream, streamJson }) => {
    const typeIds = await collectGeneratedKeys(generatedStream, 'types')
    const out = await streamJson(masteriesJsonlPath)

    for await (const record of loadStream('masteries')) {
      if (!typeIds.has(record.key)) {
        continue
      }

      const stripped = applyStripFields(record.value, {
        keepLanguages,
        fallbackLanguage,
      })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()
  },
})
