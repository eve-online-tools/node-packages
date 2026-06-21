# @eve-online-tools/esi-provider

React provider for typed [ESI](https://developers.eveonline.com/docs/services/esi/) clients via `openapi-fetch` and `openapi-typescript`.

## Installation

```bash
pnpm add @eve-online-tools/esi-provider openapi-fetch openapi-typescript react react-dom
```

## Generating ESI types

The package includes a CLI for maintaining generated ESI artifacts in your project.

### `update-compatibility-date`

Fetches the latest compatibility date from ESI and updates `compatibility-date.ts` only. Does not download the spec or regenerate types.

```bash
npx @eve-online-tools/esi-provider update-compatibility-date -o ./src/esi
```

### `download-spec`

Fetches the OpenAPI spec (using the compatibility date in the output dir), strips global CompatibilityDate/Tenant params, and generates types:

```bash
npx @eve-online-tools/esi-provider download-spec -o ./src/esi
```

Writes or updates:

- `openapi.json` — stripped spec (the provider sets CompatibilityDate/Tenant headers)
- `esi-schema.d.ts` — types generated via `openapi-typescript`
- `compatibility-date.ts` — created automatically if missing
- `index.ts` — created on first run only; includes a `createESIProvider` helper

### `download-spec --update-only`

Updates `compatibility-date.ts` first, then downloads and regenerates the spec only if the compatibility date changed:

```bash
npx @eve-online-tools/esi-provider download-spec -o ./src/esi --update-only
```

### Recommended usage (after `download-spec`)

```tsx
import { createRateLimitMiddleware, useRateLimits } from "@eve-online-tools/esi-provider";
import { createESIProvider } from "./esi";

const rateLimit = createRateLimitMiddleware();

const [ESIProvider, useESIClient] = createESIProvider({
  appName: "my-app",
  appVersion: "1.0.0",
  appContact: "mailto:dev@example.com",
  middleware: [rateLimit],
});
```

`createESIProvider` applies the generated `baseUrl` and `compatibilityDate` automatically. Pass any `NewProviderProps` field to override defaults (for example `tenant` or `middleware`).

### Manual setup

If you manage the schema yourself, use `newESIProvider<paths>(...)` directly:

```tsx
import type { paths } from "./esi-schema";
import { newESIProvider } from "@eve-online-tools/esi-provider";

const [ESIProvider, useESIClient] = newESIProvider<paths>({
  appName: "my-app",
  appVersion: "1.0.0",
  appContact: "mailto:dev@example.com",
});
```

## Usage

```tsx
import { createRateLimitMiddleware, useRateLimits } from "@eve-online-tools/esi-provider";
import { createESIProvider } from "./esi";

const rateLimit = createRateLimitMiddleware();

const [ESIProvider, useESIClient] = createESIProvider({
  appName: "my-app",
  appVersion: "1.0.0",
  appContact: "mailto:dev@example.com",
  middleware: [rateLimit],
});

function App() {
  return (
    <ESIProvider>
      <Dashboard />
    </ESIProvider>
  );
}

function Dashboard() {
  const client = useESIClient();
  const rateLimits = useRateLimits();

  // client.GET("/status/", ...) — typed against your OpenAPI schema
  // rateLimits?.groups — per-group token usage for UI
}
```

### Middleware

Middleware plugs into the provider reducer and openapi-fetch. Each middleware has a unique `key`, `initialState`, `reducer`, and optional `onRequest` / `onResponse` / `onError` handlers.

`createRateLimitMiddleware` learns ESI rate-limit groups from response headers, tracks token usage per group and character, and proactively delays outbound requests when a bucket is low.

## Development

```bash
pnpm --filter @eve-online-tools/esi-provider build
pnpm --filter @eve-online-tools/esi-provider test
pnpm --filter @eve-online-tools/esi-provider typecheck
```

## License

MIT
