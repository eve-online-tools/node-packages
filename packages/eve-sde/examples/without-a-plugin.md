# Without a plugin

Next.js, Remix with webpack, or any setup where the Vite and Rollup plugins don't run. The shared `sde` instance then
reads everything from the latest release over HTTP, which works in Node, browsers and edge runtimes.

## React Server Components

Read on the server and pass plain rows to client components:

```tsx
// app/ships/[id]/page.tsx
import { sde } from '@eve-online-tools/eve-sde'
import { notFound } from 'next/navigation'

export default async function ShipPage({ params }: { params: Promise<{ id: string }> }) {
  const type = await sde.table('types').get(Number((await params).id))
  if (!type) {
    notFound()
  }
  return <h1>{type.name.en}</h1>
}
```

Requests in the same tick are batched, and rows are cached for the life of the server process. Release checks happen in
the background at most every 5 minutes.

## ISR

```ts
// instrumentation.ts or another module loaded once per server
import { sde } from '@eve-online-tools/eve-sde'
import { revalidatePath } from 'next/cache'

sde.on('change', () => revalidatePath('/ships', 'layout'))
```

## Your own instance

For locked data or other sources, export an instance from a module and import that instead of `sde`:

```ts
// lib/sde.ts
import { createSde, embedded, remote } from '@eve-online-tools/eve-sde'
import races from './generated/races.json'

export const appSde = createSde({
  sources: [embedded({ races }), remote({ get: 'bulk', tables: ['types'] }), remote()],
})
```

Generate files like `races.json` with a dataset and `eve-sde build`, see [datasets.md](./datasets.md). `SdeProvider`
from `/react` takes this instance for client components.
