import {
  BufferAttribute,
  CanvasTexture,
  DoubleSide,
  GLSL3,
  InstancedBufferGeometry,
  LinearFilter,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'

import type { PreparedMap } from '../prepare'
import type { Rgb } from '../colors'
import type { Projection } from '../projection'
import { labelsFragment, labelsVertex } from '../shaders'
import { DynamicAttributes } from './buffers'

export type LabelMode = 'auto' | 'priority' | 'none'

export interface LabelOptions {
  /** `auto`: priority labels plus as many others as fit. `priority`: highlighted, hovered, marked and path systems only. Default `auto`. */
  mode?: LabelMode
  /** Upper bound on drawn labels. Default 150. */
  max?: number
  /** CSS font family. Default `system-ui, sans-serif`. */
  fontFamily?: string
  /** CSS pixels. Default 11. */
  fontSize?: number
}

interface Glyph {
  u0: number
  v0: number
  u1: number
  v1: number
  /** CSS px, including halo padding */
  width: number
  advance: number
}

const ATLAS_WIDTH = 1024
const ATLAS_HEIGHT = 512
const MAX_LABEL_CHARS = 32
/** Labels other than priority ones only show when at most this many times `max` systems are on screen. */
const AUTO_DENSITY = 3

/** Bitmap glyph atlas rendered with Canvas 2D at device resolution. Labels are fixed screen size, so no SDF needed. */
class GlyphAtlas {
  readonly canvas: HTMLCanvasElement
  readonly texture: CanvasTexture
  readonly lineHeight: number
  private readonly context: CanvasRenderingContext2D
  private readonly glyphs = new Map<string, Glyph | null>()
  private readonly pad: number
  private cursorX = 0
  private cursorY = 0

  static create(scale: number, fontFamily: string, fontSize: number): GlyphAtlas | null {
    if (typeof document === 'undefined') {
      return null
    }
    const canvas = document.createElement('canvas')
    let context: CanvasRenderingContext2D | null = null
    try {
      context = canvas.getContext('2d')
    } catch {
      context = null
    }
    return context ? new GlyphAtlas(canvas, context, scale, fontFamily, fontSize) : null
  }

  private constructor(
    canvas: HTMLCanvasElement,
    context: CanvasRenderingContext2D,
    private readonly scale: number,
    fontFamily: string,
    fontSize: number,
  ) {
    this.canvas = canvas
    this.context = context
    canvas.width = ATLAS_WIDTH
    canvas.height = ATLAS_HEIGHT
    this.pad = Math.ceil(2 * scale)
    this.lineHeight = Math.ceil(fontSize * 1.3 * scale) + this.pad * 2
    context.font = `500 ${fontSize * scale}px ${fontFamily}`
    context.textBaseline = 'middle'
    context.lineJoin = 'round'
    context.lineWidth = this.pad * 1.5
    context.strokeStyle = '#000'
    context.fillStyle = '#fff'
    this.texture = new CanvasTexture(canvas)
    this.texture.generateMipmaps = false
    this.texture.minFilter = LinearFilter
    this.texture.magFilter = LinearFilter
  }

  /** Returns true when new glyphs were drawn. */
  ensure(text: string): boolean {
    let changed = false
    for (const char of text) {
      if (!this.glyphs.has(char)) {
        this.glyphs.set(char, this.draw(char))
        changed = true
      }
    }
    if (changed) {
      this.texture.needsUpdate = true
    }
    return changed
  }

  glyph(char: string): Glyph | null {
    return this.glyphs.get(char) ?? null
  }

  measure(text: string): number {
    let width = 0
    for (const char of text) {
      width += this.glyphs.get(char)?.advance ?? 0
    }
    return width
  }

  private draw(char: string): Glyph | null {
    const advancePx = this.context.measureText(char).width
    const cellWidth = Math.ceil(advancePx) + this.pad * 2
    if (this.cursorX + cellWidth > ATLAS_WIDTH) {
      this.cursorX = 0
      this.cursorY += this.lineHeight
    }
    if (this.cursorY + this.lineHeight > ATLAS_HEIGHT) {
      return null
    }
    const x = this.cursorX
    const y = this.cursorY
    const middle = y + this.lineHeight / 2
    this.context.strokeText(char, x + this.pad, middle)
    this.context.fillText(char, x + this.pad, middle)
    this.cursorX += cellWidth + 1
    return {
      u0: x / ATLAS_WIDTH,
      u1: (x + cellWidth) / ATLAS_WIDTH,
      // CanvasTexture flips Y on upload.
      v0: 1 - y / ATLAS_HEIGHT,
      v1: 1 - (y + this.lineHeight) / ATLAS_HEIGHT,
      width: cellWidth / this.scale,
      advance: advancePx / this.scale,
    }
  }

  dispose(): void {
    this.texture.dispose()
  }
}

const createQuadGeometry = (): InstancedBufferGeometry => {
  const geometry = new InstancedBufferGeometry()
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]), 3))
  geometry.setIndex([0, 1, 2, 0, 2, 3])
  geometry.instanceCount = 0
  return geometry
}

export interface LabelLayoutInput {
  data: PreparedMap
  projection: Projection
  /** Point diameters in CSS px */
  sizes: Float32Array
  sizeScale: number
  /** Always considered first, in order */
  priority: readonly number[]
  width: number
  height: number
}

export class LabelsLayer {
  readonly object: Mesh<InstancedBufferGeometry, ShaderMaterial>
  /** System indices labelled in the last layout */
  shown: number[] = []
  private atlas: GlyphAtlas | null = null
  private atlasScale = 0
  private readonly buffers = new DynamicAttributes(
    [
      { name: 'aAnchor', itemSize: 3 },
      { name: 'aAnchor2d', itemSize: 2 },
      { name: 'aRect', itemSize: 4 },
      { name: 'aUv', itemSize: 4 },
      { name: 'aEmphasis', itemSize: 1 },
    ],
    true,
    createQuadGeometry,
  )
  private options: Required<LabelOptions>

  constructor(options: LabelOptions, color: Rgb, emphasis: Rgb, halo: Rgb) {
    this.options = this.resolveOptions(options)
    this.buffers.reserve(0)
    const material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: labelsVertex,
      fragmentShader: labelsFragment,
      transparent: true,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uMorph: { value: 0 },
        uViewport: { value: new Vector2(1, 1) },
        uAtlas: { value: null },
        uColor: { value: new Vector3(...color) },
        uEmphasisColor: { value: new Vector3(...emphasis) },
        uHalo: { value: new Vector3(...halo) },
      },
    })
    this.object = new Mesh(this.buffers.geometry as InstancedBufferGeometry, material)
    this.object.frustumCulled = false
    this.object.renderOrder = 4
    this.object.visible = false
  }

  get uniforms() {
    return this.object.material.uniforms
  }

  private resolveOptions(options: LabelOptions): Required<LabelOptions> {
    return {
      mode: options.mode ?? 'auto',
      max: Math.max(0, options.max ?? 150),
      fontFamily: options.fontFamily ?? 'system-ui, sans-serif',
      fontSize: options.fontSize ?? 11,
    }
  }

  setOptions(options: LabelOptions): void {
    const next = this.resolveOptions(options)
    const fontChanged = next.fontFamily !== this.options.fontFamily || next.fontSize !== this.options.fontSize
    this.options = next
    if (fontChanged) {
      this.atlas?.dispose()
      this.atlas = null
    }
  }

  private ensureAtlas(scale: number): GlyphAtlas | null {
    if (this.atlas && this.atlasScale === scale) {
      return this.atlas
    }
    this.atlas?.dispose()
    this.atlas = GlyphAtlas.create(scale, this.options.fontFamily, this.options.fontSize)
    this.atlasScale = scale
    this.uniforms.uAtlas.value = this.atlas?.texture ?? null
    return this.atlas
  }

  /** Picks labels with screen-space collision and writes glyph instances. */
  update(input: LabelLayoutInput, pixelRatio: number): void {
    const { mode, max } = this.options
    const atlas = mode === 'none' || max === 0 ? null : this.ensureAtlas(pixelRatio)
    if (!atlas) {
      this.shown = []
      this.object.visible = false
      return
    }

    const { data, projection, sizes, sizeScale, priority, width, height } = input
    const names = data.name
    const candidates: number[] = []
    const seen = new Set<number>()
    const push = (i: number) => {
      if (!seen.has(i) && projection.visible[i]) {
        seen.add(i)
        candidates.push(i)
      }
    }
    priority.forEach(push)
    const priorityCount = candidates.length
    if (mode === 'auto' && projection.visibleCount <= max * AUTO_DENSITY) {
      // Previous labels first keeps placement stable while the camera moves.
      this.shown.forEach(push)
      for (let i = 0; i < projection.visible.length; i++) {
        push(i)
      }
    }

    const lineHeight = atlas.lineHeight / pixelRatio
    const placed: number[] = []
    const rects: Array<[number, number, number, number]> = []
    const cell = 96
    const columns = Math.max(1, Math.ceil(width / cell))
    const occupancy = new Map<number, number[]>()
    let glyphCount = 0

    for (let c = 0; c < candidates.length && placed.length < max; c++) {
      const i = candidates[c]
      const text = names[i].length > MAX_LABEL_CHARS ? `${names[i].slice(0, MAX_LABEL_CHARS - 1)}…` : names[i]
      atlas.ensure(text)
      const textWidth = atlas.measure(text)
      const x0 = projection.x[i] + (sizes[i] * sizeScale) / 2 + 3
      const y0 = projection.y[i] - lineHeight / 2
      const rect: [number, number, number, number] = [x0, y0, x0 + textWidth + 4, y0 + lineHeight]
      if (rect[0] > width || rect[2] < 0 || rect[1] > height || rect[3] < 0) {
        continue
      }

      const cx0 = Math.max(0, Math.floor(rect[0] / cell))
      const cx1 = Math.max(0, Math.floor(rect[2] / cell))
      const cy0 = Math.max(0, Math.floor(rect[1] / cell))
      const cy1 = Math.max(0, Math.floor(rect[3] / cell))
      let blocked = false
      for (let cy = cy0; cy <= cy1 && !blocked; cy++) {
        for (let cx = cx0; cx <= cx1 && !blocked; cx++) {
          for (const r of occupancy.get(cy * columns + cx) ?? []) {
            const o = rects[r]
            if (rect[0] < o[2] && rect[2] > o[0] && rect[1] < o[3] && rect[3] > o[1]) {
              blocked = true
              break
            }
          }
        }
      }
      // Priority labels may overlap each other, never skip them.
      if (blocked && c >= priorityCount) {
        continue
      }
      const r = rects.push(rect) - 1
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const key = cy * columns + cx
          const list = occupancy.get(key)
          if (list) {
            list.push(r)
          } else {
            occupancy.set(key, [r])
          }
        }
      }
      placed.push(i)
      glyphCount += text.length
    }

    if (this.buffers.reserve(glyphCount)) {
      this.object.geometry = this.buffers.geometry as InstancedBufferGeometry
    }
    const anchor = this.buffers.array('aAnchor')
    const anchor2d = this.buffers.array('aAnchor2d')
    const rectAttr = this.buffers.array('aRect')
    const uv = this.buffers.array('aUv')
    const emphasis = this.buffers.array('aEmphasis')
    const prioritySet = new Set(priority)
    let g = 0

    for (const i of placed) {
      const text = names[i].length > MAX_LABEL_CHARS ? `${names[i].slice(0, MAX_LABEL_CHARS - 1)}…` : names[i]
      let x = (sizes[i] * sizeScale) / 2 + 3
      for (const char of text) {
        const glyph = atlas.glyph(char)
        if (!glyph) {
          continue
        }
        anchor.set(data.position.subarray(i * 3, i * 3 + 3), g * 3)
        anchor2d.set(data.position2d.subarray(i * 2, i * 2 + 2), g * 2)
        rectAttr[g * 4] = x - 2
        rectAttr[g * 4 + 1] = -lineHeight / 2
        rectAttr[g * 4 + 2] = glyph.width
        rectAttr[g * 4 + 3] = lineHeight
        uv[g * 4] = glyph.u0
        uv[g * 4 + 1] = glyph.v0
        uv[g * 4 + 2] = glyph.u1
        uv[g * 4 + 3] = glyph.v1
        emphasis[g] = prioritySet.has(i) ? 1 : 0
        x += glyph.advance
        g++
      }
    }

    this.shown = placed
    this.buffers.commit(g)
    this.object.geometry.instanceCount = g
    this.object.visible = g > 0
  }

  dispose(): void {
    this.atlas?.dispose()
    this.atlas = null
    this.buffers.dispose()
    this.object.material.dispose()
  }
}
