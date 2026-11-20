# Server rendering

Vite SSR with React. The server reads `types` from FlatBuffers files shipped with the server build, renders, and sends
the rows it read to the client so hydration does not refetch them.

```ts
// eve-sde.config.ts
import { defineConfig } from '@eve-online-tools/eve-sde/vite'

export default defineConfig({
  tables: {
    groups: { client: 'embed', server: 'embed' },
    types: { client: 'record', server: 'files' },
  },
  dts: 'src/eve-sde.d.ts',
})
```

- `server: 'files'` copies the locked `.fb` and `.bfbs` files of `types` to `<server outDir>/eve-sde/`. Deploy that
  folder with the server bundle. The dev server reads them from `.cache/eve-sde`.
- `files` needs a file system. For an edge runtime use `record` or `bulk` for the server.

## Server

```tsx
// src/entry-server.tsx
import { dehydrate, sde } from '@eve-online-tools/eve-sde'
import { SdeProvider } from '@eve-online-tools/eve-sde/react'
import { prerenderToNodeStream } from 'react-dom/static'
import { App } from './App'

export const render = async (): Promise<{ html: string; state: string }> => {
  // One scope per request: it records the rows this render reads.
  const scope = sde.scope()
  const { prelude } = await prerenderToNodeStream(
    <SdeProvider sde={scope}>
      <App />
    </SdeProvider>,
  )
  let html = ''
  for await (const chunk of prelude) {
    html += chunk
  }
  // `<` is escaped so row text cannot close the script tag.
  const state = JSON.stringify(await dehydrate(scope)).replaceAll('<', '\\u003c')
  return { html, state }
}
```

Inject the result into the page:

```html
<div id="root"><!--app-html--></div>
<script>
  window.__SDE__ = <!--sde-state-->
</script>
```

`prerenderToNodeStream` waits for every suspended hook. With `renderToPipeableStream`, call `dehydrate` in `onAllReady`.

## Client

```tsx
// src/entry-client.tsx
import { hydrate, sde, type DehydratedSde } from '@eve-online-tools/eve-sde'
import { hydrateRoot } from 'react-dom/client'
import { App } from './App'

declare global {
  interface Window {
    __SDE__?: DehydratedSde
  }
}

if (window.__SDE__) {
  hydrate(sde, window.__SDE__)
}
hydrateRoot(document.getElementById('root')!, <App />)
```

`hydrate` seeds the rows and the server's release into the shared instance before the first render, so hooks resolve
from the cache.

## Static generation

During prerendering, `embed` and `files` tables serve the locked release, so every page of one build sees the same data.
Rerun `eve-sde update` and rebuild to publish a new release.

## Revalidation

A long-running server keeps checking `latest/` while it reads:

```ts
import { sde } from '@eve-online-tools/eve-sde'

sde.on('change', ({ tables }) => revalidateRuntimeTables(tables)) // record / bulk tables moved
sde.on('stale', ({ release }) => scheduleRebuild(release)) // embed / files tables are behind
```
