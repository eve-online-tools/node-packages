import { parseColor, securityColor, type ColorInput } from './colors'

/** A single value, a per-system-index array, or a function of the system index */
export type PerSystem<T> = T | ArrayLike<T> | ((index: number) => T)

export interface SystemStyle {
  /** Packed rgb `Float32Array` (length 3n), per-index colors, a function, or one color. Default: security color. */
  color?: PerSystem<ColorInput> | Float32Array
  /** Point diameter in CSS pixels. Default 4. */
  size?: PerSystem<number>
  /** Default true */
  visible?: PerSystem<boolean>
}

export const DEFAULT_SYSTEM_SIZE = 4

export const FLAG_HIDDEN = 1
export const FLAG_HIGHLIGHT = 2

const isColorTuple = (value: unknown): value is readonly [number, number, number] =>
  Array.isArray(value) && value.length === 3 && value.every((v) => typeof v === 'number')

const valueAt = <T>(input: PerSystem<T>, index: number, isScalar: (v: unknown) => boolean): T => {
  if (typeof input === 'function') {
    return (input as (i: number) => T)(index)
  }
  if (isScalar(input)) {
    return input as T
  }
  return (input as ArrayLike<T>)[index]
}

export const resolveColors = (
  input: SystemStyle['color'],
  security: Float32Array,
  out: Float32Array = new Float32Array(security.length * 3),
): Float32Array => {
  const n = security.length
  if (input instanceof Float32Array) {
    if (input.length !== n * 3) {
      throw new Error(`systemStyle.color: packed rgb must have length ${n * 3}, got ${input.length}.`)
    }
    out.set(input)
    return out
  }
  const isScalar = (v: unknown) => typeof v === 'string' || typeof v === 'number' || isColorTuple(v)
  // Parsing the same string 5k times is wasteful, cache per distinct input.
  const cache = new Map<ColorInput, readonly number[]>()
  for (let i = 0; i < n; i++) {
    let rgb: readonly number[]
    if (input === undefined) {
      rgb = securityColor(security[i])
    } else {
      const value = valueAt(input, i, isScalar)
      if (value === undefined || value === null) {
        rgb = securityColor(security[i])
      } else {
        rgb = cache.get(value) ?? parseColor(value)
        if (typeof value !== 'object') {
          cache.set(value, rgb)
        }
      }
    }
    out[i * 3] = rgb[0]
    out[i * 3 + 1] = rgb[1]
    out[i * 3 + 2] = rgb[2]
  }
  return out
}

export const resolveSizes = (input: SystemStyle['size'], n: number, out = new Float32Array(n)): Float32Array => {
  const isScalar = (v: unknown) => typeof v === 'number'
  for (let i = 0; i < n; i++) {
    const value = input === undefined ? DEFAULT_SYSTEM_SIZE : valueAt(input, i, isScalar)
    out[i] = typeof value === 'number' && Number.isFinite(value) ? value : DEFAULT_SYSTEM_SIZE
  }
  return out
}

/** Writes visibility and highlight into the flags bit field. */
export const resolveFlags = (
  visible: SystemStyle['visible'],
  highlighted: ReadonlySet<number>,
  n: number,
  out = new Float32Array(n),
): Float32Array => {
  const isScalar = (v: unknown) => typeof v === 'boolean'
  for (let i = 0; i < n; i++) {
    const isVisible = visible === undefined ? true : valueAt(visible, i, isScalar) !== false
    out[i] = (isVisible ? 0 : FLAG_HIDDEN) | (highlighted.has(i) ? FLAG_HIGHLIGHT : 0)
  }
  return out
}

export interface UpdateRange {
  /** First changed element (not item) */
  start: number
  /** Element count */
  count: number
}

/**
 * Compares two equally sized arrays item by item and returns the changed element ranges. Ranges separated by
 * fewer than `maxGap` unchanged items are merged, trading a few redundant bytes for fewer upload calls.
 */
export const diffRanges = (
  previous: ArrayLike<number>,
  next: ArrayLike<number>,
  itemSize = 1,
  maxGap = 16,
): UpdateRange[] => {
  if (previous.length !== next.length) {
    return [{ start: 0, count: next.length }]
  }
  const ranges: UpdateRange[] = []
  const items = next.length / itemSize
  let runStart = -1
  let lastChanged = -1

  for (let item = 0; item < items; item++) {
    let changed = false
    for (let c = 0; c < itemSize; c++) {
      const k = item * itemSize + c
      // `!==` alone treats NaN as always changed.
      if (previous[k] !== next[k] && !(Number.isNaN(previous[k]) && Number.isNaN(next[k]))) {
        changed = true
        break
      }
    }
    if (!changed) {
      continue
    }
    if (runStart === -1) {
      runStart = item
    } else if (item - lastChanged > maxGap) {
      ranges.push({ start: runStart * itemSize, count: (lastChanged - runStart + 1) * itemSize })
      runStart = item
    }
    lastChanged = item
  }
  if (runStart !== -1) {
    ranges.push({ start: runStart * itemSize, count: (lastChanged - runStart + 1) * itemSize })
  }
  return ranges
}
