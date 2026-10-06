import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'rollup'
import { createReactRollupConfig } from '../../internal/react-build/create-rollup-config'
import { copyGeneratedDataPlugin, staticDataFilesProcessor } from './src/data/processors/copy-generated-data'
import { staticExtraProcessor } from './src/data/processors/static-extra-data'
import { factionsProcessor } from './src/data/processors/factions'
import { cloneGradesProcessor } from './src/data/processors/cloneGrades'
import { certificatesProcessor } from './src/data/processors/certificates'
import { groupsProcessor } from './src/data/processors/groups'
import { masteriesProcessor } from './src/data/processors/masteries'
import { shipTreeElementsProcessor } from './src/data/processors/shipTreeElements'
import { shipTreeFactionIdentifiersProcessor } from './src/data/processors/shipTreeFactionIdentifiers'
import { shipTreeFactionsProcessor } from './src/data/processors/shipTreeFactions'
import { shipTreeGroupIdentifiersProcessor } from './src/data/processors/shipTreeGroupIdentifiers'
import { shipTreeGroupsProcessor } from './src/data/processors/shipTreeGroups'
import { dogmaAttributeIdentifiersProcessor } from './src/data/processors/dogmaAttributeIdentifiers'
import { typeBonusProcessor } from './src/data/processors/typeBonus'
import { typeElementsProcessor } from './src/data/processors/typeElements'
import { shipSizesProcessor } from './src/data/processors/shipSizes'
import { skillsProcessor } from './src/data/processors/skills'
import { shipTypeRequirementsProcessor } from './src/data/processors/shipTypeRequirements'
import { typesProcessor } from './src/data/processors/types'

const fontPackageDir = path.dirname(
  createRequire(import.meta.url).resolve('@fontsource/saira-semi-condensed/package.json'),
)

// postcss-import inlines the fontsource CSS but leaves its relative url(files/...) untouched.
const fontAssetsPlugin = (outDir: string): Plugin => ({
  name: 'font-assets',
  writeBundle() {
    const assetsDir = path.join(outDir, 'dist/assets')
    mkdirSync(assetsDir, { recursive: true })
    for (const fileName of readdirSync(path.join(fontPackageDir, 'files'))) {
      if (/^saira-semi-condensed-latin-(400|700)-normal\.woff2?$/.test(fileName)) {
        copyFileSync(path.join(fontPackageDir, 'files', fileName), path.join(assetsDir, fileName))
      }
    }
  },
  closeBundle() {
    for (const cssPath of ['dist/esm/index.css', 'dist/cjs/index.css'].map((p) => path.join(outDir, p))) {
      if (existsSync(cssPath)) {
        writeFileSync(cssPath, readFileSync(cssPath, 'utf-8').replaceAll('url(files/', 'url(../assets/'))
      }
    }
  },
})

const SDE_BUILD_NUMBER = '3579973'

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const keepLanguages = ['en']
const fallbackLanguage = 'en'
const stripOptions = { keepLanguages, fallbackLanguage }

export default createReactRollupConfig({
  packageDir,
  cssPrefix: 'est',
  resfile: { root: packageDir, buildNumber: SDE_BUILD_NUMBER },
  sde: {
    buildNumber: SDE_BUILD_NUMBER,
    outputDir: 'src/data',
    root: packageDir,
    processors: [
      cloneGradesProcessor(stripOptions),
      groupsProcessor(stripOptions),
      typesProcessor(stripOptions),
      shipTypeRequirementsProcessor(),
      shipSizesProcessor(),
      dogmaAttributeIdentifiersProcessor(),
      masteriesProcessor(stripOptions),
      certificatesProcessor(stripOptions),
      shipTreeFactionsProcessor(stripOptions),
      shipTreeElementsProcessor(stripOptions),
      shipTreeGroupsProcessor(stripOptions),
      shipTreeGroupIdentifiersProcessor(),
      typeBonusProcessor(stripOptions),
      typeElementsProcessor(stripOptions),
      skillsProcessor(stripOptions),
      factionsProcessor(stripOptions),
      shipTreeFactionIdentifiersProcessor(),
      staticExtraProcessor(),
      staticDataFilesProcessor(),
    ],
  },
  plugins: [copyGeneratedDataPlugin(packageDir), fontAssetsPlugin(packageDir)],
})
