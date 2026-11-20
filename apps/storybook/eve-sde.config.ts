import { mapDataset } from '@eve-online-tools/eve-map/sde'
import { shipTreeDataset } from '@eve-online-tools/eve-ship-tree/sde'
import { defineConfig } from '@eve-online-tools/eve-sde/vite'

export default defineConfig({
  datasets: [mapDataset(), shipTreeDataset()],
  dts: 'src/eve-sde.d.ts',
})
