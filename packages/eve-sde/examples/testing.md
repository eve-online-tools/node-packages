# Testing

`fixture()` serves rows from memory. Only the key field is required, so tests list just what the code reads.

```ts
import { createSde, fixture } from '@eve-online-tools/eve-sde'
import { expect, it } from 'vitest'

const shipLabel = async (sde: ReturnType<typeof createSde>, typeId: number) => {
  const type = await sde.table('types').getOrThrow(typeId)
  const group = await sde.table('groups').getOrThrow(type.groupID)
  return `${type.name.en} (${group.name.en})`
}

it('labels ships', async () => {
  const sde = createSde({
    sources: [
      fixture({
        types: [{ typeID: 587, groupID: 25, name: { en: 'Rifter' } }],
        groups: [{ groupID: 25, name: { en: 'Frigate' } }],
      }),
    ],
  })

  expect(await shipLabel(sde, 587)).toBe('Rifter (Frigate)')
})
```

Pass the instance in, or wrap components in `<SdeProvider sde={sde}>`, instead of reading the shared `sde` in code under
test. Tables without a fixture fall through to the next source; with only `fixture` they throw, so a test cannot reach
the network by accident.
