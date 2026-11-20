# @eve-online-tools/eve-map

## 0.2.0

### Minor Changes

- [#98](https://github.com/eve-online-tools/node-packages/pull/98)
  [`dc29bf0`](https://github.com/eve-online-tools/node-packages/commit/dc29bf0baae6e841eff3235b7e68c6c7e532d11c) -
  Breaking: `mapDataProcessor()` is replaced by `mapDataset()` for eve-sde 1.0. Import the result as
  `eve-sde:dataset/eve-map:map-data` to get `{ url, systems }`. The `format` and `fileName` options are removed; the
  binary format is the only output.

### Patch Changes

- Updated dependencies
  [[`dc29bf0`](https://github.com/eve-online-tools/node-packages/commit/dc29bf0baae6e841eff3235b7e68c6c7e532d11c)]:
  - @eve-online-tools/eve-sde@1.0.0

## 0.1.1

### Patch Changes

- [#64](https://github.com/eve-online-tools/node-packages/pull/64)
  [`224b518`](https://github.com/eve-online-tools/node-packages/commit/224b518446be2ba8486ff445464c5413597836f8) - Emit
  `camerachange` after the canvas resizes, so overlays positioned with `project()` follow.

## 0.1.0

### Minor Changes

- [#53](https://github.com/eve-online-tools/node-packages/pull/53)
  [`05b0316`](https://github.com/eve-online-tools/node-packages/commit/05b031621a192164f5580a230a35d55ab589abc1) - Add
  `@eve-online-tools/eve-map`, an interactive WebGL 2 map of New Eden with 2D and 3D layouts, an animated transition
  between them, picking, controls, labels, markers and route paths. Includes a binary map data format, an `eve-sde`
  processor that generates it, and a React binding.
