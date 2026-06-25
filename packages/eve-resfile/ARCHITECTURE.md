# Architecture

This document describes how `@eve-online-tools/eve-resfile` is structured and how data flows through the package.

## Layers

```text
┌─────────────────────────────────────────────────────────────┐
│  Bundler adapters (vite/, rollup/, postcss/)                │
│  — resolve imports, dev proxy, emit assets, rewrite CSS    │
├─────────────────────────────────────────────────────────────┤
│  Integration (integration-factory.ts, context.ts)           │
│  — shared ResfileBuildContext, index promise, asset cache    │
├─────────────────────────────────────────────────────────────┤
│  Plugin core (plugin-core.ts, asset-emit.ts, dev-middleware)│
│  — virtual modules, lookups, Rollup sentinel rewriting     │
├─────────────────────────────────────────────────────────────┤
│  Core (index-loader.ts, parse.ts, lookup.ts, cache.ts, fetch)│
│  — CDN index download, parsing, caching, HTTP with retries   │
└─────────────────────────────────────────────────────────────┘
```

Import `@eve-online-tools/eve-resfile/integration` once when a build uses more than one adapter (Vite + PostCSS, Rollup + PostCSS). Pass the returned handle to `vitePlugin`, `rollupPlugin`, and `postcssPlugin` so they share one index load and one asset cache.

The main entry (`@eve-online-tools/eve-resfile`) exposes core utilities for scripts and tooling that do not need a bundler plugin.

## Dev vs production

| Phase | JS `import x from "res:/…"` | CSS `url(res:/…)` |
| --- | --- | --- |
| **Dev (Vite)** | Virtual module → `devProxyUrl` (`/__eve_res__/…`) | PostCSS rewrites to proxy URL; Vite middleware fetches CDN |
| **Prod (Vite)** | Virtual module → `emitFile` asset | PostCSS rewrites to emitted asset path |
| **Prod (Rollup)** | Virtual module → sentinel string → `writeBundle` rewrite | PostCSS placeholder token → `writeBundle` CSS rewrite |

In dev, assets are not copied to disk; the dev server proxies to the EVE CDN on demand.

In production, assets are fetched at build time and written under `assetsDir` (default `dist/assets`). JS and CSS reference them with relative URLs computed from each output chunk’s directory.

## Asset emission strategies

**Vite** uses Rollup’s `emitFile({ type: 'asset' })` inside the plugin `load` hook. The bundler owns file placement.

**Rollup** cannot always emit companion assets during `load` when CSS is extracted by a separate PostCSS plugin. The Rollup adapter therefore:

1. Returns a sentinel string from `load` for JS imports.
2. Fetches and writes binaries in `writeBundle` via `ensureResfileAssetWritten`.
3. Rewrites sentinel strings and CSS placeholder tokens to relative URLs.

Both paths share `ensureResfileAssetWritten` and the `resolvedAssets` map on `ResfileBuildContext`.

### Rollup `writeBundle` coupling

Rollup production output is finalized in `writeBundle` by reading each emitted chunk/CSS file and replacing sentinel strings. This runs **after** other plugins' `renderChunk` hooks but is still sensitive to:

- Plugin hook order (place `rollupPlugin` **before** `rollup-plugin-postcss` so extracted CSS is in the bundle object)
- Minifiers or transforms that alter sentinel string literals (template literals, string splitting)

Vite avoids this by using `emitFile` during `load`. See **Future work** below.

## Future work

Tracked improvements to reduce Rollup fragility:

1. **JS:** migrate Rollup `load` to `this.emitFile` + `import.meta.ROLLUP_FILE_URL_*` (same as the Vite plugin) and remove JS sentinels.
2. **CSS:** resolve placeholders in PostCSS `OnceExit` or Rollup `generateBundle` with emitted asset references instead of filesystem rewrites in `writeBundle`.
3. **Validation:** throw when sentinels survive `writeBundle` rewrite (implemented for JS string-literal sentinels).

## Rollup output layout

Rollup `output.dir` must be a **direct child** of `distDir` (default `dist`), for example `dist/esm` and `dist/cjs`. Assets land in `assetsDir` (default `dist/assets`). The plugin validates this in `writeBundle` and throws a clear error when misconfigured.

```text
package-root/
  dist/
    assets/          ← shared binaries (assetsDir)
    esm/             ← Rollup output.dir
    cjs/             ← Rollup output.dir
```

Configure `distDir` and `assetsDir` when your layout differs; `assetsDir` must stay inside `distDir`.

## Security

`indexOrigin` and `assetOrigin` are validated at option resolution (`resolveEveResfileOptions`):

- HTTPS only (HTTP allowed for `localhost` when listed in `allowedHosts`)
- Host must be in `allowedHosts` (default: EVE production CDN hosts)
- Private and link-local addresses are rejected

This limits SSRF risk when options are influenced by untrusted config. Use `allowedHosts` for mirrors and test CDNs.

## Missing assets (`missingResPath`)

When a `res:/` path is absent from the index (or CDN fetch fails with `warn-and-empty`), JS modules emit `export default ""`. The constant `emptyResfileUrl` and helper `isEmptyResfileUrl()` are exported from the main entry for tests and integrators.

## Where to change what

| Question | Layer / file |
| --- | --- |
| How is the resfile index downloaded and cached? | `index-loader.ts`, `cache.ts`, `parse.ts` |
| How are `res:/` paths normalized? | `lookup.ts` |
| Where is CSS `url(res:/…)` rewritten? | `postcss/plugin.ts` |
| Where is JS `res:/` resolved in Vite? | `vite/plugin.ts` |
| Where are Rollup assets written? | `asset-emit.ts`, `rollup/plugin.ts` `writeBundle` |
| Dev proxy middleware | `dev-middleware.ts`, wired from `vite/plugin.ts` |

## Entry bundle isolation

Each bundler subpath (`/vite`, `/rollup`, `/postcss`) is built as its own tsup entry without code splitting, so importing `/rollup` does not pull in Vite or PostCSS implementation code. Shared logic lives in the core layer; `integration-factory.ts` has no bundler dependencies.
