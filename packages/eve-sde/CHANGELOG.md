# @eve-online-tools/eve-sde

## 1.0.0

### Major Changes

- [#98](https://github.com/eve-online-tools/node-packages/pull/98)
  [`dc29bf0`](https://github.com/eve-online-tools/node-packages/commit/dc29bf0baae6e841eff3235b7e68c6c7e532d11c) -
  Rewrite on top of the SDE HTTP API (`sde.evetech.net`). The zip pipeline, processors and `_key`/`_value` helpers are
  removed.

  - Typed `sde.table(name).get / getOrThrow / getMany / list` over composable sources: `remote()` (per record or bulk
    FlatBuffers), `embedded()`, `fixture()` and, from `/node`, `files()`.
  - Row types generated from the SDE record schemas; `eve-sde types` generates types for a project's locked release.
  - `eve-sde.lock.json` pins a release and verified blob hashes; `eve-sde update | check | fetch | build | types`.
  - `defineDataset()` replaces processors: declared input tables, fingerprints per table version, values, emitted files
    and written files; `buildDataset()` from `/node` runs one in tests.
  - Vite and Rollup plugins configure the shared `sde` instance per environment (`embed`, `files`, `record`, `bulk`) and
    expose `eve-sde:dataset/<id>` modules.
  - Lazy release checks with `change` and `stale` events, `scope()` with `dehydrate()` / `hydrate()` for SSR, React
    hooks and TanStack Query bindings.
  - ESM only.

## 0.1.0

### Minor Changes

- [#12](https://github.com/eve-online-tools/node-packages/pull/12)
  [`0705419`](https://github.com/eve-online-tools/node-packages/commit/0705419a24545057d4c70a420ce3ced023bc8480) -
  chore: first release of eve-sde
