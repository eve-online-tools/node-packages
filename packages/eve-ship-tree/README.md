# @eve-online-tools/eve-ship-tree

React components for rendering EVE Online ship trees.

## Installation

```bash
pnpm add @eve-online-tools/eve-ship-tree motion @use-gesture/react
```

## Usage

Import the package styles once:

```tsx
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
    <ShipTree.Root faction={500001} skills={skills} baseUrl="/ship-tree-data">
      <Grid topLabel="Ship Tree">
        <TreeDisplay />
      </Grid>
    </ShipTree.Root>
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

`TreeDisplay` reads the faction from `ShipTree` when the prop is omitted. All 17 ship tree factions have layouts: the four empires, CONCORD, ORE, EDENCOM, the Triglavian Collective and the pirate factions.

### Faction selector

`FactionSelector` and `FactionSummary` work outside `ShipTree`, so they can sit anywhere, for example pinned over the tree outside its pan and zoom.

```tsx
import { FactionSelector, FactionSummary, ShipTree, type FactionIdentifier } from "@eve-online-tools/eve-ship-tree";

const [faction, setFaction] = useState<FactionIdentifier>(500002);

<FactionSelector value={faction} onChange={setFaction} />
<FactionSummary faction={faction} />
<ShipTree.Root faction={faction} skills={skills} baseUrl="/ship-tree-data">...</ShipTree.Root>
```

- `FactionSelector` is a radiogroup of faction logos, five per row; arrow keys, Home and End move the selection. `factions` defaults to `shipTreeFactionOrder` (client order). `variant="compact"` renders a native select for narrow layouts. `onHoverChange` reports the hovered faction (`null` on leave); pass `hovered ?? value` to `FactionSummary` to preview it.
- `FactionSummary` shows logo, name, element glyphs and description in the client's 266px info bubble. It reads `shipTreeFactions` and `shipTreeElements` from the nearest `DataProvider`, or from its `data` prop. Without them it shows logo and name only.
- `shipTreeFactionIdentifiers`, `shipTreeFactionNames` and `shipTreeFactionOrder` export the faction metadata.

### Group tooltips

Hovering or focusing a ship group node shows a tooltip with the group's icon, name, element glyphs, description and the faction's bonus skills with the character's trained levels. Pass the skill in training (for example the first entry of the ESI skill queue) to highlight its target level:

```tsx
<ShipTree.Root faction={500002} skills={skills} training={{ skillId: 3333, level: 4 }} baseUrl="/ship-tree-data">
  <TreeDisplay />
</ShipTree.Root>
```

`<TreeDisplay groupTooltip={false} />` turns tooltips off; a function, `({ groupId, faction }) => ReactNode`, replaces their content. `GroupTooltip` renders the default content. Names come from the optional `shipTreeElements` and `skills` tables; when they are missing the tooltip falls back to ids.

### Sprites

`ShipTree` fetches and decodes all status sprites (frames, lines, mastery and tech badges) on mount, so switching characters does not make them pop in. Call `preloadShipTreeSprites()` to start earlier, for example on page load. `shipTreeSprites` lists their URLs.

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

### Data tables

`data` is typed as `PreloadedData`: the seven tables below are required and the other generated tables are optional. Each table maps a numeric key to a record. To build them without the bundled JSONL (for example from your own SDE copy), derive them as follows. Field names follow the SDE YAML/JSONL export.

| Table | Key | Record | Derivation |
| --- | --- | --- | --- |
| `types` | type ID | `{ shipTreeGroupID?, factionID?, metaGroupID?, techLevel? }` | SDE `types` whose group has `categoryID` 6 (Ship). `techLevel` falls back to dogma attribute 422, then 1. |
| `requiredSkills` | type ID | `{ requiredSkills: Record<skillTypeID, level> }` | Dogma attribute pairs (skill, level): 182/277, 183/278, 184/279, 1285/1286, 1289/1287. Skip pairs whose skill is missing or 0; a missing level is 0. |
| `masteries` | type ID | `[{ _key: masteryLevel, _value: certificateID[] }]` | SDE `masteries` for the types above. `_key` is 0 to 4. |
| `certificates` | certificate ID | `{ skillTypes: [{ _key: skillTypeID, basic, standard, improved, advanced, elite }] }` | SDE `certificates` referenced by `masteries`. |
| `cloneGrades` | clone grade ID | `{ skills: [{ typeID, level }] }` | SDE `cloneGrades` as is. |
| `shipTreeGroups` | ship tree group ID | `{ elements: [{ _key, _value }], preReqSkills: [{ _key: factionID, skills: [{ _key: skillTypeID, level, display }] }] }` | SDE `shipTreeGroups` as is. |
| `shipSizes` | rig size | `{ typeIDs: number[] }` | Types grouped by dogma attribute 1547 (rig size, missing is 0). Ship tree groups 37 (Freighter) and 38 (Jump Freighter) are forced to 4. |

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
