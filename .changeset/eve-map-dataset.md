---
'@eve-online-tools/eve-map': minor
---

Breaking: `mapDataProcessor()` is replaced by `mapDataset()` for eve-sde 1.0. Import the result as `eve-sde:dataset/eve-map:map-data` to get `{ url, systems }`. The `format` and `fileName` options are removed; the binary format is the only output.
