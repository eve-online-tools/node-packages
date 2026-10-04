# @eve-online-tools/eve-ship-tree

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
