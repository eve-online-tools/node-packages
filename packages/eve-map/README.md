# @eve-online-tools/eve-map

Interactive WebGL 2 map of New Eden. Renders solar systems and stargates in the schematic 2D layout or the real 3D layout, with an animated, interruptible transition between them, hit testing, and keyboard and pointer controls.

The package draws the map. Data sourcing, overlays (tooltips, panels) and domain logic belong to the consuming app.

## Installation

```bash
pnpm add @eve-online-tools/eve-map three
# React binding
pnpm add react
# Build-time data generation
pnpm add -D @eve-online-tools/eve-sde
```

`three` is a peer dependency so apps share one copy. Requires WebGL 2.

| Import | Contents |
| --- | --- |
| `@eve-online-tools/eve-map` | `createMap`, data helpers, color helpers, types |
| `@eve-online-tools/eve-map/react` | `<EveMap>`, `useEveMap` |
| `@eve-online-tools/eve-map/sde` | `mapDataProcessor()` for `@eve-online-tools/eve-sde` (Node only) |

Imports have no side effects and are SSR safe. Nothing touches `window` until `createMap` runs.

## Getting map data

### From the SDE at build time

```ts
// vite.config.ts
import { sde } from '@eve-online-tools/eve-sde/vite'
import { mapDataProcessor } from '@eve-online-tools/eve-map/sde'

export default defineConfig({
  plugins: [
    sde({
      outputDir: 'src/generated/sde',
      processors: [mapDataProcessor({ locale: 'en', format: 'binary' })],
    }),
  ],
})
```

| Option | Default | |
| --- | --- | --- |
| `locale` | `en` | Language of the names written to the output, falls back to `en` |
| `systems` | IDs 30,000,000 to 30,999,999 | `(system) => boolean` filter. `system` has `id`, `constellationId`, `regionId`, `security`, `name` |
| `format` | `binary` | `binary` writes `map-data.bin`, `json` writes `map-data.json` |
| `fileName` | by format | Output path relative to `outputDir` |

The processor streams `mapSolarSystems`, `mapStargates`, `mapRegions` and `mapConstellations`. Its version includes a processor revision, the options and the filter source, so changing any of them invalidates the SDE lock.

```ts
import { decodeMapData } from '@eve-online-tools/eve-map'
import mapDataUrl from './generated/sde/map-data.bin?url'

const data = decodeMapData(await (await fetch(mapDataUrl)).arrayBuffer())
```

### From other sources

- `buildMapData({ systems, gates, regions?, constellations? })` builds normalized `MapData` from SDE-shaped input (universe coordinates in meters). `gates` are `[fromSystemId, toSystemId]` tuples, `regions` and `constellations` are `{ [id]: name }`. Names are used as given, in the display language. Use it in a JS server.
- `decodeMapData(buffer)` reads the binary format below, which any language can write.
- `mapDataFromJson(json)` / `mapDataToJson(data)` for debugging.

`validateMapData(data)` throws `MapDataError` on structural problems. `createMap`, `encodeMapData` and the decoders call it.

## Coordinates

- SDE universe space is left-handed, Y up, meters. Scene space is right-handed, Y up: `scene = (x, y, -z)`.
- SDE `position2D` follows universe +z for its y axis, so it maps to scene `(x, 0, -y)`. Both layouts then share the same orientation: north is screen up when looking down.
- Each layout is centered on the origin and scaled uniformly so its largest half extent is 1. Both layouts appear the same size on screen and the GPU never sees values near 1e17.
- `position2d` stores scene `(x, z)` pairs, already converted and normalized.

## Data model

```ts
interface MapData {
  systems: {
    id: Int32Array // solarSystemID, ascending
    constellation: Int32Array
    region: Int32Array
    position: Float32Array // xyz per system, scene space, normalized
    position2d: Float32Array // xz per system, scene space, normalized
    security: Float32Array
    name: string[] // one display name per system
  }
  gates: Uint16Array // pairs of system indices, a < b, no duplicates
  regions: Record<number, string> // region ID to name
  constellations: Record<number, string> // constellation ID to name
  bounds: { position: Float32Array /* min xyz, max xyz */; position2d: Float32Array /* min xz, max xz */ }
}
```

Index `i` refers to the same system in every `systems` array. Gate indices are Uint16, so a map holds at most 65,536 systems; encoders and `buildMapData` fail loudly beyond that.

## Binary format

All values little-endian. Every section starts on a 4-byte boundary; pad with zeros. `n` = systems, `g` = gates, `r` = regions, `c` = constellations.

Header, 20 bytes:

| Offset | Type | Field |
| --- | --- | --- |
| 0 | 4 bytes | Magic `EVEM` (`0x45 0x56 0x45 0x4D`) |
| 4 | uint32 | `n` |
| 8 | uint32 | `g` (pairs) |
| 12 | uint32 | `r` |
| 16 | uint32 | `c` |

Sections, in order:

| Section | Type | Count |
| --- | --- | --- |
| `bounds.position` | float32 | 6 |
| `bounds.position2d` | float32 | 4 |
| `systems.id` | int32 | n |
| `systems.constellation` | int32 | n |
| `systems.region` | int32 | n |
| `systems.position` | float32 | 3n |
| `systems.position2d` | float32 | 2n |
| `systems.security` | float32 | n |
| `gates` | uint16 | 2g, then pad to 4 bytes |
| Region IDs | int32 | r |
| Constellation IDs | int32 | c |
| String table | see below | |

String table: uint32 `count` (`n + r + c`), then `count + 1` uint32 byte offsets into the UTF-8 data that follows (entry `i` spans `offsets[i]` to `offsets[i + 1]`), then the UTF-8 bytes. Order: system names, then region and constellation names in the order of their ID sections.

`decodeMapData` returns typed arrays that are views over the input buffer. A `Uint8Array` whose `byteOffset` is not 4-byte aligned (such as a pooled Node `Buffer`) is copied once.

The full known-space map (5,485 systems, 6,989 gates) is about 294 KB, 168 KB gzipped.

## Core API

```ts
import { createMap, securityColor } from '@eve-online-tools/eve-map'

const map = createMap(canvas, {
  data,
  view: '2d',
  transition: { duration: 600, easing: 'cubicInOut' },
  pixelRatio: Math.min(devicePixelRatio, 2),
  antialias: true,
  theme: { background: '#06080c', gate: '#2a3a4e', gateRegional: '#6e3f78', label: '#b7c3cf', highlight: '#fff', path: '#fc3' },
  systemStyle: { color: (i) => securityColor(data.systems.security[i]), size: 4 },
  labels: { mode: 'auto', max: 150 },
})

await map.setView('3d') // animated, interruptible
map.setHighlight([30000142])
map.setPath([30000142, 30000144, 30002187])
map.setMarkers([{ systemId: 30000142, color: '#fc3', size: 14, shape: 'diamond' }])
await map.focus(10000002) // region, constellation, system ID, list of system IDs, or { min, max } bounds

map.on('hover', ({ systemId, screen }) => {})
map.on('click', ({ systemId, index, originalEvent }) => {})

map.dispose()
```

Size the canvas with CSS. The drawing buffer follows its client size through a `ResizeObserver`.

| Method | |
| --- | --- |
| `setView(view, options?)` | `'2d'` or `'3d'`. Resolves when the transition ends or is superseded. |
| `setData(data)` | Rebuilds geometry. Highlight, path and markers are kept by system ID. |
| `setSystemStyle(partial)` | Uploads only changed attribute ranges, no geometry rebuild |
| `setHighlight(systemIds)` | Highlight ring and emphasized label |
| `setPath(systemIds)` | Route polyline, in order |
| `setMarkers(markers)` | `{ systemId, color?, size?, shape? }[]`, shapes `circle`, `ring`, `square`, `diamond`, `triangle` |
| `setTheme(partial)` / `setLabels(options)` | |
| `focus(target, options?)` | Fly to a target. `padding`, `viewHeight`, `duration`, `animate` |
| `getCamera()` / `setCamera(state, options?)` | `{ target, viewHeight, azimuth, polar }`. `viewHeight` is the world height visible at the target, independent of FOV. Rotation is locked to 0 in 2D. |
| `pick(x, y)` | Canvas CSS pixels to system index, or null |
| `project(systemId)` | `{ x, y, visible }` in canvas CSS pixels, for DOM overlays |
| `on(type, listener)` / `off` | `on` returns an unsubscribe function |
| `resize()` | Also automatic |
| `getStats()` | `{ frames, drawCalls }` |
| `dispose()` | Frees GPU resources, observers and listeners, and releases the WebGL context. Use a new canvas for a new map. |

Events: `hover`, `click`, `contextmenu` carry `{ systemId, index, screen: { x, y }, originalEvent }`, with `systemId: null` for empty space. Also `camerachange` (once per frame), `viewchange`, `contextlost`, `contextrestored`.

### Controls

| Input | 2D | 3D |
| --- | --- | --- |
| Drag | Pan | Orbit |
| Right or middle drag, Shift drag | Pan | Pan |
| Wheel | Zoom toward cursor | Zoom toward cursor |
| Pinch | Zoom and pan | Zoom and pan |
| Arrow keys | Pan | Pan, Shift + arrows orbit |
| `+` / `-` | Zoom | Zoom |
| Enter | Click the focused system | Click the focused system |

Keyboard navigation focuses the system nearest the view center. The canvas gets `tabindex="0"` unless it already has one. Pass `controls: { enabled: false }` or `controls: { keyboard: false }` to opt out.

## Styling

`systemStyle` fields accept a single value, a per-index array, or `(index) => value`. `color` also accepts a packed rgb `Float32Array` (length 3n, 0 to 1).

Color helpers compose into `systemStyle.color`:

- `securityColor(security)`: in-game palette, using in-game rounding (`roundSecurity`)
- `regionColor(regionId)`: stable color per ID
- `scaleColor(values, palette, { domain?, missing? })`: packed rgb along a gradient, for heat maps

```ts
map.setSystemStyle({ color: scaleColor(killsPerSystem, ['#1b2a49', '#f2c14e', '#e4572e']) })
```

Colors are CSS strings (`#rgb`, `#rrggbb`, `rgb()`, names in a browser), `0xrrggbb` numbers or `[r, g, b]` in 0 to 1, all sRGB.

## Labels

Labels are bitmap glyphs from a Canvas 2D atlas, drawn as one instanced draw call at a fixed screen size. `mode: 'auto'` places priority labels (hovered, highlighted, path, markers) first, then other on-screen systems without overlap, up to `max`, once few enough systems are on screen. `mode: 'priority'` only labels priority systems. `mode: 'none'` disables labels. `fontFamily` and `fontSize` are configurable.

## React

```tsx
import { EveMap } from '@eve-online-tools/eve-map/react'

<EveMap
  data={data}
  view={view}
  onViewChange={setView}
  markers={presence}
  highlight={selected}
  onSystemClick={(e) => select(e.systemId)}
  onSystemHover={(e) => setHovered(e.systemId)}
  fallback={<p>WebGL 2 is not available.</p>}
  style={{ height: 600 }}
>
  {(api) => <Tooltip system={hovered} position={api.project(hovered)} />}
</EveMap>
```

- Props map to the imperative setters. Arrays are compared by content, so inline arrays don't cause extra frames. Memoize `systemStyle`: a new object re-resolves every system's style (uploads still only cover changed ranges).
- `view` and `camera` are controlled when set (pair with `onViewChange` / `onCameraChange`), otherwise use `defaultView` / `defaultCamera`. With a controlled `view`, `api.setView` calls `onViewChange` instead of changing the map.
- A function child re-renders on every camera change, for positioning overlays with `api.project`. Other children can call `useEveMap()`.
- `pixelRatio`, `antialias`, `controls` and `reducedMotion` are read once at mount.
- Each mount creates its own canvas, so StrictMode double mounting doesn't reuse a released context.

## Resource use

- Renders on demand only. An idle map schedules no animation frames.
- Pauses while the canvas is offscreen (`IntersectionObserver`) or the document is hidden.
- One draw call per layer: gates, path, systems, markers, labels.
- The 2D/3D transition animates one uniform and the camera; the vertex shaders interpolate between both layouts.
- Style, highlight and marker updates upload changed ranges only.
- Picking projects systems on the CPU at most once per frame and queries a screen-space grid. No `readPixels`.
- `prefers-reduced-motion` makes transitions and fly-to instant. Override with `reducedMotion`.
- On `webglcontextlost` the map pauses and emits `contextlost`, then re-uploads resources after `webglcontextrestored`.

## Fallback

`isWebGL2Available()` probes support. `createMap` throws `WebGLUnavailableError` when it can't get a WebGL 2 context, and `<EveMap>` renders its `fallback` prop instead. There is no non-WebGL renderer.

## Development

```bash
pnpm --filter @eve-online-tools/eve-map test
pnpm --filter @eve-online-tools/eve-map typecheck
```

## License

MIT
