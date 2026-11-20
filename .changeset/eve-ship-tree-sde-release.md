---
'@eve-online-tools/eve-ship-tree': minor
---

Ship tree data is no longer shipped in the package; apps build it with eve-sde 1.0 from their locked SDE release.

Migration: install `@eve-online-tools/eve-sde` 1.x (an optional peer dependency, needed for the data), register `shipTreeDataset()` from `@eve-online-tools/eve-ship-tree/sde` in `eve-sde.config.ts`, import `eve-sde:dataset/eve-ship-tree:data` and pass it as `dataset` (replacing `baseUrl`) to `ShipTree.Root` or `DataProvider`, or to `loadShipTreeData(dataset, options)`. The `./data/generated/*` export and `assertSafeDataBaseUrl` are removed. Preloaded `data` records now use SDE field names (`position`/`elementID`, `factionID`, `skillTypeID`, `typeID`, mastery `levels`) instead of `_key`/`_value`, and the unused `groups` and `factions` tables are gone.
