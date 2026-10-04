/** sRGB components in 0..1 */
export type Rgb = [number, number, number]

/** `#rgb`, `#rrggbb`, `rgb()`/`rgba()`, a CSS color name (needs a DOM), `0xrrggbb` or `[r, g, b]` in 0..1 */
export type ColorInput = string | number | readonly [number, number, number]

const hexToRgb = (hex: number): Rgb => [((hex >> 16) & 255) / 255, ((hex >> 8) & 255) / 255, (hex & 255) / 255]

let namedColorContext: CanvasRenderingContext2D | null | undefined

const parseNamedColor = (value: string): Rgb | null => {
  if (namedColorContext === undefined) {
    namedColorContext = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d')
  }
  if (!namedColorContext) {
    return null
  }
  namedColorContext.fillStyle = '#000'
  namedColorContext.fillStyle = value
  const normalized = namedColorContext.fillStyle
  return normalized === value ? null : parseColorString(normalized)
}

const parseColorString = (value: string): Rgb | null => {
  const s = value.trim().toLowerCase()
  if (s.startsWith('#')) {
    const hex = s.slice(1)
    if (/^[0-9a-f]{3}$/.test(hex)) {
      return hexToRgb(Number.parseInt([...hex].map((c) => c + c).join(''), 16))
    }
    if (/^[0-9a-f]{6}([0-9a-f]{2})?$/.test(hex)) {
      return hexToRgb(Number.parseInt(hex.slice(0, 6), 16))
    }
    return null
  }
  const match = /^rgba?\(([^)]+)\)$/.exec(s)
  if (match) {
    const parts = match[1].split(/[\s,/]+/).filter(Boolean)
    if (parts.length < 3) {
      return null
    }
    const channel = (part: string) =>
      part.endsWith('%') ? Number.parseFloat(part) / 100 : Number.parseFloat(part) / 255
    return [channel(parts[0]), channel(parts[1]), channel(parts[2])]
  }
  return null
}

/** Throws on unparseable input. */
export const parseColor = (value: ColorInput): Rgb => {
  if (typeof value === 'number') {
    return hexToRgb(value)
  }
  if (typeof value !== 'string') {
    return [value[0], value[1], value[2]]
  }
  const rgb = parseColorString(value) ?? parseNamedColor(value)
  if (!rgb) {
    throw new Error(`Unrecognized color "${value}".`)
  }
  return rgb
}

/** Security status as shown in game: one decimal, and anything in (0, 0.05) shows as 0.1. */
export const roundSecurity = (security: number): number => {
  if (security > 0 && security < 0.05) {
    return 0.1
  }
  return Math.round(security * 10) / 10
}

const SECURITY_PALETTE = [
  0x8d3264, // 0.0 and below
  0x722020,
  0xbc1117,
  0xce440f,
  0xdc6d07,
  0xf3fd82,
  0x71e554,
  0x60dba3,
  0x4ecef8,
  0x3a9aeb,
  0x2c74e0, // 1.0
].map(hexToRgb)

/** In-game security status color */
export const securityColor = (security: number): Rgb => {
  const step = Math.min(10, Math.max(0, Math.round(roundSecurity(security) * 10)))
  return [...SECURITY_PALETTE[step]] as Rgb
}

const hslToRgb = (h: number, s: number, l: number): Rgb => {
  const a = s * Math.min(l, 1 - l)
  const f = (n: number) => {
    const k = (n + h * 12) % 12
    return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))
  }
  return [f(0), f(8), f(4)]
}

/** Stable, well spread color per region (or any integer ID) */
export const regionColor = (regionId: number): Rgb => {
  let hash = regionId | 0
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b)
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b)
  hash ^= hash >>> 16
  const unit = (hash >>> 0) / 0xffffffff
  return hslToRgb(unit, 0.6, 0.6)
}

export interface ScaleColorOptions {
  /** Default: min and max of the finite values */
  domain?: readonly [number, number]
  /** Color for non-finite values. Default: first palette color */
  missing?: ColorInput
}

/**
 * Maps each value onto a linear gradient through `palette`. Returns packed rgb (length `3 * values.length`),
 * directly usable as `systemStyle.color`.
 */
export const scaleColor = (
  values: ArrayLike<number>,
  palette: readonly ColorInput[],
  options: ScaleColorOptions = {},
): Float32Array => {
  if (palette.length === 0) {
    throw new Error('scaleColor: palette must not be empty.')
  }
  const stops = palette.map(parseColor)
  let [min, max] = options.domain ?? [Infinity, -Infinity]
  if (!options.domain) {
    for (let i = 0; i < values.length; i++) {
      if (Number.isFinite(values[i])) {
        min = Math.min(min, values[i])
        max = Math.max(max, values[i])
      }
    }
  }
  const missing = options.missing === undefined ? stops[0] : parseColor(options.missing)
  const span = max - min
  const out = new Float32Array(values.length * 3)

  for (let i = 0; i < values.length; i++) {
    const v = values[i]
    let rgb: Rgb
    if (!Number.isFinite(v)) {
      rgb = missing
    } else if (stops.length === 1 || !(span > 0)) {
      rgb = stops[0]
    } else {
      const t = Math.min(1, Math.max(0, (v - min) / span)) * (stops.length - 1)
      const k = Math.min(stops.length - 2, Math.floor(t))
      const f = t - k
      const a = stops[k]
      const b = stops[k + 1]
      rgb = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
    }
    out[i * 3] = rgb[0]
    out[i * 3 + 1] = rgb[1]
    out[i * 3 + 2] = rgb[2]
  }
  return out
}
