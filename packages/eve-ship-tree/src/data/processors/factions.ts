import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

import { generateBarrelExportModule, generateResfileCssModule, generateResfileMapModule } from './utils'

const factionsJsonlPath = 'generated/factions.jsonl'
const logoModulePath = 'icons/factions/flatLogo.ts'
const logoCssPath = 'icons/factions/flatLogo.css'
const factionsIndexPath = 'icons/factions/index.ts'

const factionLogoPath = (logoName: string): string => `res:/ui/texture/eveicon/faction_logos/${logoName}_256px.png`

type FactionRecord = {
  flatLogo?: string
}

export const factionsProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'factions',
  version: [...keepLanguages].sort().join(','),
  run: async ({ loadStream, streamJson, writeText }) => {
    const shipTreeFactionIds = new Set<string | number>()

    for await (const record of loadStream('shipTreeFactions')) {
      shipTreeFactionIds.add(record.key)
    }

    const out = await streamJson(factionsJsonlPath)
    const logoEntries: Array<{ key: number; resPath: string }> = []

    for await (const record of loadStream('factions')) {
      if (!shipTreeFactionIds.has(record.key)) {
        continue
      }

      const faction = record.value as FactionRecord

      if (typeof faction.flatLogo === 'string') {
        logoEntries.push({
          key: record.key as number,
          resPath: factionLogoPath(faction.flatLogo),
        })
      }

      const stripped = applyStripFields(record.value, {
        keepLanguages,
        fallbackLanguage,
        fields: [
          'flatLogo',
          'militiaCorporationID',
          'memberRaces',
          'corporationID',
          'flatLogoWithName',
          'solarSystemID',
          'uniqueName',
          'sizeFactor',
        ],
      })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()

    await writeText(
      logoModulePath,
      generateResfileMapModule([{ exportName: 'flatLogo', exportDefault: true, entries: logoEntries }]),
    )

    await writeText(
      logoCssPath,
      generateResfileCssModule({
        dataAttribute: 'faction',
        prefix: 'factions',
        maps: [{ exportName: 'flatLogo', entries: logoEntries }],
      }),
    )

    await writeText(factionsIndexPath, generateBarrelExportModule(['flatLogo']))
  },
})
