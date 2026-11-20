import { defineDataset, type DatasetContext } from '@eve-online-tools/eve-sde'

import { shipsDataset } from '../../sde/ships'
import factionsBackgrounds from '../static/factionsbg.json'
import factionsLogos from '../static/factionslogo.json'
import {
  generateBarrelExportModule,
  generateCssImportModule,
  generateResfileCssModule,
  generateResfileMapModule,
  normalizeResPath,
} from './codegen'
import { elementIconPath, factionLogoPath, holoIconPath } from './icon-paths'

type Entry = { key: number; resPath: string }

type IconModule = {
  /** Path without extension under `icons/`; a `.ts` map and a `.css` module are written. */
  path: string
  exportName: string
  exportDefault?: boolean
  dataAttribute: string
  prefix: string
  entries: Entry[]
}

const shipTreeGroupIconFields = ['icon', 'iconLarge', 'iconSmall', 'iconSmallNPC'] as const

const staticEntries = (paths: Record<string, string>): Entry[] =>
  Object.entries(paths).map(([key, resPath]) => ({ key: Number(key), resPath: normalizeResPath(resPath) }))

// Static files have no SDE table version, so their content is part of the dataset version.
const hash = (value: string): string => {
  let result = 0x811c9dc5
  for (let i = 0; i < value.length; i++) {
    result = Math.imul(result ^ value.charCodeAt(i), 0x01000193)
  }
  return (result >>> 0).toString(16)
}

const writeIcons = async (write: DatasetContext<never>['write'], modules: IconModule[]) => {
  for (const { path, exportName, exportDefault, dataAttribute, prefix, entries } of modules) {
    await write(`icons/${path}.ts`, generateResfileMapModule([{ exportName, exportDefault, entries }]))
    await write(
      `icons/${path}.css`,
      generateResfileCssModule({ dataAttribute, prefix, maps: [{ exportName, entries }] }),
    )
  }
  const cssImports = modules.map(({ path }) => `./${path}.css`).sort()
  await write('icons/index.css', generateCssImportModule(cssImports))
}

/** Writes the `res:/` icon maps and CSS variables under `src/data/icons`. */
export const iconsDataset = defineDataset({
  id: 'eve-ship-tree:icons',
  version: `1:${hash(JSON.stringify([factionsBackgrounds, factionsLogos]))}`,
  tables: ['factions', 'graphics', 'shipTreeElements', 'shipTreeFactions', 'shipTreeGroups'],
  dependsOn: [shipsDataset],
  outDir: 'src/data',
  build: async ({ table, dataset, write }) => {
    const shipTreeFactions: Entry[] = []
    for await (const { factionID, icon } of table('shipTreeFactions').list({ fields: ['factionID', 'icon'] })) {
      if (icon.startsWith('res:')) {
        shipTreeFactions.push({ key: factionID, resPath: normalizeResPath(icon) })
      }
    }

    const factionLogos: Entry[] = []
    for (const [factionId, { flatLogo }] of await table('factions').getMany(shipTreeFactions.map(({ key }) => key))) {
      if (flatLogo !== undefined) {
        factionLogos.push({ key: factionId, resPath: factionLogoPath(flatLogo) })
      }
    }

    const elements: Entry[] = []
    for await (const { elementID, icon } of table('shipTreeElements').list({ fields: ['elementID', 'icon'] })) {
      if (icon.length > 0) {
        elements.push({ key: elementID, resPath: elementIconPath(icon) })
      }
    }

    const groups = Object.fromEntries(shipTreeGroupIconFields.map((field) => [field, [] as Entry[]]))
    for await (const group of table('shipTreeGroups').list({ fields: ['groupID', ...shipTreeGroupIconFields] })) {
      for (const field of shipTreeGroupIconFields) {
        if (group[field].startsWith('res:')) {
          groups[field].push({ key: group.groupID, resPath: normalizeResPath(group[field]) })
        }
      }
    }

    const ships = Object.entries(dataset(shipsDataset))
    const graphics = await table('graphics').getMany(ships.flatMap(([, ship]) => ship.graphicID ?? []))
    const holoIcons: Entry[] = []
    for (const [typeId, { graphicID }] of ships) {
      const graphic = graphicID === undefined ? undefined : graphics.get(graphicID)
      if (graphic?.iconFolder !== undefined && graphic.sofHullName !== undefined) {
        holoIcons.push({
          key: Number(typeId),
          resPath: holoIconPath({ iconFolder: graphic.iconFolder, sofHullName: graphic.sofHullName }),
        })
      }
    }

    await writeIcons(write, [
      {
        path: 'factions/flatLogo',
        exportName: 'flatLogo',
        exportDefault: true,
        dataAttribute: 'faction',
        prefix: 'factions',
        entries: factionLogos,
      },
      {
        path: 'factionsbg/background',
        exportName: 'background',
        exportDefault: true,
        dataAttribute: 'faction',
        prefix: 'factionsbg',
        entries: staticEntries(factionsBackgrounds),
      },
      {
        path: 'factionslogo/logo',
        exportName: 'logo',
        exportDefault: true,
        dataAttribute: 'faction',
        prefix: 'factionslogo',
        entries: staticEntries(factionsLogos),
      },
      {
        path: 'shipTreeElements/icons',
        exportName: 'icons',
        exportDefault: true,
        dataAttribute: 'element',
        prefix: 'ship-tree-elements',
        entries: elements,
      },
      {
        path: 'shipTreeFactions/icons',
        exportName: 'icon',
        exportDefault: true,
        dataAttribute: 'faction',
        prefix: 'ship-tree-factions',
        entries: shipTreeFactions,
      },
      ...shipTreeGroupIconFields.map((field) => ({
        path: `shipTreeGroups/${field}`,
        exportName: field,
        dataAttribute: 'group',
        prefix: 'ship-tree-groups',
        entries: groups[field],
      })),
      {
        path: 'types/holoIcon',
        exportName: 'holoIcon',
        exportDefault: true,
        dataAttribute: 'type-id',
        prefix: 'types',
        entries: holoIcons,
      },
    ])

    const barrels: Record<string, string[]> = {
      factions: ['flatLogo'],
      factionsbg: ['background'],
      factionslogo: ['logo'],
      shipTreeElements: ['icons'],
      shipTreeFactions: ['icons'],
      shipTreeGroups: [...shipTreeGroupIconFields],
      types: ['holoIcon'],
    }
    for (const [directory, exports] of Object.entries(barrels)) {
      await write(`icons/${directory}/index.ts`, generateBarrelExportModule(exports))
    }
  },
})
