# @eve-online-tools/eve-ship-tree

## 0.3.0

### Minor Changes

- [#77](https://github.com/eve-online-tools/node-packages/pull/77)
  [`cb776e0`](https://github.com/eve-online-tools/node-packages/commit/cb776e0cac8e2fd561bd34dd614825c31bf2fbcc) - Add
  `FactionSelector` and `FactionSummary` components, and export faction metadata (`shipTreeFactionIdentifiers`,
  `shipTreeFactionNames`, `shipTreeFactionOrder`).

- [#78](https://github.com/eve-online-tools/node-packages/pull/78)
  [`98b8ab6`](https://github.com/eve-online-tools/node-packages/commit/98b8ab60e09ba3b223f7ffed03bc5801b07a259b) - Ship
  group nodes show a tooltip on hover and keyboard focus: group icon, name, element glyphs and description. Locked
  groups list the skills required to unlock them; unlocked groups list their bonus skills with a training hint. Each
  skill shows the character's level, the level in training, Omega restrictions and whether the requirement is met.
  `TreeDisplay`'s `groupTooltip` turns it off or replaces its content. `SkillsProvider` and `ShipTree.Root` accept an
  optional `training` skill. New generated `skills.jsonl` table holds skill names.

- [#82](https://github.com/eve-online-tools/node-packages/pull/82)
  [`3911cde`](https://github.com/eve-online-tools/node-packages/commit/3911cde50a1e5bbb958308cde9f43296e7356936) - Ship
  nodes show a tooltip on hover and keyboard focus: render with tech badge, name, element glyphs, an optional estimated
  price and the ship's bonuses per skill, role and misc, with units and bold item names. `ShipTree` and `ShipTree.Root`
  accept `prices` and `locale`. `TreeDisplay`'s `shipTooltip` turns it off or replaces its content. `FloatingTooltip`
  gains a `vertical` placement with up and down pointers.

### Patch Changes

- [#79](https://github.com/eve-online-tools/node-packages/pull/79)
  [`844d4ac`](https://github.com/eve-online-tools/node-packages/commit/844d4acd926ff3b9094f5b9b3660c6b29ee27d03) - Add
  Battlecruiser to the Blood Raider Covenant layout.

- [#75](https://github.com/eve-online-tools/node-packages/pull/75)
  [`39a0b5d`](https://github.com/eve-online-tools/node-packages/commit/39a0b5dcd3c1c2ecf99b9ec8c11883d3783b9246) - Ship
  tree element icons use the client's white `eveicon/category_icons` glyphs. All 30 elements now resolve; 16 were empty
  before.

- [#80](https://github.com/eve-online-tools/node-packages/pull/80)
  [`5d8ae95`](https://github.com/eve-online-tools/node-packages/commit/5d8ae95ece9e5468d9d30ca8fd7c146d65645306) -
  Adjust faction layout spacing to match the in-game Ship Tree and remove group box overlaps.

- [#83](https://github.com/eve-online-tools/node-packages/pull/83)
  [`30b08d9`](https://github.com/eve-online-tools/node-packages/commit/30b08d9319411e92cc235aa5e30f462c8e35f2ba) - Use
  `Saira Semi Condensed` as the ship tree font. The latin 400 and 700 weights are bundled in `styles.css` via
  `@fontsource/saira-semi-condensed`.

- [#79](https://github.com/eve-online-tools/node-packages/pull/79)
  [`844d4ac`](https://github.com/eve-online-tools/node-packages/commit/844d4acd926ff3b9094f5b9b3660c6b29ee27d03) -
  Update SDE data to build 3579973.

## 0.2.0

### Minor Changes

- [#67](https://github.com/eve-online-tools/node-packages/pull/67)
  [`6abc339`](https://github.com/eve-online-tools/node-packages/commit/6abc33920d96a40f4553fb2d71bd1b869ce641a6) -
  Preload status sprites on mount so they do not pop in when skills change. Export `preloadShipTreeSprites()` and
  `shipTreeSprites`.

- [#68](https://github.com/eve-online-tools/node-packages/pull/68)
  [`b400479`](https://github.com/eve-online-tools/node-packages/commit/b400479c487780285a62de9ccbca44ff35c4eb53) -
  `DataProvider` and `ShipTree.Root` take `PreloadedData`: only the seven tables the tree reads are required.
  `shipSizes` is now typed. The README documents each table's shape and SDE derivation. `useData().data` is typed as
  `PreloadedData`.

### Patch Changes

- [#66](https://github.com/eve-online-tools/node-packages/pull/66)
  [`10e404e`](https://github.com/eve-online-tools/node-packages/commit/10e404ee1e0774ef65587109f8b59418d6547767) - Use
  the 264px flat logos for CONCORD, EDENCOM and the Triglavian Collective. Their 256px files in the client are a shared
  red-square placeholder.

- [#65](https://github.com/eve-online-tools/node-packages/pull/65)
  [`5f89484`](https://github.com/eve-online-tools/node-packages/commit/5f894845adedf508a475d278e405f6e59f42bbfe) -
  README: list all 17 factions as supported.

## 0.1.0

### Minor Changes

- [#52](https://github.com/eve-online-tools/node-packages/pull/52)
  [`f97f705`](https://github.com/eve-online-tools/node-packages/commit/f97f70530a90535387884ffbbf4080a8530c5aef) -
  Remove the `@mantine/core` and `@mantine/hooks` peer dependencies. Components are plain React and no longer need
  `MantineProvider` or `@mantine/core/styles.css`.

  Breaking changes:

  - `classNames`, `styles`, `className` and `style` are still supported. The Mantine-only props `vars`, `unstyled`,
    `attributes` and `variant`, and theme-level default props, are gone.
  - Removed the `*Factory`, `*Variant` and `*CssVariables` type exports and the static `.classes` property.
  - `styles.layer.css` now wraps styles in `@layer eve-online-tools` instead of `@layer mantine`.
  - Typography and spacing that came from Mantine theme variables now use fixed values.

### Patch Changes

- [#46](https://github.com/eve-online-tools/node-packages/pull/46)
  [`72a5bb5`](https://github.com/eve-online-tools/node-packages/commit/72a5bb545003803fd67040d41bb5c6fec493a205) -
  Update SDE data to build 3569502.

## 0.0.2

### Patch Changes

- Updated dependencies
  [[`0705419`](https://github.com/eve-online-tools/node-packages/commit/0705419a24545057d4c70a420ce3ced023bc8480),
  [`e8541ae`](https://github.com/eve-online-tools/node-packages/commit/e8541aec5eb374719d253c13cdb33789b41e9eed)]:
  - @eve-online-tools/eve-sde@0.1.0
  - @eve-online-tools/eve-resfile@0.3.0
