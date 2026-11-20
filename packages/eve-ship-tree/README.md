# @eve-online-tools/eve-ship-tree

React components for rendering EVE Online ship trees.

## Installation

```bash
pnpm add @eve-online-tools/eve-ship-tree motion @use-gesture/react
```

## Usage

Ship tree data is built from the SDE by an [eve-sde](../eve-sde) dataset in your app's build. Register `shipTreeDataset()` in `eve-sde.config.ts` and add the eve-sde plugin (see the eve-sde README):

```ts
// eve-sde.config.ts
import { defineConfig } from "@eve-online-tools/eve-sde/vite";
import { shipTreeDataset } from "@eve-online-tools/eve-ship-tree/sde";

export default defineConfig({
  datasets: [shipTreeDataset()],
  dts: "src/eve-sde.d.ts",
});
```

Import the dataset value, `{ url }` of the emitted JSON file, and pass it to `ShipTree.Root`. Import the package styles once:

```tsx
import "@eve-online-tools/eve-ship-tree/styles.css";
import {
  Grid,
  ShipTree,
  TreeDisplay,
  type Skills,
} from "@eve-online-tools/eve-ship-tree";
import shipTreeData from "eve-sde:dataset/eve-ship-tree:data";

const skills: Skills = { 3330: 3 };

export function App() {
  return (
    <ShipTree.Root faction={500001} skills={skills} dataset={shipTreeData}>
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
  <DataProvider dataset={shipTreeData}>
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
<ShipTree.Root faction={faction} skills={skills} dataset={shipTreeData}>...</ShipTree.Root>
```

- `FactionSelector` is a radiogroup of faction logos, five per row; arrow keys, Home and End move the selection. `factions` defaults to `shipTreeFactionOrder` (client order). `variant="compact"` renders a native select for narrow layouts. `onHoverChange` reports the hovered faction (`null` on leave); pass `hovered ?? value` to `FactionSummary` to preview it.
- `FactionSummary` shows logo, name, element glyphs and description in the client's 266px info bubble. It reads `shipTreeFactions` and `shipTreeElements` from the nearest `DataProvider`, or from its `data` prop. Without them it shows logo and name only.
- `shipTreeFactionIdentifiers`, `shipTreeFactionNames` and `shipTreeFactionOrder` export the faction metadata.

### Group tooltips

Hovering or focusing a ship group node shows a tooltip with the group's icon, name, element glyphs and description. Locked groups list the skills required to unlock them; unlocked groups list the faction's bonus skills. Each skill shows the character's trained level. Pass the skill in training (for example the first entry of the ESI skill queue) to highlight its target level:

```tsx
<ShipTree.Root faction={500002} skills={skills} training={{ skillId: 3333, level: 4 }} dataset={shipTreeData}>
  <TreeDisplay />
</ShipTree.Root>
```

`<TreeDisplay groupTooltip={false} />` turns tooltips off; a function, `({ groupId, faction }) => ReactNode`, replaces their content. `GroupTooltip` renders the default content. Names come from the optional `shipTreeElements` and `skills` tables; when they are missing the tooltip falls back to ids.

### Ship tooltips

Hovering or focusing a ship node shows a tooltip above it, or below when there is no room: the ship render with its tech badge, name, element glyphs (size first) and the ship's bonuses per skill, role bonuses and misc bonuses. Prices are not in the SDE, so pass them in ISK, as a record or a lookup, to show an estimated price line. Ships without a price show no price line. `locale` sets the number format; it defaults to the reader's locale:

```tsx
<ShipTree.Root faction={500002} skills={skills} prices={(typeId) => marketPrices.get(typeId)} locale="en-GB" dataset={shipTreeData}>
  <TreeDisplay />
</ShipTree.Root>
```

`<TreeDisplay shipTooltip={false} />` turns them off; a function, `({ typeId, faction }) => ReactNode`, replaces their content. `ShipTooltip` renders the default content; its `renderUrl` prop replaces the render URL, which defaults to the EVE image server (`defaultShipRenderUrl`). Bonuses come from the optional `typeBonus` table, glyphs from `typeElements`; sections whose data is missing are left out.

### Sprites

`ShipTree` fetches and decodes all status sprites (frames, lines, mastery and tech badges) on mount, so switching characters does not make them pop in. Call `preloadShipTreeSprites()` to start earlier, for example on page load. `shipTreeSprites` lists their URLs.

## Data

`shipTreeDataset()` emits one JSON file with every table below, for the ships in the tree, with English text. Icons and layout geometry are bundled in the package.

### Loading

`ShipTree.Root` and `DataProvider` take the dataset value as `dataset` and fetch the file on mount; pass `fetch` to replace the global one. To load it yourself, for example in a route loader, call `loadShipTreeData` and pass the tables as `data`:

```tsx
import { DataProvider, loadShipTreeData } from "@eve-online-tools/eve-ship-tree";
import shipTreeData from "eve-sde:dataset/eve-ship-tree:data";

const data = await loadShipTreeData(shipTreeData, { timeoutMs: 10_000 });

<SkillsProvider skills={skills}>
  <ShipTree faction={500001}>
    <DataProvider data={data}>
      <TreeDisplay />
    </DataProvider>
  </ShipTree>
</SkillsProvider>;
```

The URL is relative to the app, so on a server read the file from the build output or prefix the origin.

### Without a bundler plugin

`eve-sde build --out <dir>` runs the registered datasets without Vite or Rollup. It writes the data file to `<dir>/eve-ship-tree%3Adata/ship-tree-data.json` and the value to `<dir>/eve-ship-tree%3Adata.json`, with `url` relative to `<dir>`. Serve the data file and pass its public URL as `dataset={{ url }}`.

### Data tables

`data` is typed as `PreloadedData`: the seven tables the tree reads are required, the tooltip and `FactionSummary` tables are optional. Each table maps a numeric key to the SDE row without its key field, keeping only the fields below.

| Table | Key | Record | Derivation |
| --- | --- | --- | --- |
| `types` | type ID | `{ name, shipTreeGroupID, factionID?, metaGroupID?, techLevel }` | SDE `types` in category 6 (Ship) with a `shipTreeGroupID`. `techLevel` falls back to dogma attribute 422, then 1. |
| `requiredSkills` | type ID | `{ requiredSkills: Record<skillTypeID, level> }` | Dogma attribute pairs (skill, level): 182/277, 183/278, 184/279, 1285/1286, 1289/1287. Pairs whose skill is missing or 0 are skipped; a missing level is 0. |
| `masteries` | type ID | `{ levels: [{ level, certificateIDs }] }` | SDE `masteries`. `level` is 0 to 4. |
| `certificates` | certificate ID | `{ skillTypes: [{ typeID, basic, standard, improved, advanced, elite }] }` | SDE `certificates` referenced by `masteries`. |
| `cloneGrades` | clone grade ID | `{ skills: [{ typeID, level }] }` | SDE `cloneGrades`. |
| `shipTreeGroups` | ship tree group ID | `{ name, description?, elements: [{ position, elementID }], preReqSkills: [{ factionID, skills: [{ skillTypeID, level, display }] }] }` | SDE `shipTreeGroups`. |
| `shipSizes` | rig size | `{ typeIDs: number[] }` | Types grouped by dogma attribute 1547 (rig size, missing is 0). Ship tree groups 37 (Freighter) and 38 (Jump Freighter) are size 4. |
| `skills` | type ID | `{ name }` | Skills referenced by `shipTreeGroups`, `typeBonus` and `requiredSkills`. |
| `shipTreeElements` | element ID | `{ name, description }` | SDE `shipTreeElements`. |
| `shipTreeFactions` | faction ID | `{ description, elements: [{ position, elementID }] }` | SDE `shipTreeFactions`. |
| `typeBonus` | type ID | `{ types?: [{ typeID, bonuses }], roleBonuses?, miscBonuses? }` | SDE `typeBonus`. |
| `typeElements` | type ID | `{ elements: [{ position, elementID }] }` | SDE `typeElements`. |

Fetch failures are logged to the console; the UI shows a generic error message.

### SDE data version

The data follows the SDE release locked in the app's `eve-sde.lock.json`. Icons and identifiers compiled into this package are generated from the release in its own `eve-sde.lock.json` by the datasets in `src/data/datasets`, which `rollup -c` runs through `eve-sde.config.ts`. `src/data/.eve-sde-dataset.json` records their fingerprints; builds skip regeneration while the input tables are unchanged.

To lock the latest SDE release and regenerate them:

```bash
pnpm --filter @eve-online-tools/eve-ship-tree sde:update
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
