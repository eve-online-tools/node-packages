# Migrating from 0.x

0.x downloaded the SDE zip at build time, ran processors and wrote files into `outputDir`. 1.0 reads the SDE HTTP API
and decides per table where rows come from. There is no compatibility layer.

1. Move plugin options into `eve-sde.config.ts` and call `sde()` without options.
2. Turn each processor into a dataset and register it in `datasets`.
3. Replace imports of files in `outputDir` with `sde.table(...)` reads or `eve-sde:dataset/<id>` imports.
4. Delete `outputDir` and the old lock file, then build once to create `eve-sde.lock.json`.
5. Update `_key` / `_value` handling: rows now carry their key as a named field (`typeID`, `groupID`, ...).

## Options

| 0.x                 | 1.0                                                                     |
| ------------------- | ----------------------------------------------------------------------- |
| `outputDir`         | Dataset `outDir` with `write`, or `emit` for build output               |
| `buildNumber`       | `eve-sde.lock.json`, updated with `eve-sde update`                      |
| `cacheDir`          | `cacheDir`                                                              |
| `root`              | `root` (Rollup only)                                                    |
| `tables: ['types']` | `tables: { types: { client: 'embed' } }`, or no entry to read over HTTP |
| `processors`        | `datasets`                                                              |
| `force`             | Delete `.cache/eve-sde/datasets`                                        |
| `jsonSpace`         | Format in `write` yourself                                              |

## Processors to datasets

```ts
// 0.x
{
  id: 'type-names',
  version: '1',
  run: async ({ load, writeJson }) => {
    const types = await load('types')
    await writeJson('type-names.json', toNameMap(types))
  },
}
```

```ts
// 1.0
defineDataset({
  id: 'my-app:type-names',
  version: '2',
  tables: ['types'],
  build: async ({ table }) => {
    const names: Record<number, string> = {}
    for await (const type of table('types').list({ fields: ['typeID', 'name'] })) {
      names[type.typeID] = type.name.en
    }
    return names
  },
})
```

| 0.x context                             | 1.0 context                                                   |
| --------------------------------------- | ------------------------------------------------------------- |
| `load(table)`, `loadStream(table)`      | `table(name).list()`, `get`, `getMany`                        |
| `generated(id)`, `generatedStream(id)`  | `dataset(dependency)`, with the dependency in `dependsOn`     |
| `writeJson`, `streamJson`, `streamText` | Return a value, `emit(fileName, data)` or `write(path, data)` |
| Implicit table access                   | Tables listed in `tables`                                     |

Tables must be declared so a dataset reruns only when one of its inputs changes.

## Removed exports

`processSde`, `loadSdeTable`, `loadSdeTableStream`, `stripFields`, `parseJsonlLine`, `parseJsonlTable`,
`formatSdeJsonlRecord`, `writeSdeRecord` and the translation helpers are gone. Field projection (`fields`, `omit`)
replaces `stripFields`; language trimming is left to the dataset.
