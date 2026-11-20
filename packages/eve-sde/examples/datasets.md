# Datasets

A dataset derives data from SDE tables at build time: a lookup map, a binary file, generated source you commit. It
reruns only when its inputs change.

## In an app

```ts
// src/sde/ship-names.ts
import { defineDataset } from '@eve-online-tools/eve-sde'

const shipCategoryId = 6

export const shipNames = defineDataset({
  id: 'my-app:ship-names',
  version: '1',
  tables: ['groups', 'types'],
  build: async ({ table, release }) => {
    const shipGroups = new Set<number>()
    for await (const group of table('groups').list({ fields: ['groupID', 'categoryID'] })) {
      if (group.categoryID === shipCategoryId) {
        shipGroups.add(group.groupID)
      }
    }

    const names: Record<number, string> = {}
    for await (const type of table('types').list({ fields: ['typeID', 'groupID', 'name', 'published'] })) {
      if (type.published && shipGroups.has(type.groupID)) {
        names[type.typeID] = type.name.en
      }
    }
    return { buildNumber: release.buildNumber, names }
  },
})
```

```ts
// eve-sde.config.ts
import { defineConfig } from '@eve-online-tools/eve-sde/vite'
import { shipNames } from './src/sde/ship-names'

export default defineConfig({
  datasets: [shipNames],
  dts: 'src/eve-sde.d.ts',
})
```

```ts
import ships from 'eve-sde:dataset/my-app:ship-names'

ships.names[587] // string
```

The value is bundled as JSON. Its type comes from `src/eve-sde.datasets.d.ts`, which the plugin writes next to `dts`
when Vite starts. A build script that runs `tsc` before Vite, such as the `tsc -b && vite build` of Vite's templates,
needs the file first: run `eve-sde types` after adding a dataset, and commit the generated files.

## Emitted files

For data that should load on demand, emit a file and return its URL:

```ts
build: async ({ table, emit }) => {
  const rows = []
  for await (const system of table('mapSolarSystems').list({ fields: ['solarSystemID', 'position'] })) {
    rows.push(system)
  }
  return { url: emit('systems.json', JSON.stringify(rows)) }
}
```

```ts
import systems from 'eve-sde:dataset/my-app:systems'

const rows = await fetch(systems.url).then((response) => response.json())
```

`emit` accepts strings and `Uint8Array`. The file gets a hashed name in the build output; the dev server serves it from
memory.

## Written files

`write` puts files under `outDir`, for generated data that is committed and imported like source:

```ts
defineDataset({
  id: 'my-app:races',
  version: '1',
  tables: ['races'],
  outDir: 'src/generated',
  build: async ({ table, write }) => {
    const races = []
    for await (const race of table('races').list({ fields: ['raceID', 'name'] })) {
      races.push(race)
    }
    await write('races.json', JSON.stringify(races, null, 2))
  },
})
```

## Dependencies

```ts
export const shipCount = defineDataset({
  id: 'my-app:ship-count',
  version: '1',
  tables: [],
  dependsOn: [shipNames],
  build: ({ dataset }) => Object.keys(dataset(shipNames).names).length,
})
```

Datasets run in dependency order; a dependency changing reruns its dependents.

## In a library

Export a function returning the dataset, so apps can pass options and register it:

```ts
// my-library/src/sde.ts
import { defineDataset } from '@eve-online-tools/eve-sde'

export const iconDataset = (options: { size: 32 | 64 }) =>
  defineDataset({
    id: 'my-library:icons',
    version: `1-${options.size}`,
    tables: ['types'],
    build: async ({ table }) => {
      /* ... */
    },
  })
```

```ts
// app eve-sde.config.ts
import { defineConfig } from '@eve-online-tools/eve-sde/vite'
import { iconDataset } from 'my-library/sde'

export default defineConfig({ datasets: [iconDataset({ size: 64 })] })
```

Put options that change the output into `version`, or the cached result of another option set is reused.
`@eve-online-tools/eve-map/sde` follows this pattern with `mapDataset()`.

## Caching

Results are cached in `cacheDir` by fingerprint: dataset `version`, the `build` function's source, the eve-sde version,
the `version` of every input table and the fingerprints of dependencies. A new SDE release that leaves the input tables
unchanged reuses the cached result. Cache `.cache/eve-sde` in CI to skip unchanged datasets.

The fingerprint does not see helpers that `build` calls. Bump `version` when they change, or delete
`.cache/eve-sde/datasets`.

A dataset whose `outDir` already matches its fingerprint skips the build until something imports its value, so
committed output does not need the SDE files on a cold CI cache.

## Without a bundler

```bash
eve-sde build --out dist/sde
```

Writes `my-app_ship-names.json` (the id with `:` replaced by `_`) per dataset plus emitted files.
