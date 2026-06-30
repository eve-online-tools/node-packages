import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

import {
  generateBarrelExportModule,
  generateResfileCssModule,
  generateResfileMapModule,
  normalizeResPath,
} from './utils'

const shipTreeFactionsJsonlPath = 'generated/shipTreeFactions.jsonl'
const iconsModulePath = 'icons/shipTreeFactions/icons.ts'
const iconsCssPath = 'icons/shipTreeFactions/icons.css'
const shipTreeFactionsIndexPath = 'icons/shipTreeFactions/index.ts'

type ShipTreeFactionRecord = {
  icon?: string
}

export const shipTreeFactionsProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'shipTreeFactions',
  version: [...keepLanguages].sort().join(','),
  run: async ({ loadStream, streamJson, writeText }) => {
    const out = await streamJson(shipTreeFactionsJsonlPath)
    const iconEntries: Array<{ key: number; resPath: string }> = []

    for await (const record of loadStream('shipTreeFactions')) {
      const faction = record.value as ShipTreeFactionRecord

      if (typeof faction.icon === 'string' && faction.icon.startsWith('res:')) {
        iconEntries.push({
          key: record.key as number,
          resPath: normalizeResPath(faction.icon),
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
      generateResfileMapModule([{ exportName: 'icon', exportDefault: true, entries: iconEntries }]),
    )

    await writeText(
      iconsCssPath,
      generateResfileCssModule({
        dataAttribute: 'faction',
        prefix: 'ship-tree-factions',
        maps: [{ exportName: 'icon', entries: iconEntries }],
      }),
    )

    await writeText(shipTreeFactionsIndexPath, generateBarrelExportModule(['icons']))
  },
})
