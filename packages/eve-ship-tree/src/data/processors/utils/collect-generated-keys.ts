import type { SdeProcessorContext } from '@eve-online-tools/eve-sde'

export const collectGeneratedKeys = async (
  generatedStream: SdeProcessorContext['generatedStream'],
  processorId: string,
): Promise<Set<number | string>> => {
  const keys = new Set<number | string>()

  for await (const row of generatedStream(processorId)) {
    const record = row as { _key?: number | string }

    if (record._key !== undefined) {
      keys.add(record._key)
    }
  }

  return keys
}
