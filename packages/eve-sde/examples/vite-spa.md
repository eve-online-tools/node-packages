# Vite + React app

A client-only app that embeds small tables and fetches `types` rows per id.

```bash
pnpm add @eve-online-tools/eve-sde react react-dom
pnpm add -D vite @vitejs/plugin-react typescript @types/react @types/react-dom
```

```ts
// vite.config.ts
import { sde } from '@eve-online-tools/eve-sde/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({ plugins: [sde(), react()] })
```

```ts
// eve-sde.config.ts
import { defineConfig } from '@eve-online-tools/eve-sde/vite'

export default defineConfig({
  tables: {
    categories: { client: 'embed' },
    groups: { client: 'embed' },
  },
  dts: 'src/eve-sde.d.ts',
})
```

`categories` and `groups` are bundled as lazily loaded JSON chunks. Every other table, `types` included, uses the
default `record` mode: one cached request per row to `sde.evetech.net`.

```tsx
// src/ShipCard.tsx
import { useSdeRow } from '@eve-online-tools/eve-sde/react'

const GroupName = ({ groupId }: { groupId: number }) => <>{useSdeRow('groups', groupId)?.name.en}</>

export const ShipCard = ({ typeId }: { typeId: number }) => {
  const type = useSdeRow('types', typeId)
  if (!type) {
    return <p>Unknown type {typeId}</p>
  }
  return (
    <p>
      {type.name.en} (<GroupName groupId={type.groupID} />)
    </p>
  )
}
```

```tsx
// src/main.tsx
import { Suspense } from 'react'
import { createRoot } from 'react-dom/client'
import { ShipCard } from './ShipCard'

createRoot(document.getElementById('root')!).render(
  <Suspense fallback="Loading">
    <ShipCard typeId={587} />
  </Suspense>,
)
```

The hooks suspend, so wrap them in `Suspense`. Without an `SdeProvider` they read from the shared `sde` instance that
the plugin configured.

## Preloading

Rows already in the cache render without suspending. Load them before rendering, for example in a route loader:

```ts
import { sde } from '@eve-online-tools/eve-sde'

export const shipRouteLoader = async (typeId: number) => {
  const type = await sde.table('types').getOrThrow(typeId)
  await sde.table('groups').preload([type.groupID])
}

// Whole tables: one download, then every lookup is served from memory.
await sde.table('groups').preload()
```

Preloading a whole table keeps every row in memory. That suits `groups` or `categories`; for `types` (about 50,000 rows), preload the keys you need or build a dataset.

## Files to commit

- `eve-sde.config.ts`
- `eve-sde.lock.json`, written on the first dev server start or build
- `src/eve-sde.d.ts` and `src/eve-sde.datasets.d.ts`, row and dataset types for the locked release

Ignore `.cache/eve-sde`.

## Updates

The locked release only applies to the embedded tables. `record` and `bulk` tables follow the latest release: the
instance checks `latest/` at most every 5 minutes when something reads, drops cached rows of tables that changed and
emits `change`. Mounted hooks re-render with the new rows.

When `categories` or `groups` change upstream, the instance emits `stale`. Run `eve-sde update` and rebuild, or set
`onStale: 'remote'` on the table to read it over HTTP until the next build.
