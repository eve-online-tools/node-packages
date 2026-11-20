# TanStack Query

```ts
import { sde } from '@eve-online-tools/eve-sde'
import { connectQueryClient, sdeQueries } from '@eve-online-tools/eve-sde/react-query'
import { QueryClient, useQuery } from '@tanstack/react-query'

export const queryClient = new QueryClient()
connectQueryClient(sde, queryClient) // invalidates a table's queries on `change`

const queries = sdeQueries() // or sdeQueries(instance)

export const useShipName = (typeId: number) => useQuery(queries.row('types', typeId)).data?.name.en
```

- `row(table, key)` resolves to the row or `null`, since query data cannot be `undefined`.
- `rows(table, keys)` resolves to the existing rows in key order.
- Queries use `staleTime: Infinity`; `connectQueryClient` handles invalidation.

Preload during routing with `queryClient.ensureQueryData(queries.row('types', 587))`.
