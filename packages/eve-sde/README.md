# @eve-online-tools/eve-sde

Typed access to the EVE Online Static Data Export (SDE) through the [SDE HTTP API](https://sde.evetech.net/tranquility/latest/), with Vite and Rollup plugins that decide per table and environment where rows come from.

```bash
pnpm add @eve-online-tools/eve-sde
```

ESM only. Runs in Node, browsers and edge runtimes with `fetch`. Optional peers: `vite` 6 to 8 or `rollup` 4 for the plugins, `react` 19 for `/react`, `@tanstack/react-query` 5 for `/react-query`.

## Getting started

1. Add `sde()` to the Vite plugins (see [Build plugins](#build-plugins)) and create `eve-sde.config.ts` with `dts: 'src/eve-sde.d.ts'`.
2. Run the dev server or a build. The plugin writes `eve-sde.lock.json` and the `dts` files. Commit all three.
3. Add `.cache/eve-sde` to `.gitignore`, and make sure `tsconfig.json` includes the generated `.d.ts` files.
4. Read rows with `sde.table(name).get(key)`, or the React hooks.
5. Run `eve-sde update` to move to a newer SDE release.

[examples/](./examples) has complete setups: a [Vite SPA](./examples/vite-spa.md), [SSR](./examples/ssr.md), [datasets](./examples/datasets.md), [Node scripts](./examples/node-scripts.md), [frameworks without a plugin](./examples/without-a-plugin.md), [TanStack Query](./examples/react-query.md), [tests](./examples/testing.md) and [migrating from 0.x](./examples/migrating-from-0.x.md).

## Reading data

```ts
import { sde } from '@eve-online-tools/eve-sde'

const rifter = await sde.table('types').get(587) // TypesRow | undefined
const ships = await sde.table('types').getMany([587, 588]) // Map, missing keys left out
const frigate = await sde.table('groups').getOrThrow(25) // throws SdeRowNotFoundError

for await (const group of sde.table('groups').list({ fields: ['groupID', 'name'] })) {
  // Pick<GroupsRow, 'groupID' | 'name'>
}
```

- Keys and rows are typed per table. The key is the table's own field (`typeID`, `groupID`, ...).
- `get` and `getMany` calls made in the same tick are batched and deduplicated, and rows are cached per instance.
- `fields` / `omit` limit which top-level fields are returned.
- `list` downloads the whole table. Prefer `get` / `getMany` or a dataset for large tables in browsers.
- `preload(keys?)` fills the cache. Without keys it loads the whole table in one download, after which missing keys resolve to `undefined` without a request.

`sde` is a shared instance. Without a build plugin it reads every table from the latest release over HTTP. `createSde()` creates independent instances:

```ts
import { createSde, embedded, remote } from '@eve-online-tools/eve-sde'

const local = createSde({
  release: 'latest', // or a release id such as '20261119T110708Z', or a manifest
  sources: [embedded({ races: raceRows }), remote({ get: 'bulk', tables: ['types'] }), remote()],
  updates: 'lazy', // 'watch' | 'off'
  updateIntervalMs: 5 * 60_000,
  fetch: globalThis.fetch,
})

await local.manifest() // release, buildNumber, releaseDate, tables
await local.checkForUpdates() // check now instead of waiting for the next read
```

### Sources

The first source that has a table serves it.

| Source | Reads | Use for |
| --- | --- | --- |
| `remote()` | One request per row (`<table>/<key>.json`), `list` streams JSONL | Sparse lookups |
| `remote({ get: 'bulk' })` | The table's FlatBuffers file, downloaded once per table version | Many lookups in one table |
| `embedded(rows)` | Rows in memory, or a loader returning them | Small tables bundled at build time |
| `files({ lockfile, cacheDir })` (`/node`) | Local FlatBuffers files | Servers, scripts, datasets |
| `fixture(rows)` | Partial rows in memory | Tests |

### Releases and updates

An instance reads one release at a time. Runtime reads check `latest/` at most every 5 minutes, but only when something reads data: no timers unless `updates: 'watch'`.

```ts
sde.on('change', ({ release, tables }) => {}) // runtime tables moved to a new release; their cached rows were dropped
sde.on('stale', ({ release, tables }) => {}) // build-time data is behind the latest release
sde.on('error', ({ error }) => {}) // a background check failed
```

The API keeps the current and previous release. When a request for an expired release returns 404, the instance moves to the latest release and retries.

## Build plugins

```ts
// vite.config.ts
import { sde } from '@eve-online-tools/eve-sde/vite'

export default defineConfig({ plugins: [sde()] })
```

```ts
// eve-sde.config.ts
import { defineConfig } from '@eve-online-tools/eve-sde/vite'

export default defineConfig({
  defaults: { client: 'record', server: 'record' },
  tables: {
    categories: { client: 'embed', server: 'embed' },
    groups: { client: 'embed', server: 'files', onStale: 'remote' },
    types: { client: 'record', server: 'files' },
  },
  datasets: [],
  dts: 'src/eve-sde.d.ts',
  lockfile: 'eve-sde.lock.json', // default
  cacheDir: '.cache/eve-sde', // default
})
```

`sde()` reads `eve-sde.config.{ts,mts,js,mjs}` from the project root; pass `sde({ configFile })` for another location, or the config inline. The plugin configures the shared `sde` instance per Vite environment:

| Mode | Client | Server | |
| --- | --- | --- | --- |
| `embed` | yes | yes | Rows bundled as a lazily imported JSON chunk |
| `files` | no | yes | FlatBuffers files copied next to the server output; the dev server reads the cache |
| `record` | yes | yes | HTTP API per row |
| `bulk` | yes | yes | HTTP API, FlatBuffers file per table |

Defaults can only be `record` or `bulk`; build-time modes are set per table. Tables not listed use the defaults, so every table can be read. Edge runtimes have no file system, so use `record` or `bulk` for their server environment.

`onStale: 'remote'` switches a table to the HTTP API for the rest of the session once its build-time copy falls behind; the default `keep` only emits `stale`.

The Rollup plugin (`@eve-online-tools/eve-sde/rollup`) takes the same options plus `root` and `environment: 'client' | 'server'`.

## Datasets

A dataset derives data from SDE tables at build time.

```ts
import { defineDataset } from '@eve-online-tools/eve-sde'

export const frigateNames = defineDataset({
  id: 'my-app:frigate-names',
  version: '1',
  tables: ['types'],
  build: async ({ table, emit }) => {
    const names: string[] = []
    for await (const type of table('types').list({ fields: ['groupID', 'name'] })) {
      if (type.groupID === 25) {
        names.push(type.name.en)
      }
    }
    return { count: names.length, file: emit('frigates.json', JSON.stringify(names)) }
  },
})
```

```ts
import frigates from 'eve-sde:dataset/my-app:frigate-names'

frigates.count // number
frigates.file // URL of the emitted file
```

- `table` only reads tables listed in `tables`, and `dataset` only reads datasets listed in `dependsOn`.
- A dataset rebuilds when its `version`, the version of an input table or a dependency changes. A new SDE release that leaves its tables untouched reuses the cached result.
- `emit(fileName, data)` adds a file to the build output; the value holds its URL.
- `write(path, data)` writes a file under the dataset's `outDir`, for generated data you commit.
- Prefix ids with your package name. Libraries export datasets for apps to register.

Datasets also run without a bundler: `eve-sde build --out <dir>` writes `<id>.json` and emitted files.

## Lockfile and CLI

`eve-sde.lock.json` pins a release: every table's `version`, which changes only when its data changes, and the sha256 of its FlatBuffers files. Commit it. The plugins create it on the first build.

Downloads use the content-addressed blob URL first and the locked release second, and are checked against the locked hash. Blobs usually outlive the release; when neither is available the build asks you to run `eve-sde update`. Cache `.cache/eve-sde` in CI.

| Command | |
| --- | --- |
| `eve-sde update` | Lock the latest release and list changed build tables |
| `eve-sde check` | Exit with code 1 when the latest release changes build tables |
| `eve-sde fetch [--all]` | Download locked FlatBuffers files into the cache |
| `eve-sde build [--out <dir>]` | Run datasets without a bundler |
| `eve-sde types` | Write row types for the locked release to `dts` |

Every command takes `--root <dir>` for a config outside the current directory.

Build tables are tables with `embed` or `files` and the inputs of datasets.

## Types

Row types ship with the package, generated from the SDE record schemas at publish time. Set `dts` to generate types for your locked release instead: the plugins and `eve-sde types` write `src/eve-sde.d.ts`, which replaces the shipped types through `SdeTypeRegistry`, and `src/eve-sde.datasets.d.ts` with the types of `eve-sde:dataset/*` modules. Dataset types require the config to be a file.

## React

```tsx
import { SdeProvider, useSdeRow, useSdeRows } from '@eve-online-tools/eve-sde/react'

const ShipName = ({ typeId }: { typeId: number }) => <>{useSdeRow('types', typeId)?.name.en}</>
```

Hooks suspend until rows are loaded and re-render on `change`. Without a provider they use the shared `sde`. Rows that are already cached render without suspending, so preload before rendering to skip the fallback:

```ts
await Promise.all([sde.table('groups').preload(), sde.table('types').preload([587, 588])])
```

With TanStack Query:

```ts
import { connectQueryClient, sdeQueries } from '@eve-online-tools/eve-sde/react-query'

const queries = sdeQueries()
useQuery(queries.row('types', 587))
connectQueryClient(sde, queryClient) // invalidates tables on `change`
```

## Rendering strategies

- **SSR:** render with `sde.scope()` in the provider, send `await dehydrate(scope)` to the client and call `hydrate(sde, state)` before hydrating. The client adopts the server's release and does not refetch those rows.
- **SSG:** reads during prerendering use the locked release through `embed` and `files` tables.
- **ISR:** revalidate on `change` for runtime tables and on `stale` for build-time tables.
- **RSC:** read on the server and pass plain rows to client components.

## Exports

| Import | Contents |
| --- | --- |
| `@eve-online-tools/eve-sde` | `sde`, `createSde`, sources, `defineDataset`, `dehydrate` / `hydrate`, row types |
| `@eve-online-tools/eve-sde/node` | `files`, lockfile, datasets runner, config, CLI commands |
| `@eve-online-tools/eve-sde/vite` | Vite plugin, `defineConfig`, `defineDataset` |
| `@eve-online-tools/eve-sde/rollup` | Rollup plugin, `defineConfig`, `defineDataset` |
| `@eve-online-tools/eve-sde/react` | `SdeProvider`, `useSdeRow`, `useSdeRows` |
| `@eve-online-tools/eve-sde/react-query` | `sdeQueries`, `connectQueryClient` |

## Development

```bash
pnpm --filter @eve-online-tools/eve-sde test
pnpm --filter @eve-online-tools/eve-sde test:live # downloads the full SDE, local only
pnpm --filter @eve-online-tools/eve-sde generate:types # also runs in `pnpm release`
```

## License

MIT
