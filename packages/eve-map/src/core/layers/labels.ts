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

import type { Rgb } from '../colors'
import type { GroupAnchors, PreparedMap } from '../prepare'
import { createProjection, projectSystems, type Projection } from '../projection'
import { labelsFragment, labelsVertex } from '../shaders'
import { DynamicAttributes } from './buffers'

export interface LabelOptions {
  /** Region names at the center of their systems. `true` always, a number shows them below that zoom. Default off. */
  regions?: boolean | number
  /** Constellation names at the center of their systems. `true` always, `[min, max]` between those zooms. Default off. */
  constellations?: boolean | readonly [number, number]
  /**
   * System names. `true` all, a number above that zoom, `false` none. Hovered, highlighted, path and marker systems
   * are labelled unless `false`. Default: those only.
   */
  systems?: boolean | number
  /** Upper bound on drawn labels. Default 150. */
  max?: number
  /** CSS font family. Default `system-ui, sans-serif`. */
  fontFamily?: string
  /** System label size in CSS px. Region labels are 1.35 times larger. Default 11. */
  fontSize?: number
}

export interface LabelColors {
  system: Rgb
  emphasis: Rgb
  constellation: Rgb
  region: Rgb
  halo: Rgb
}

/** Milliseconds for labels to fade in or out */
export const LABEL_FADE = 200

export const regionLabelsVisible = (setting: LabelOptions['regions'], zoom: number): boolean =>
  setting === true || (typeof setting === 'number' && zoom < setting)

export const constellationLabelsVisible = (setting: LabelOptions['constellations'], zoom: number): boolean =>
  setting === true || (Array.isArray(setting) && zoom > setting[0] && zoom < setting[1])

export const systemLabelsVisible = (setting: LabelOptions['systems'], zoom: number): boolean =>
  setting === true || (typeof setting === 'number' && zoom > setting)

type Kind = 'system' | 'constellation' | 'region'

interface Style {
  font: string
  lineHeight: number
  /** Extra advance per glyph, CSS px */
  tracking: number
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

const ATLAS_SIZE = 1024
const MAX_LABEL_CHARS = 32
const KINDS: readonly Kind[] = ['system', 'constellation', 'region']

/** Bitmap glyph atlas rendered with Canvas 2D at device resolution. Labels are fixed screen size, so no SDF needed. */
class GlyphAtlas {
  readonly texture: CanvasTexture
  readonly styles: Record<Kind, Style>
  private readonly glyphs = new Map<string, Glyph | null>()
  private readonly pad: number
  private readonly rowHeight: number
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
    private readonly context: CanvasRenderingContext2D,
    private readonly scale: number,
    fontFamily: string,
    fontSize: number,
  ) {
    canvas.width = ATLAS_SIZE
    canvas.height = ATLAS_SIZE
    this.pad = Math.ceil(2 * scale)
    const style = (weight: string, size: number, tracking: number): Style => ({
      font: `${weight} ${size * scale}px ${fontFamily}`,
      lineHeight: Math.ceil(size * 1.3 * scale) + this.pad * 2,
      tracking,
    })
    this.styles = {
      system: style('500', fontSize, 0),
      constellation: style('italic 500', fontSize, 0),
      region: style('600', Math.round(fontSize * 1.35), 1.5),
    }
    this.rowHeight = Math.max(...KINDS.map((kind) => this.styles[kind].lineHeight))
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

  /** CSS px */
  lineHeight(kind: Kind): number {
    return this.styles[kind].lineHeight / this.scale
  }

  ensure(kind: Kind, text: string): void {
    for (const char of text) {
      const key = kind + char
      if (!this.glyphs.has(key)) {
        this.glyphs.set(key, this.draw(kind, char))
        this.texture.needsUpdate = true
      }
    }
  }

  glyph(kind: Kind, char: string): Glyph | null {
    return this.glyphs.get(kind + char) ?? null
  }

  measure(kind: Kind, text: string): number {
    let width = 0
    for (const char of text) {
      width += (this.glyph(kind, char)?.advance ?? 0) + this.styles[kind].tracking
    }
    return width
  }

  private draw(kind: Kind, char: string): Glyph | null {
    const { font, lineHeight } = this.styles[kind]
    this.context.font = font
    const advancePx = this.context.measureText(char).width
    const cellWidth = Math.ceil(advancePx) + this.pad * 2
    if (this.cursorX + cellWidth > ATLAS_SIZE) {
      this.cursorX = 0
      this.cursorY += this.rowHeight
    }
    if (this.cursorY + this.rowHeight > ATLAS_SIZE) {
      return null
    }
    const x = this.cursorX
    const y = this.cursorY
    const middle = y + lineHeight / 2
    this.context.strokeText(char, x + this.pad, middle)
    this.context.fillText(char, x + this.pad, middle)
    this.cursorX += cellWidth + 1
    return {
      u0: x / ATLAS_SIZE,
      u1: (x + cellWidth) / ATLAS_SIZE,
      // CanvasTexture flips Y on upload.
      v0: 1 - y / ATLAS_SIZE,
      v1: 1 - (y + lineHeight) / ATLAS_SIZE,
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

const truncate = (text: string) => (text.length > MAX_LABEL_CHARS ? `${text.slice(0, MAX_LABEL_CHARS - 1)}…` : text)

export interface LabelLayoutInput {
  data: PreparedMap
  projection: Projection
  /** Column-major view-projection matrix */
  matrix: ArrayLike<number>
  morph: number
  zoom: number
  /** Point diameters in CSS px */
  sizes: Float32Array
  sizeScale: number
  /** Always considered first, in order */
  priority: readonly number[]
  width: number
  height: number
  pixelRatio: number
  /** `performance.now()` style timestamp */
  now: number
  /** Fade duration in ms, 0 for instant */
  fade: number
}

interface Label {
  kind: Kind
  /** System index, or index into the region or constellation anchors */
  ref: number
  alpha: number
  visible: boolean
  emphasis: boolean
}

export class LabelsLayer {
  readonly object: Mesh<InstancedBufferGeometry, ShaderMaterial>
  private atlas: GlyphAtlas | null = null
  private atlasScale = 0
  private readonly buffers = new DynamicAttributes(
    [
      { name: 'aAnchor', itemSize: 3 },
      { name: 'aAnchor2d', itemSize: 2 },
      { name: 'aRect', itemSize: 4 },
      { name: 'aUv', itemSize: 4 },
      { name: 'aColor', itemSize: 3 },
      { name: 'aAlpha', itemSize: 1 },
    ],
    true,
    createQuadGeometry,
  )
  private options: Required<Pick<LabelOptions, 'max' | 'fontFamily' | 'fontSize'>> & LabelOptions
  private readonly labels = new Map<string, Label>()
  private lastNow: number | null = null
  private regionProjection = createProjection(0)
  private constellationProjection = createProjection(0)

  constructor(
    options: LabelOptions,
    private colors: LabelColors,
  ) {
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
        uHalo: { value: new Vector3(...colors.halo) },
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

  private resolveOptions(options: LabelOptions) {
    return {
      ...options,
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

  setColors(colors: LabelColors): void {
    this.colors = colors
    this.uniforms.uHalo.value.set(...colors.halo)
  }

  /** Forgets label state, for new data. */
  reset(): void {
    this.labels.clear()
    this.lastNow = null
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

  private anchors(kind: Kind, data: PreparedMap): GroupAnchors | null {
    return kind === 'region' ? data.regions : kind === 'constellation' ? data.constellations : null
  }

  private text(kind: Kind, ref: number, data: PreparedMap): string {
    const name = kind === 'system' ? data.name[ref] : this.anchors(kind, data)!.name[ref]
    return truncate(kind === 'region' ? name.toUpperCase() : name)
  }

  /** Lays out labels with screen-space collision, advances fades and writes glyph instances. Returns true while fading. */
  update(input: LabelLayoutInput): boolean {
    const { data, projection, sizes, sizeScale, priority, width, height, zoom } = input
    const { max, systems: systemSetting } = this.options
    const atlas = max === 0 ? null : this.ensureAtlas(input.pixelRatio)
    if (!atlas) {
      this.labels.clear()
      this.object.visible = false
      return false
    }

    const project = (anchors: GroupAnchors, out: Projection): Projection => {
      const n = anchors.id.length
      const target = out.x.length === n ? out : createProjection(n)
      projectSystems(
        target,
        anchors.position,
        anchors.position2d,
        new Float32Array(n),
        input.morph,
        input.matrix,
        width,
        height,
      )
      return target
    }

    // Candidates in placement order. Priority labels always place; the rest give way on overlap.
    const candidates: Array<{ kind: Kind; ref: number; x: number; y: number; forced: boolean }> = []
    const seen = new Set<string>()
    const add = (kind: Kind, ref: number, x: number, y: number, forced = false) => {
      const key = kind + ref
      if (!seen.has(key)) {
        seen.add(key)
        candidates.push({ kind, ref, x, y, forced })
      }
    }
    if (systemSetting !== false) {
      for (const i of priority) {
        if (projection.visible[i]) {
          add('system', i, projection.x[i], projection.y[i], true)
        }
      }
    }
    if (regionLabelsVisible(this.options.regions, zoom)) {
      this.regionProjection = project(data.regions, this.regionProjection)
      const p = this.regionProjection
      data.regions.id.forEach((_, g) => p.visible[g] && add('region', g, p.x[g], p.y[g]))
    }
    if (constellationLabelsVisible(this.options.constellations, zoom)) {
      this.constellationProjection = project(data.constellations, this.constellationProjection)
      const p = this.constellationProjection
      data.constellations.id.forEach((_, g) => p.visible[g] && add('constellation', g, p.x[g], p.y[g]))
    }
    if (systemLabelsVisible(systemSetting, zoom)) {
      // Labels already shown first keeps placement stable while the camera moves.
      for (const label of this.labels.values()) {
        if (label.kind === 'system' && label.visible && projection.visible[label.ref]) {
          add('system', label.ref, projection.x[label.ref], projection.y[label.ref])
        }
      }
      for (let i = 0; i < projection.visible.length; i++) {
        if (projection.visible[i]) {
          add('system', i, projection.x[i], projection.y[i])
        }
      }
    }

    const cell = 96
    const columns = Math.max(1, Math.ceil(width / cell))
    const occupancy = new Map<number, Array<[number, number, number, number]>>()
    const placed = new Set<string>()
    for (const candidate of candidates) {
      if (placed.size >= max) {
        break
      }
      const { kind, ref, x, y } = candidate
      const text = this.text(kind, ref, data)
      atlas.ensure(kind, text)
      const textWidth = atlas.measure(kind, text)
      const lineHeight = atlas.lineHeight(kind)
      const x0 = kind === 'system' ? x + (sizes[ref] * sizeScale) / 2 + 1 : x - textWidth / 2 - 2
      const rect: [number, number, number, number] = [x0, y - lineHeight / 2, x0 + textWidth + 4, y + lineHeight / 2]
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
          blocked = (occupancy.get(cy * columns + cx) ?? []).some(
            (o) => rect[0] < o[2] && rect[2] > o[0] && rect[1] < o[3] && rect[3] > o[1],
          )
        }
      }
      if (blocked && !candidate.forced) {
        continue
      }
      for (let cy = cy0; cy <= cy1; cy++) {
        for (let cx = cx0; cx <= cx1; cx++) {
          const key = cy * columns + cx
          const list = occupancy.get(key)
          if (list) {
            list.push(rect)
          } else {
            occupancy.set(key, [rect])
          }
        }
      }
      const key = kind + ref
      placed.add(key)
      let label = this.labels.get(key)
      if (!label) {
        label = { kind, ref, alpha: 0, visible: true, emphasis: false }
        this.labels.set(key, label)
      }
      label.emphasis = candidate.forced
    }

    // Fades only advance between consecutive animated frames, so an idle gap doesn't skip them.
    const dt = this.lastNow === null ? 0 : Math.min(100, input.now - this.lastNow)
    const step = input.fade > 0 ? dt / input.fade : 1
    let animating = false
    for (const [key, label] of this.labels) {
      label.visible = placed.has(key)
      label.alpha = label.visible ? Math.min(1, label.alpha + step) : Math.max(0, label.alpha - step)
      if (!label.visible && label.alpha === 0) {
        this.labels.delete(key)
      } else if (label.alpha !== (label.visible ? 1 : 0)) {
        animating = true
      }
    }
    this.lastNow = animating ? input.now : null

    let glyphCount = 0
    for (const label of this.labels.values()) {
      glyphCount += this.text(label.kind, label.ref, data).length
    }
    if (this.buffers.reserve(glyphCount)) {
      this.object.geometry = this.buffers.geometry as InstancedBufferGeometry
    }
    const anchor = this.buffers.array('aAnchor')
    const anchor2d = this.buffers.array('aAnchor2d')
    const rectAttr = this.buffers.array('aRect')
    const uv = this.buffers.array('aUv')
    const color = this.buffers.array('aColor')
    const alpha = this.buffers.array('aAlpha')
    let g = 0

    for (const label of this.labels.values()) {
      const { kind, ref } = label
      const text = this.text(kind, ref, data)
      const source = this.anchors(kind, data) ?? data
      const lineHeight = atlas.lineHeight(kind)
      const rgb = label.emphasis ? this.colors.emphasis : kind === 'system' ? this.colors.system : this.colors[kind]
      let x = kind === 'system' ? (sizes[ref] * sizeScale) / 2 + 1 : -atlas.measure(kind, text) / 2
      for (const char of text) {
        const glyph = atlas.glyph(kind, char)
        if (!glyph) {
          continue
        }
        anchor.set(source.position.subarray(ref * 3, ref * 3 + 3), g * 3)
        anchor2d.set(source.position2d.subarray(ref * 2, ref * 2 + 2), g * 2)
        rectAttr.set([x - 2, -lineHeight / 2, glyph.width, lineHeight], g * 4)
        uv.set([glyph.u0, glyph.v0, glyph.u1, glyph.v1], g * 4)
        color.set(rgb, g * 3)
        alpha[g] = label.alpha
        x += glyph.advance + atlas.styles[kind].tracking
        g++
      }
    }

    this.buffers.commit(g)
    this.object.geometry.instanceCount = g
    this.object.visible = g > 0
    return animating
  }

  dispose(): void {
    this.atlas?.dispose()
    this.atlas = null
    this.buffers.dispose()
    this.object.material.dispose()
  }
}
