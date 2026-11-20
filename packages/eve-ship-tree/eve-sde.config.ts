import { defineConfig } from '@eve-online-tools/eve-sde/node'

import { sourceDatasets } from './src/data/datasets'

export default defineConfig({
  datasets: sourceDatasets,
})
