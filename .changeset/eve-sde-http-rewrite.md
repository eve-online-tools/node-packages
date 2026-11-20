---
'@eve-online-tools/eve-sde': major
---

Rewrite on top of the SDE HTTP API (`sde.evetech.net`). The zip pipeline, processors and `_key`/`_value` helpers are removed.

- Typed `sde.table(name).get / getOrThrow / getMany / list` over composable sources: `remote()` (per record or bulk FlatBuffers), `embedded()`, `fixture()` and, from `/node`, `files()`.
- Row types generated from the SDE record schemas; `eve-sde types` generates types for a project's locked release.
- FlatBuffers reader with key lookup and field projection, without dependencies.
- `eve-sde.lock.json` pins a release and verified blob hashes; `eve-sde update | check | fetch | build | types`.
- `defineDataset()` replaces processors: declared input tables, fingerprints per table version, values, emitted files and written files.
- Vite and Rollup plugins configure the shared `sde` instance per environment (`embed`, `files`, `record`, `bulk`) and expose `eve-sde:dataset/<id>` modules.
- Lazy release checks with `change` and `stale` events, `scope()` with `dehydrate()` / `hydrate()` for SSR, React hooks and TanStack Query bindings.
- ESM only.
