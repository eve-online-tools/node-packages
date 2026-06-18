# @eve-online-tools/eve-resfile

Load EVE Online client assets via `res:/` imports in Vite and Rollup projects.

The EVE client stores game assets behind a resfile index: a mapping from in-game resource paths (like `res:/icons/64/icon64.png`) to CDN paths. This package downloads and caches that index, then provides bundler plugins that resolve `res:/` imports to either:

- **Dev:** a local proxy URL (`/__eve_res__/...`) that fetches assets on demand
- **Production:** emitted static assets fetched from the EVE CDN at build time

## Installation

```bash
pnpm add -D @eve-online-tools/eve-resfile
```

## Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { eveResfile } from "@eve-online-tools/eve-resfile/vite";

export default defineConfig({
  plugins: [eveResfile()],
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

## Rollup

```ts
// rollup.config.ts
import { eveResfile } from "@eve-online-tools/eve-resfile/rollup";

export default {
  input: "src/main.ts",
  plugins: [eveResfile()],
};
```

Rollup resolves `cacheDir` relative to `root` (default: `process.cwd()`). Pass `root` explicitly if your config runs from another directory.

## Options

```ts
eveResfile({
  /** Pin to a specific client build; omit to use the latest TQ build */
  buildNumber: 1234567,
  /** Cache directory (default: .cache/eve-resfile) */
  cacheDir: ".cache/eve-resfile",
  /** Project root for resolving cacheDir (Rollup only) */
  root: process.cwd(),
});
```

## Core API

The main entry exports helpers for working with the resfile index outside of a bundler:

```ts
import { loadResfileIndexData, lookupCdnPath, normalizeResPath } from "@eve-online-tools/eve-resfile";

const index = await loadResfileIndexData({
  cacheDir: "/tmp/eve-resfile",
});

const cdnPath = lookupCdnPath(index.resPathToCdnPath, normalizeResPath("res:/icons/64/icon64.png"));
```

## Caching

On first run the plugin:

1. Fetches the current client build number, unless `buildNumber` is set
2. Downloads the build index and locates the resfile index
3. Downloads the resfile index and writes a parsed JSON map to cache

Subsequent runs reuse cached files under `.cache/eve-resfile/<buildNumber>/`. Add this directory to `.gitignore`.

## Exports

| Import | Description |
| --- | --- |
| `@eve-online-tools/eve-resfile` | Core index loader and parsing utilities |
| `@eve-online-tools/eve-resfile/vite` | Vite plugin |
| `@eve-online-tools/eve-resfile/rollup` | Rollup plugin |
| `@eve-online-tools/eve-resfile/client` | TypeScript types for `res:/` imports |

## License

MIT
