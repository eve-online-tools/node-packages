import { defineConfig } from '@eve-online-tools/eve-sde/vite'
import { mapDataset } from '@eve-online-tools/eve-map/sde'

export default defineConfig({
  datasets: [mapDataset()],
  dts: 'src/eve-sde.d.ts',
})
