# @eve-online-tools/eve-resfile

Load EVE Online client assets via `res:/` imports in Vite and Rollup projects.

The EVE client stores game assets behind a resfile index: a mapping from in-game resource paths (like `res:/icons/64/icon64.png`) to CDN paths. This package downloads and caches that index, then provides bundler plugins that resolve `res:/` imports to either:

- **Dev:** a local proxy URL (`/__eve_res__/...`) that fetches assets on demand
- **Production:** emitted static assets fetched from the EVE CDN at build time

See [ARCHITECTURE.md](./ARCHITECTURE.md) for layer diagrams, dev vs prod flows, and where to patch each concern.

## Installation

```bash
pnpm add -D @eve-online-tools/eve-resfile
```

Peer dependencies are optional and scoped to the entry you use:

| Entry | Peer dependency |
| --- | --- |
| `@eve-online-tools/eve-resfile/vite` | `vite` |
| `@eve-online-tools/eve-resfile/rollup` | `rollup` |
| `@eve-online-tools/eve-resfile/postcss` | `postcss` (also a direct dependency of this package) |

## Shared integration handle

Create the integration once from `@eve-online-tools/eve-resfile/integration`, then pass it to each bundler adapter you need:

```ts
import { createEveResfileIntegration } from "@eve-online-tools/eve-resfile/integration";
import { vitePlugin } from "@eve-online-tools/eve-resfile/vite";
import { postcssPlugin } from "@eve-online-tools/eve-resfile/postcss";

const resfile = createEveResfileIntegration();

export default defineConfig({
  plugins: [vitePlugin(resfile)],
  css: {
    postcss: {
      plugins: [postcssPlugin(resfile, { target: "dev-proxy" })],
    },
  },
});
```

Import only the entries you need — a Vite-only project never has to import `/rollup`.

## Quick start (Vite + CSS)

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { createEveResfileIntegration } from "@eve-online-tools/eve-resfile/integration";
import { vitePlugin } from "@eve-online-tools/eve-resfile/vite";
import { postcssPlugin } from "@eve-online-tools/eve-resfile/postcss";

const resfile = createEveResfileIntegration();

export default defineConfig({
  plugins: [vitePlugin(resfile)],
  css: {
    postcss: {
      plugins: [postcssPlugin(resfile, { target: "dev-proxy" })],
    },
  },
});
```

Add client types so TypeScript understands `res:/` imports:

```ts
// src/vite-env.d.ts
/// <reference types="@eve-online-tools/eve-resfile/client" />
```

Use resfile imports in application code:

```ts
import iconUrl from "res:/icons/64/icon64.png";

export function Icon() {
  return <img src={iconUrl} alt="" />;
}
```

In dev, `iconUrl` is a proxy path served by the plugin. In production builds, the asset is downloaded from the CDN and emitted into your bundle output.

### JS-only Vite

If you only import `res:/` paths from JavaScript/TypeScript (no CSS urls), the shorthand is enough:

```ts
import { eveResfile } from "@eve-online-tools/eve-resfile/vite";

export default defineConfig({
  plugins: [eveResfile()],
});
```

## Rollup

For Rollup with extracted CSS (e.g. `rollup-plugin-postcss`), use the integration handle with both Rollup and PostCSS entries:

```ts
import { createEveResfileIntegration } from "@eve-online-tools/eve-resfile/integration";
import { rollupPlugin } from "@eve-online-tools/eve-resfile/rollup";
import { postcssPlugin } from "@eve-online-tools/eve-resfile/postcss";
import postcss from "rollup-plugin-postcss";

const resfile = createEveResfileIntegration({ root: process.cwd() });

export default {
  input: "src/main.ts",
  plugins: [
    rollupPlugin(resfile),
    postcss({
      extract: true,
      plugins: [postcssPlugin(resfile)],
    }),
  ],
  output: [
    { format: "es", dir: "dist/esm" },
    { format: "cjs", dir: "dist/cjs" },
  ],
};
```

### Output layout

Rollup `output.dir` must be a **subdirectory of `distDir`** (default `dist`). The default layout matches `mantine-build`:

```text
dist/
  assets/     ← shared binaries (configurable via assetsDir)
  esm/        ← Rollup ESM output
  cjs/        ← Rollup CJS output
```

Place the Rollup plugin **before** the PostCSS plugin so extracted CSS is finalized before `writeBundle`. The Rollup adapter rewrites sentinel strings in `writeBundle` after other plugins' `renderChunk` hooks — do not place minifiers that mangle sentinel string literals between the resfile plugin and `writeBundle` without verifying output.

Each resfile asset is fetched once and written to **`dist/assets/`** (or your `assetsDir`). CSS and JS references use relative urls such as `../assets/...` from `dist/esm/**` and `dist/cjs/**`. When a package aggregates styles into `dist/styles.css`, post-build rebases those urls to `./assets/...`.

If `output.dir` is outside `distDir` (for example `build/esm`), the plugin throws at `writeBundle` with a clear configuration error.

### JS-only Rollup

```ts
import { eveResfile } from "@eve-online-tools/eve-resfile/rollup";

export default {
  input: "src/main.ts",
  plugins: [eveResfile()],
};
```

`eveResfile()` covers JS `res:/` imports only. If you use CSS `url(res:/…)`, use `rollupPlugin` and `postcssPlugin` with a shared integration handle (see above).

Rollup resolves `cacheDir` relative to `root` (default: `process.cwd()`). Pass `root` explicitly if your config runs from another directory.

### CSS and Sass

Use `url('res:/…')` in CSS or Sass (`.css`, `.scss`, `.module.scss`). Sass `@import` / `@use` of `res:/` paths is not supported.

In dev, CSS urls are rewritten to `/__eve_res__/…` and served by the Vite plugin middleware.

```scss
.icon {
  background-image: url("res:/icons/64/icon64.png");
}
```

## Options

```ts
createEveResfileIntegration({
  /** Pin to a specific client build; omit to use the latest TQ build */
  buildNumber: 1234567,
  /** Cache directory (default: .cache/eve-resfile) */
  cacheDir: ".cache/eve-resfile",
  /** Project root for resolving cacheDir, distDir, assetsDir */
  root: process.cwd(),
  /** Rollup dist root (default: dist) */
  distDir: "dist",
  /** Where production assets are written (default: dist/assets, must be inside distDir) */
  assetsDir: "dist/assets",
  /** CDN host allowlist for indexOrigin and assetOrigin */
  allowedHosts: ["binaries.eveonline.com", "resources.eveonline.com"],
  /** When a res path is missing: "warn-and-empty" (default) or "throw" */
  missingResPath: "warn-and-empty",
  /** Per-request CDN fetch timeout in ms (default: 30000) */
  fetchTimeoutMs: 30_000,
});
```

### Security

`indexOrigin` and `assetOrigin` must use HTTPS and a host in `allowedHosts`. Private and link-local addresses are rejected. This reduces SSRF risk when build options come from CI or user config. For mirrors or test CDNs, pass explicit `allowedHosts` together with custom origins.

### Missing assets

With `missingResPath: "warn-and-empty"` (default), unresolved `res:/` imports emit an empty string module:

```js
export default "";
```

Use `emptyResfileUrl` or `isEmptyResfileUrl()` from the main entry in tests to distinguish intentional empties from plugin failures.

## Core API

The main entry exports helpers for working with the resfile index outside of a bundler:

```ts
import {
  emptyResfileUrl,
  isEmptyResfileUrl,
  loadResfileIndexData,
  lookupCdnPath,
  normalizeResPath,
} from "@eve-online-tools/eve-resfile";

const index = await loadResfileIndexData({
  cacheDir: ".cache/eve-resfile",
});

const cdnPath = lookupCdnPath(index.resPathToCdnPath, normalizeResPath("res:/icons/64/icon64.png"));
```

Omitted options use EVE CDN defaults (`binaries.eveonline.com`, `resources.eveonline.com`). For full control, pass explicit origins or use `resolveEveResfileOptions`:

```ts
import { loadResfileIndexData, resolveEveResfileOptions } from "@eve-online-tools/eve-resfile";

const resolved = resolveEveResfileOptions(
  { buildNumber: 1234567, cacheDir: ".cache/eve-resfile" },
  process.cwd(),
);
const index = await loadResfileIndexData(resolved, process.cwd());
```

## Caching

On first run the plugin:

1. Fetches the current client build number, unless `buildNumber` is set
2. Downloads the build index and locates the resfile index
3. Downloads the resfile index and writes a parsed JSON map to cache

Subsequent runs reuse cached files under `.cache/eve-resfile/<buildNumber>/`. Add this directory to `.gitignore`.

Transient CDN errors (429, 5xx) are retried automatically with exponential backoff. HTTP 404 is not retried.

## Exports

| Import | Description |
| --- | --- |
| `@eve-online-tools/eve-resfile` | Core index loader, `emptyResfileUrl`, `resolveEveResfileOptions` |
| `@eve-online-tools/eve-resfile/integration` | **`createEveResfileIntegration`** (canonical shared handle) |
| `@eve-online-tools/eve-resfile/vite` | `vitePlugin`, `eveResfile` |
| `@eve-online-tools/eve-resfile/rollup` | `rollupPlugin`, `eveResfile` |
| `@eve-online-tools/eve-resfile/postcss` | `createEveResfileIntegration`, `postcssPlugin` |
| `@eve-online-tools/eve-resfile/client` | TypeScript types for `res:/` imports |

## License

MIT
