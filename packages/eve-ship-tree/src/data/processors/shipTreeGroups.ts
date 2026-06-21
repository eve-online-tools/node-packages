import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

import {
  generateBarrelExportModule,
  generateResfileCssModule,
  generateResfileMapModule,
  normalizeResPath,
} from './utils'

const shipTreeGroupsJsonlPath = 'generated/shipTreeGroups.jsonl'
const iconsDir = 'icons/shipTreeGroups'

const iconFields = ['icon', 'iconLarge', 'iconSmall', 'iconSmallNPC'] as const

type IconField = (typeof iconFields)[number]

export const shipTreeGroupsProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'shipTreeGroups',
  version: [...keepLanguages].sort().join(','),
  run: async ({ loadStream, streamJson, writeText }) => {
    const out = await streamJson(shipTreeGroupsJsonlPath)
    const iconEntries = Object.fromEntries(
      iconFields.map((field) => [field, [] as Array<{ key: number; resPath: string }>]),
    ) as Record<IconField, Array<{ key: number; resPath: string }>>

    for await (const record of loadStream('shipTreeGroups')) {
      const group = record.value as Partial<Record<IconField, string>>

      for (const field of iconFields) {
        const value = group[field]

        if (typeof value === 'string' && value.startsWith('res:')) {
          iconEntries[field].push({
            key: record.key as number,
            resPath: normalizeResPath(value),
          })
        }
      }

      const stripped = applyStripFields(record.value, {
        keepLanguages,
        fallbackLanguage,
        fields: ['icon', 'iconLarge', 'iconSmall', 'iconSmallNPC'],
      })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()

    for (const field of iconFields) {
      await writeText(
        `${iconsDir}/${field}.ts`,
        generateResfileMapModule([{ exportName: field, entries: iconEntries[field] }]),
      )

      await writeText(
        `${iconsDir}/${field}.css`,
        generateResfileCssModule({
          dataAttribute: 'group',
          prefix: 'ship-tree-groups',
          maps: [{ exportName: field, entries: iconEntries[field] }],
        }),
      )
    }

    await writeText(`${iconsDir}/index.ts`, generateBarrelExportModule([...iconFields]))
  },
})
