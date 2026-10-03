---
'@eve-online-tools/eve-ship-tree': minor
---

Remove the `@mantine/core` and `@mantine/hooks` peer dependencies. Components are plain React and no longer need `MantineProvider` or `@mantine/core/styles.css`.

Breaking changes:

- `classNames`, `styles`, `className` and `style` are still supported. The Mantine-only props `vars`, `unstyled`, `attributes` and `variant`, and theme-level default props, are gone.
- Removed the `*Factory`, `*Variant` and `*CssVariables` type exports and the static `.classes` property.
- `styles.layer.css` now wraps styles in `@layer eve-online-tools` instead of `@layer mantine`.
- Typography and spacing that came from Mantine theme variables now use fixed values.
