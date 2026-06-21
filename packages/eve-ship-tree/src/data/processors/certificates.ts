import {
  applyStripFields,
  writeSdeRecord,
  type SdeProcessor,
  type SdeProcessorContext,
} from '@eve-online-tools/eve-sde'

const certificatesJsonlPath = 'generated/certificates.jsonl'

type MasteryRecord = {
  _value?: Array<{ _value?: number[] }>
}

const collectMasteryCertificateIds = async (
  generatedStream: SdeProcessorContext['generatedStream'],
): Promise<Set<number>> => {
  const certificateIds = new Set<number>()

  for await (const row of generatedStream('masteries')) {
    const mastery = row as MasteryRecord

    for (const entry of mastery._value ?? []) {
      if (!Array.isArray(entry._value)) {
        continue
      }

      for (const certificateId of entry._value) {
        certificateIds.add(certificateId)
      }
    }
  }

  return certificateIds
}

export const certificatesProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'certificates',
  version: [...keepLanguages].sort().join(','),
  run: async ({ generatedStream, loadStream, streamJson }) => {
    const certificateIds = await collectMasteryCertificateIds(generatedStream)
    const out = await streamJson(certificatesJsonlPath)

    for await (const record of loadStream('certificates')) {
      if (!certificateIds.has(record.key as number)) {
        continue
      }

      const stripped = applyStripFields(record.value, {
        keepLanguages,
        fallbackLanguage,
        fields: ['recommendedFor'],
      })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()
  },
})
