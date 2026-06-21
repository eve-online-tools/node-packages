import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMantineRollupConfig } from '../../internal/mantine-build/create-rollup-config'
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
import { shipTypeRequirementsProcessor } from './src/data/processors/shipTypeRequirements'
import { typesProcessor } from './src/data/processors/types'

const SDE_BUILD_NUMBER = '3409592'

const packageDir = path.dirname(fileURLToPath(import.meta.url))
const keepLanguages = ['en']
const fallbackLanguage = 'en'
const stripOptions = { keepLanguages, fallbackLanguage }

export default createMantineRollupConfig({
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
      factionsProcessor(stripOptions),
      shipTreeFactionIdentifiersProcessor(),
      staticExtraProcessor(),
      staticDataFilesProcessor(),
    ],
  },
  plugins: [copyGeneratedDataPlugin(packageDir)],
})
