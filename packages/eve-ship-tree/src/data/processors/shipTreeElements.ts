import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

import {
  generateBarrelExportModule,
  generateResfileCssModule,
  generateResfileMapModule,
  normalizeResPath,
} from './utils'

const shipTreeElementsJsonlPath = 'generated/shipTreeElements.jsonl'
const iconsModulePath = 'icons/shipTreeElements/icons.ts'
const iconsCssPath = 'icons/shipTreeElements/icons.css'
const shipTreeElementsIndexPath = 'icons/shipTreeElements/index.ts'

// Glyphs not in category_icons, keyed by SDE icon name.
const elementIconFolders: Record<string, string> = {
  explorer: 'career_icons',
}

export const elementIconPath = (iconName: string): string =>
  normalizeResPath(`res:/ui/texture/eveicon/${elementIconFolders[iconName] ?? 'category_icons'}/${iconName}_32px.png`)

type ShipTreeElementRecord = {
  icon?: string
}

export const shipTreeElementsProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'shipTreeElements',
  version: `2:${[...keepLanguages].sort().join(',')}`,
  run: async ({ loadStream, streamJson, writeText }) => {
    const out = await streamJson(shipTreeElementsJsonlPath)
    const iconEntries: Array<{ key: number; resPath: string }> = []

    for await (const record of loadStream('shipTreeElements')) {
      const element = record.value as ShipTreeElementRecord

      if (typeof element.icon === 'string' && element.icon.length > 0) {
        iconEntries.push({
          key: record.key as number,
          resPath: elementIconPath(element.icon),
        })
      }

      const stripped = applyStripFields(record.value, {
        keepLanguages,
        fallbackLanguage,
        fields: ['icon'],
      })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()

    await writeText(
      iconsModulePath,
      generateResfileMapModule([{ exportName: 'icons', exportDefault: true, entries: iconEntries }]),
    )

    await writeText(
      iconsCssPath,
      generateResfileCssModule({
        dataAttribute: 'element',
        prefix: 'ship-tree-elements',
        maps: [{ exportName: 'icons', entries: iconEntries }],
      }),
    )

    await writeText(shipTreeElementsIndexPath, generateBarrelExportModule(['icons']))
  },
})
