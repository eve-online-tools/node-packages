import { FLAG_HIDDEN } from './style'

/** Screen-space projection of every system, CSS pixels with origin top-left. */
export interface Projection {
  x: Float32Array
  y: Float32Array
  /** NDC depth, -1 near to 1 far */
  depth: Float32Array
  /** 1 when in front of the camera, inside the viewport and not hidden */
  visible: Uint8Array
  visibleCount: number
}

export const createProjection = (n: number): Projection => ({
  x: new Float32Array(n),
  y: new Float32Array(n),
  depth: new Float32Array(n),
  visible: new Uint8Array(n),
  visibleCount: 0,
})

/** Morphed scene position of system `i` */
export const morphPosition = (
  position: Float32Array,
  position2d: Float32Array,
  morph: number,
  i: number,
  out: [number, number, number] = [0, 0, 0],
): [number, number, number] => {
  out[0] = position2d[i * 2] + (position[i * 3] - position2d[i * 2]) * morph
  out[1] = position[i * 3 + 1] * morph
  out[2] = position2d[i * 2 + 1] + (position[i * 3 + 2] - position2d[i * 2 + 1]) * morph
  return out
}

/**
 * Projects all systems with a column-major view-projection matrix. `margin` keeps points slightly outside the
 * viewport so labels and picking don't pop at the edges.
 */
export const projectSystems = (
  out: Projection,
  position: Float32Array,
  position2d: Float32Array,
  flags: Float32Array,
  morph: number,
  m: ArrayLike<number>,
  width: number,
  height: number,
  margin = 16,
): Projection => {
  const n = flags.length
  let visibleCount = 0
  for (let i = 0; i < n; i++) {
    const px = position2d[i * 2] + (position[i * 3] - position2d[i * 2]) * morph
    const py = position[i * 3 + 1] * morph
    const pz = position2d[i * 2 + 1] + (position[i * 3 + 2] - position2d[i * 2 + 1]) * morph

    const cx = m[0] * px + m[4] * py + m[8] * pz + m[12]
    const cy = m[1] * px + m[5] * py + m[9] * pz + m[13]
    const cz = m[2] * px + m[6] * py + m[10] * pz + m[14]
    const cw = m[3] * px + m[7] * py + m[11] * pz + m[15]

    if (cw <= 1e-9) {
      out.visible[i] = 0
      continue
    }
    const sx = ((cx / cw) * 0.5 + 0.5) * width
    const sy = (0.5 - (cy / cw) * 0.5) * height
    const sz = cz / cw
    out.x[i] = sx
    out.y[i] = sy
    out.depth[i] = sz
    const inView =
      sz >= -1 && sz <= 1 && sx >= -margin && sx <= width + margin && sy >= -margin && sy <= height + margin
    const isVisible = inView && (flags[i] & FLAG_HIDDEN) === 0
    out.visible[i] = isVisible ? 1 : 0
    if (isVisible) {
      visibleCount++
    }
  }
  out.visibleCount = visibleCount
  return out
}

/** Uniform screen grid over visible systems for O(1) neighborhood queries. */
export interface ScreenGrid {
  cellSize: number
  columns: number
  rows: number
  /** Start offset into `items` per cell, length `columns * rows + 1` */
  cellStart: Uint32Array
  items: Uint32Array
}

export const buildScreenGrid = (projection: Projection, width: number, height: number, cellSize = 32): ScreenGrid => {
  const columns = Math.max(1, Math.ceil(width / cellSize))
  const rows = Math.max(1, Math.ceil(height / cellSize))
  const cellCount = columns * rows
  const counts = new Uint32Array(cellCount + 1)
  const n = projection.visible.length
  const cellOf = new Int32Array(n).fill(-1)

  for (let i = 0; i < n; i++) {
    if (!projection.visible[i]) {
      continue
    }
    const cx = clampIndex(Math.floor(projection.x[i] / cellSize), columns)
    const cy = clampIndex(Math.floor(projection.y[i] / cellSize), rows)
    const cell = cy * columns + cx
    cellOf[i] = cell
    counts[cell + 1]++
  }
  for (let c = 0; c < cellCount; c++) {
    counts[c + 1] += counts[c]
  }
  const cursor = counts.slice(0, cellCount)
  const items = new Uint32Array(counts[cellCount])
  for (let i = 0; i < n; i++) {
    if (cellOf[i] >= 0) {
      items[cursor[cellOf[i]]++] = i
    }
  }
  return { cellSize, columns, rows, cellStart: counts, items }
}

const clampIndex = (value: number, size: number): number => Math.min(size - 1, Math.max(0, value))

/**
 * Nearest visible system within `radius` px of `(x, y)`, or null. Ties within 1px prefer the one nearer the camera.
 */
export const queryNearest = (
  grid: ScreenGrid,
  projection: Projection,
  x: number,
  y: number,
  radius: number,
): number | null => {
  const minCx = clampIndex(Math.floor((x - radius) / grid.cellSize), grid.columns)
  const maxCx = clampIndex(Math.floor((x + radius) / grid.cellSize), grid.columns)
  const minCy = clampIndex(Math.floor((y - radius) / grid.cellSize), grid.rows)
  const maxCy = clampIndex(Math.floor((y + radius) / grid.cellSize), grid.rows)
  let best: number | null = null
  let bestDistance = radius * radius
  let bestDepth = Infinity

  for (let cy = minCy; cy <= maxCy; cy++) {
    for (let cx = minCx; cx <= maxCx; cx++) {
      const cell = cy * grid.columns + cx
      for (let k = grid.cellStart[cell]; k < grid.cellStart[cell + 1]; k++) {
        const i = grid.items[k]
        const dx = projection.x[i] - x
        const dy = projection.y[i] - y
        const d = dx * dx + dy * dy
        if (d > radius * radius) {
          continue
        }
        const nearlyTied = best !== null && Math.abs(Math.sqrt(d) - Math.sqrt(bestDistance)) < 1
        if (nearlyTied ? projection.depth[i] < bestDepth : d < bestDistance) {
          best = i
          bestDistance = d
          bestDepth = projection.depth[i]
        }
      }
    }
  }
  return best
}
