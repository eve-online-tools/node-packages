import { applyStripFields, writeSdeRecord, type SdeProcessor } from '@eve-online-tools/eve-sde'

import { collectGeneratedKeys } from './utils/collect-generated-keys'
import {
  generateBarrelExportModule,
  generateResfileCssModule,
  generateResfileMapModule,
  normalizeResPath,
} from './utils'

const typesJsonlPath = 'generated/types.jsonl'
const iconsDir = 'icons/types'

type TypeRecord = {
  groupID?: number
  graphicID?: number
}

type GraphicRecord = {
  iconFolder?: string
  sofHullName?: string
}

const holoIconPath = (graphic: GraphicRecord): string =>
  normalizeResPath(`${graphic.iconFolder}/${graphic.sofHullName}_isis.png`)

export const typesProcessor = ({
  keepLanguages,
  fallbackLanguage,
}: {
  keepLanguages: string[]
  fallbackLanguage: string
}): SdeProcessor => ({
  id: 'types',
  version: [...keepLanguages].sort().join(','),
  run: async ({ generatedStream, loadStream, streamJson, writeText }) => {
    const groupIds = await collectGeneratedKeys(generatedStream, 'groups')
    const graphics = new Map<number, GraphicRecord>()

    for await (const record of loadStream('graphics')) {
      const graphic = record.value as GraphicRecord

      if (typeof graphic.iconFolder === 'string' && typeof graphic.sofHullName === 'string') {
        graphics.set(record.key as number, graphic)
      }
    }

    const out = await streamJson(typesJsonlPath)
    const holoIconEntries: Array<{ key: number; resPath: string }> = []

    for await (const record of loadStream('types')) {
      const type = record.value as TypeRecord

      if (type.groupID === undefined || !groupIds.has(type.groupID)) {
        continue
      }

      if (type.graphicID !== undefined) {
        const graphic = graphics.get(type.graphicID)

        if (graphic !== undefined) {
          holoIconEntries.push({
            key: record.key as number,
            resPath: holoIconPath(graphic),
          })
        }
      }

      const stripped = applyStripFields(record.value, {
        keepLanguages,
        fallbackLanguage,
        fields: ['soundID', 'mass', 'portionSize', 'radius', 'volume', 'basePrice', 'capacity', 'marketGroupID'],
      })
      await writeSdeRecord(out, record, stripped)
    }

    await out.close()

    await writeText(
      `${iconsDir}/holoIcon.ts`,
      generateResfileMapModule([
        {
          exportName: 'holoIcon',
          exportDefault: true,
          entries: holoIconEntries,
        },
      ]),
    )

    await writeText(
      `${iconsDir}/holoIcon.css`,
      generateResfileCssModule({
        dataAttribute: 'type-id',
        prefix: 'types',
        maps: [{ exportName: 'holoIcon', entries: holoIconEntries }],
      }),
    )

    await writeText(`${iconsDir}/index.ts`, generateBarrelExportModule(['holoIcon']))
  },
})
