# @eve-online-tools/esi-provider

React provider for typed [ESI](https://developers.eveonline.com/docs/services/esi/) clients via `openapi-fetch` and `openapi-typescript`.

## Installation

```bash
pnpm add @eve-online-tools/esi-provider openapi-fetch openapi-typescript react react-dom
```

## Package exports

From `@eve-online-tools/esi-provider`:

- `createESIProvider` — factory that returns `[ESIProvider, useESIClient]`
- `createRateLimitMiddleware`, `useRateLimits` — built-in rate-limit middleware
- `useMiddleware`, `useMiddlewareState` — access custom middleware state
- Types: `NewProviderProps`, `CreateProviderResult`, `Middleware`, and related middleware types

## Generating ESI types

The package includes a CLI for maintaining generated ESI artifacts in your project.

### `update-compatibility-date`

Fetches the latest compatibility date from ESI and updates `compatibility-date.ts` only. Does not download the spec or regenerate types.

```bash
npx @eve-online-tools/esi-provider update-compatibility-date -o ./src/esi/generated
```

### `download-spec`

Fetches the OpenAPI spec (using the compatibility date in the output dir), and generates types:

```bash
npx @eve-online-tools/esi-provider download-spec -o ./src/esi/generated
```

Writes or updates:

- `openapi.json` — stripped spec (the provider sets `X-Compatibility-Date` / `X-Tenant` headers)
- `esi-schema.d.ts` — types generated via `openapi-typescript`
- `types.d.ts` — helper types for extracting response bodies from paths and operations
- `compatibility-date.ts` — created automatically if missing
- `index.ts` — created on first run only; includes a `createESIProvider` wrapper pre-bound to `baseUrl` and `compatibilityDate`

### `download-spec --update-only`

Updates `compatibility-date.ts` first, then downloads and regenerates the spec only if the compatibility date changed:

```bash
npx @eve-online-tools/esi-provider download-spec -o ./src/esi/generated --update-only
```

## Usage

After running `download-spec`, wire up a provider module that re-exports the generated factory result:

```tsx
// src/esi/provider.tsx
import { createRateLimitMiddleware } from "@eve-online-tools/esi-provider";
import { createESIProvider } from "./generated";

const rateLimit = createRateLimitMiddleware();

export const [ESIProvider, useESIClient] = createESIProvider({
  appName: "my-app",
  appVersion: "1.0.0",
  appContact: "mailto:dev@example.com",
  middleware: [rateLimit],
});
```

The generated `createESIProvider` wrapper applies `baseUrl` and `compatibilityDate` from your generated files automatically. Pass any `NewProviderProps` field to override defaults (for example `tenant`, `fetch`, or additional `middleware`).

Mount the provider once near the root of your app:

```tsx
import { createRateLimitMiddleware, useRateLimits } from "@eve-online-tools/esi-provider";
import { ESIProvider, useESIClient } from "./esi/provider";

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

### Manual setup

If you manage the schema yourself instead of using the generated wrapper, call `createESIProvider` from the package directly and supply `baseUrl` and `compatibilityDate` yourself:

```tsx
import { createESIProvider } from "@eve-online-tools/esi-provider";
import type { paths } from "./esi/generated/esi-schema";
import compatibilityDate from "./esi/generated/compatibility-date";

export const [ESIProvider, useESIClient] = createESIProvider<paths>({
  baseUrl: "https://esi.evetech.net",
  compatibilityDate,
  appName: "my-app",
  appVersion: "1.0.0",
  appContact: "mailto:dev@example.com",
});
```

### Calling ESI

The generated `types.d.ts` file exports a `ResponseFor` helper to type response bodies:

```tsx
import type { Client, ResponseFor } from "./esi/generated/types";
import { useESIClient } from "./esi/provider";

type StatusResponse = ResponseFor<"/status/", "get", 200>;

export const getServerStatus = async (client: Client) => {
  const { data, error, response } = await client.GET("/status/");

  if (response.status === 200 && data) {
    return data as StatusResponse;
  }

  throw new Error("Failed to get server status", { cause: error });
};

export function StatusPanel() {
  const client = useESIClient();
  // ...
}
```

### Middleware

Middleware plugs into the provider reducer and openapi-fetch. Each middleware has a unique `key`, `initialState`, `reducer`, and optional `onRequest` / `onResponse` / `onError` handlers.

`createRateLimitMiddleware` learns ESI rate-limit groups from response headers, tracks token usage per group and character, and proactively delays outbound requests when a bucket is low.

Use `useMiddleware("rateLimit")` or `useMiddlewareState("rateLimit")` to read custom middleware state directly.

## Development

```bash
pnpm --filter @eve-online-tools/esi-provider build
pnpm --filter @eve-online-tools/esi-provider test
pnpm --filter @eve-online-tools/esi-provider typecheck
```

## License

MIT
