# @eve-online-tools/eve-ship-tree

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
