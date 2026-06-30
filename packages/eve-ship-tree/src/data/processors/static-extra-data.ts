import { readFile } from 'node:fs/promises'

import type { SdeProcessor } from '@eve-online-tools/eve-sde'

import {
  generateBarrelExportModule,
  generateResfileCssModule,
  generateResfileMapModule,
  normalizeResPath,
} from './utils'

const factionsBgSourcePath = 'static/factionsbg.json'
const factionsBgDir = 'icons/factionsbg'
const backgroundModulePath = `${factionsBgDir}/background.ts`
const backgroundCssPath = `${factionsBgDir}/background.css`
const factionsBgIndexPath = `${factionsBgDir}/index.ts`

const factionsLogoSourcePath = 'static/factionslogo.json'
const factionsLogoDir = 'icons/factionslogo'
const logoModulePath = `${factionsLogoDir}/logo.ts`
const logoCssPath = `${factionsLogoDir}/logo.css`
const factionsLogoIndexPath = `${factionsLogoDir}/index.ts`

const parseStaticResfileEntries = (data: Record<string, string>) =>
  Object.entries(data)
    .map(([key, resPath]) => ({
      key: Number(key),
      resPath: normalizeResPath(resPath),
    }))
    .sort((left, right) => left.key - right.key)

export const staticExtraProcessor = (): SdeProcessor => ({
  id: 'staticExtra',
  version: 'factionsbg+factionslogo',
  run: async ({ resolve, writeText }) => {
    const factionsBgContent = await readFile(resolve(factionsBgSourcePath), 'utf8')
    const factionsBgData = JSON.parse(factionsBgContent) as Record<string, string>
    const backgroundEntries = parseStaticResfileEntries(factionsBgData)

    await writeText(
      backgroundModulePath,
      generateResfileMapModule([
        {
          exportName: 'background',
          exportDefault: true,
          entries: backgroundEntries,
        },
      ]),
    )

    await writeText(
      backgroundCssPath,
      generateResfileCssModule({
        dataAttribute: 'faction',
        prefix: 'factionsbg',
        maps: [{ exportName: 'background', entries: backgroundEntries }],
      }),
    )

    await writeText(factionsBgIndexPath, generateBarrelExportModule(['background']))

    const factionsLogoContent = await readFile(resolve(factionsLogoSourcePath), 'utf8')
    const factionsLogoData = JSON.parse(factionsLogoContent) as Record<string, string>
    const logoEntries = parseStaticResfileEntries(factionsLogoData)

    await writeText(
      logoModulePath,
      generateResfileMapModule([
        {
          exportName: 'logo',
          exportDefault: true,
          entries: logoEntries,
        },
      ]),
    )

    await writeText(
      logoCssPath,
      generateResfileCssModule({
        dataAttribute: 'faction',
        prefix: 'factionslogo',
        maps: [{ exportName: 'logo', entries: logoEntries }],
      }),
    )

    await writeText(factionsLogoIndexPath, generateBarrelExportModule(['logo']))
  },
})
