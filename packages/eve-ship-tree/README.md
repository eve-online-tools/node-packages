# @eve-online-tools/eve-ship-tree

Mantine components for rendering EVE Online ship trees.

## Installation

```bash
pnpm add @eve-online-tools/eve-ship-tree @mantine/core @mantine/hooks motion @use-gesture/react
```

`MantineProvider` must wrap your app (peer dependency of Mantine).

## Usage

Import the package styles alongside Mantine:

```tsx
import { MantineProvider } from "@mantine/core";
import "@mantine/core/styles.css";
import "@eve-online-tools/eve-ship-tree/styles.css";
import {
  Grid,
  ShipTree,
  TreeDisplay,
  type Skills,
} from "@eve-online-tools/eve-ship-tree";

const skills: Skills = { 3330: 3 };

export function App() {
  return (
    <MantineProvider>
      <ShipTree.Root faction={500001} skills={skills} baseUrl="/ship-tree-data">
        <Grid topLabel="Ship Tree">
          <TreeDisplay />
        </Grid>
      </ShipTree.Root>
    </MantineProvider>
  );
}
```

`SkillsProvider` and `ShipTree.Root` accept skills as either a `{ [skillId]: level }` map or the array from ESI `/characters/{id}/skills/` (entries with `skill_id` and `active_skill_level`). The provider normalizes ESI responses internally.

The batteries-included `ShipTree.Root` composes the required providers. Provider order when composing manually:

```tsx
<SkillsProvider skills={skills}>
  <DataProvider baseUrl="/ship-tree-data">
    <ShipTree faction={500001}>
      <Grid topLabel="Ship Tree">
        <TreeDisplay />
      </Grid>
    </ShipTree>
  </DataProvider>
</SkillsProvider>
```

`TreeDisplay` reads the faction from `ShipTree` when the prop is omitted. Only the four empire factions (`500001`–`500004`) have layouts today; other factions show an explicit unsupported message.

## Data

Ship tree structure and metadata ship as JSONL files in `dist/data/generated/`. Icons and layout geometry stay bundled in the package; the JSONL files are fetched or preloaded at runtime.

### Static hosting

Copy the published data files into your app's static directory:

```bash
cp node_modules/@eve-online-tools/eve-ship-tree/dist/data/generated/*.jsonl public/ship-tree-data/
```

With Vite, you can also use `vite-plugin-static-copy`:

```ts
viteStaticCopy({
  targets: [
    {
      src: "node_modules/@eve-online-tools/eve-ship-tree/dist/data/generated/*.jsonl",
      dest: "ship-tree-data",
    },
  ],
});
```

### Fetch mode

```tsx
import {
  DataProvider,
  ShipTree,
  SkillsProvider,
  TreeDisplay,
  type Skills,
} from "@eve-online-tools/eve-ship-tree";

const skills: Skills = { 3330: 3 };

<ShipTree faction={500001}>
  <SkillsProvider skills={skills}>
    <DataProvider baseUrl="/ship-tree-data">
      <TreeDisplay />
    </DataProvider>
  </SkillsProvider>
</ShipTree>
```

When using fetch mode, nest `DataProvider` inside `SkillsProvider` and keep `ShipTree` as the loading/error gate for children.

### Preloaded mode

Load once on the server or in a parent loader, then pass the parsed tables directly:

```tsx
import {
  DataProvider,
  loadShipTreeData,
  ShipTree,
  TreeDisplay,
} from "@eve-online-tools/eve-ship-tree";

const data = await loadShipTreeData({
  baseUrl: "https://cdn.example.com/ship-tree-data",
  validateBaseUrl: true,
});

<SkillsProvider skills={skills}>
  <ShipTree faction={500001}>
    <DataProvider data={data}>
      <TreeDisplay />
    </DataProvider>
  </ShipTree>
</SkillsProvider>;
```

### Security (server loaders)

`loadShipTreeData` accepts a trusted static `baseUrl`. Never pass user-controlled URLs to it on the server without validation — that enables SSRF against internal networks.

When loading in Node, validation runs by default. Pass an explicit trusted origin or disable only for same-origin static paths you control:

```ts
await loadShipTreeData({
  baseUrl: process.env.SHIP_TREE_DATA_URL!,
  validateBaseUrl: true,
});
```

Fetch failures are logged to the console; the UI shows a generic error message.

### SDE data version

Committed JSONL is generated from a pinned EVE SDE build in `rollup.config.ts` (`SDE_BUILD_NUMBER`). The active build is also recorded in `src/data/.sde-lock.json` after each build.

To fetch the latest SDE build, update the pin, and regenerate all artifacts:

```bash
pnpm --filter @eve-online-tools/eve-ship-tree sde:update
```

To pin a specific build:

```bash
pnpm --filter @eve-online-tools/eve-ship-tree sde:update 3409592
```

## Development

This package lives in the [node-packages](https://github.com/eve-online-tools/node-packages) monorepo.

```bash
pnpm --filter @eve-online-tools/eve-ship-tree build
pnpm --filter @eve-online-tools/eve-ship-tree test
pnpm --filter @eve-online-tools/eve-ship-tree typecheck
pnpm --filter @eve-online-tools/eve-ship-tree lint
pnpm --filter @eve-online-tools/eve-ship-tree format:check
```

## License

MIT
