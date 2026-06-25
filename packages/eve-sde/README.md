# @eve-online-tools/eve-sde

Download and process the EVE Online Static Data Export (SDE) at build time.

The SDE contains large game data tables that only change with game updates. This package lets you select specific tables or run custom processors, then write smaller generated files to disk for normal imports in your app.

## Installation

```bash
pnpm add -D @eve-online-tools/eve-sde
```

## Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import { sde } from '@eve-online-tools/eve-sde/vite'

export default defineConfig({
  plugins: [
    sde({
      outputDir: 'src/generated/sde',
      tables: ['types', 'groups'],
      processors: [
        {
          id: 'type-name-index',
          version: '1',
          run: async ({ load, writeJson }) => {
            const types = (await load('types')) as Record<string, { name: { en: string } }>
            const names = Object.fromEntries(
              Object.entries(types).map(([id, row]) => [id, row.name.en]),
            )
            await writeJson('type-names.json', names)
            return Object.keys(names)
          },
        },
        {
          id: 'filtered-type-names',
          version: '1',
          run: async ({ generated, writeJson }) => {
            const typeIds = generated('type-name-index') as string[]
            await writeJson('filtered-type-ids.json', typeIds.filter((id) => id === '1'))
          },
        },
      ],
    }),
  ],
})
```

## Rollup

```ts
// rollup.config.ts
import { sde } from '@eve-online-tools/eve-sde/rollup'

export default {
  input: 'src/main.ts',
  plugins: [
    sde({
      outputDir: 'src/generated/sde',
      root: process.cwd(),
      tables: ['types'],
    }),
  ],
}
```

Rollup resolves `outputDir` and `cacheDir` against `root` on the first `buildStart` hook. **Pass `root` explicitly** when those paths are relative — unlike Vite, Rollup does not supply a project root automatically.

## Options

```ts
sde({
  /** Required: generated artifacts directory */
  outputDir: 'src/generated/sde',
  /** Pin SDE build; omit to fetch latest */
  buildNumber: 3400955,
  /** Cache directory (default: .cache/eve-sde) */
  cacheDir: '.cache/eve-sde',
  /** Project root for resolving paths (Rollup, or explicit override) */
  root: process.cwd(),
  /** Bare table names to dump as parsed JSON */
  tables: ['types', 'groups'],
  /** Custom processing steps */
  processors: [{ id: 'my-processor', version: '1', run: async (ctx) => {} }],
  /** Bypass fingerprint check */
  force: true,
  /** [Optional] JSON.stringify spacing for dumps; omit for compact output */
  jsonSpace: number
})
```

Table names are **bare names without extension** — use `types`, not `types.jsonl`.

## Loading tables

| API | Memory | Use when |
| --- | --- | --- |
| `load(table)` | Materializes the full parsed table | Small tables, dev fixtures, or when you need random access to every row |
| `loadStream(table)` | One record at a time | Large tables (`types`, `dogmaAttributes`, …) or any table that may grow with SDE updates |

`load` reads the entire `.jsonl` file, parses every line, and caches the resulting object in memory (and on disk under `parsed/`). Multiple processors calling `load('types')` in the same run share one in-memory copy, but the first call still materializes the full table.

Prefer `loadStream` when row counts or heap usage matter. Built-in `stripFields` already streams via `loadStream`.

## Processors

Processors run in config order. Each processor must include a `version` string — bump it whenever `run` logic changes so the lock fingerprint invalidates and artifacts rebuild.

A processor can **return** data for later processors to read via `generated(id)`:

```ts
processors: [
  {
    id: 'ship-type-ids',
    version: '1',
    run: async ({ load }) => {
      const types = await load('types')
      return pickShipTypeIds(types)
    },
  },
  {
    id: 'type-names',
    version: '1',
    run: async ({ load, generated, writeJson }) => {
      const shipTypeIds = generated('ship-type-ids') as number[]
      const types = await load('types')
      await writeJson('type-names.json', toNameMap(types, shipTypeIds))
    },
  },
]
```

`generated(name)` uses the processor `id`. Only processors that have already run are available. If a processor only wrote streamed files, use `generatedStream(name)` instead.

### Streaming

For large tables, use `loadStream(tableName)` to iterate SDE records one line at a time:

```ts
for await (const record of loadStream('mapMoons')) {
  // record.key, record.value, record.kind ('object' | 'value')
}
```

Write large output incrementally with `streamJson` and `streamText`:

```ts
const out = await streamJson('ships.json')
for await (const record of loadStream('types')) {
  await out.write(toShip(record))
}
await out.close()
```

**Two streaming formats:**

| API | Line shape | Read with |
| --- | --- | --- |
| `streamJson` | Generic NDJSON — one arbitrary JSON value per line | `generatedStream` (uses `JSON.parse` per line) |
| `writeSdeRecord` + `streamJson` | SDE JSONL — `{ _key, ...fields }` or `{ _key, _value }` per line | `parseJsonlTable` / `parseJsonlLine` from `/processors` |

`streamJson` writes `JSON.stringify(value)\n` for each `write()` call. Built-in `stripFields` uses `writeSdeRecord` so its output stays SDE-shaped. If you need SDE JSONL from a custom processor, import `writeSdeRecord` from the main entry (or format rows yourself with `_key`).

`generatedStream` reads generic NDJSON — do not assume every line has `_key` unless the upstream processor wrote SDE-shaped rows.

Later processors can read streamed output with `generatedStream('processor-id')`, or pass an explicit filename as the second argument.

### Built-in processors

#### `stripFields(tableName, options)`

Streams a table, optionally deletes fields, filters rows by key, strips translation dicts, and writes `${tableName}.jsonl`.

Processor id: `strip-fields:<tableName>` (e.g. `strip-fields:types`). Custom processor ids must **not** match bare SDE table names used with `stripFields` — use distinct pipeline names like `type-names` instead.

| Option | Behavior |
| --- | --- |
| `fields` | Delete fields at dot paths (e.g. `icon`, `nested.field`). Only runs when set. |
| `languages` | Remove these locale keys from all translation dicts in the row. |
| `keepLanguages` | Keep only these locale keys. Missing kept locales are filled from `fallbackLanguage`. |
| `fallbackLanguage` | Required when `keepLanguages` is set. |
| `keys` | Skip rows whose `_key` is in this set. |
| `keepKeys` | Emit only rows whose `_key` is in this set. |

A translation dict is detected when a plain object has an `en` key and all values are strings. Plain-string fields (like `translationLanguages.name`) are left unchanged. Language stripping applies to all translation dicts in each row via deep recursion.

`languages` and `keepLanguages` are mutually exclusive, as are `keys` and `keepKeys`.

```ts
import { sde } from '@eve-online-tools/eve-sde/vite'
import { stripFields } from '@eve-online-tools/eve-sde'

export default defineConfig({
  plugins: [
    sde({
      outputDir: 'src/generated/sde',
      processors: [
        stripFields('types', { keepLanguages: ['en'], fallbackLanguage: 'en' }),
        stripFields('shipTreeGroups', {
          fields: ['icon', 'iconLarge'],
          keepLanguages: ['en'],
          fallbackLanguage: 'en',
        }),
        stripFields('factions', {
          keepKeys: [500001, 500002],
          keepLanguages: ['en'],
          fallbackLanguage: 'en',
        }),
      ],
    }),
  ],
})
```

Use `applyStripFields(value, options)` from the main entry to apply the same transforms inside custom processors.

## Runtime JSONL parsing

For loading generated JSONL at runtime (outside the build plugin), use the slim `/processors` entry:

```ts
import { parseJsonlTable } from '@eve-online-tools/eve-sde/processors'

const table = parseJsonlTable(await readFile('data/types.jsonl', 'utf8'))
```

`parseJsonlTable` is also exported from the main entry, but `/processors` avoids pulling in plugin code.

## Core API

Use the main entry outside of a bundler:

```ts
import { processSde } from '@eve-online-tools/eve-sde'

await processSde({
  outputDir: 'src/generated/sde',
  tables: ['types'],
})
```

## Caching and fingerprints

On first run the plugin:

1. Resolves the SDE build number (latest or pinned)
2. Downloads the JSONL archive to `.cache/eve-sde/<buildNumber>/archive.zip`
3. Extracts and parses only the requested tables
4. Writes generated files to `outputDir`
5. Writes `.sde-lock.json` in `outputDir`

Subsequent runs skip processing when the lock file matches the current config and build number. Use `force: true` to regenerate. When a build is skipped, bump a processor `version` or use `force: true` if you changed processor logic.

The lock fingerprint includes:

- `lockSchemaVersion`
- `buildNumber`
- `tables` as `{ name, outputFile }` pairs
- `jsonSpace` (`null` for compact output)
- `processors` as `{ id, version }` pairs

`generatedAt` is recorded for audit only and is **not** part of the fingerprint — changing it alone does not trigger a rebuild.

Parsed table cache paths include the formatting key (`compact` or `s2`, etc.) so `jsonSpace` changes do not reuse stale parsed blobs.

Add `.cache/eve-sde` to `.gitignore`. Decide whether `outputDir` is committed or regenerated in CI.

### Troubleshooting

If SDE downloads fail or archives look corrupt, delete the cached build directory under `.cache/eve-sde/<buildNumber>/` and retry. Extract failures remove a corrupt `archive.zip` automatically and ask you to rerun the build.

## Development

```bash
pnpm --filter @eve-online-tools/eve-sde test
pnpm --filter @eve-online-tools/eve-sde typecheck
pnpm --filter @eve-online-tools/eve-sde format:check
pnpm --filter @eve-online-tools/eve-sde oxlint
```

See [ARCHITECTURE.md](./ARCHITECTURE.md) for cache layout, lock fingerprints, and plugin lifecycle.

## Exports

| Import | Use in | Description |
| --- | --- | --- |
| `@eve-online-tools/eve-sde` | Build scripts, Node tooling | `processSde`, plugins, built-in processors, convenience re-exports |
| `@eve-online-tools/eve-sde/processors` | App runtime | Slim JSONL parsing (`parseJsonlTable`, `parseJsonlLine`, `writeSdeRecord`) |
| `@eve-online-tools/eve-sde/vite` | `vite.config.ts` | Vite plugin — resolves paths against `config.root` |
| `@eve-online-tools/eve-sde/rollup` | `rollup.config.ts` | Rollup plugin — pass `root` for relative paths |

The main entry re-exports JSONL helpers for convenience. Runtime code that only parses JSONL should import from `/processors` to avoid pulling in plugin code.

## License

MIT
