import { BufferGeometry, GLSL3, Points, ShaderMaterial } from 'three'

import type { MapData } from '../../data/types'
import { parseColor, type ColorInput } from '../colors'
import { markersFragment, markersVertex } from '../shaders'
import { DynamicAttributes } from './buffers'

export type MarkerShape = 'circle' | 'ring' | 'square' | 'diamond' | 'triangle'

export interface Marker {
  systemId: number
  /** Default `#ffcc33` */
  color?: ColorInput
  /** Diameter in CSS pixels. Default 12. */
  size?: number
  /** Default `ring` */
  shape?: MarkerShape
}

const SHAPES: Record<MarkerShape, number> = { circle: 0, ring: 1, square: 2, diamond: 3, triangle: 4 }

export const DEFAULT_MARKER_COLOR = '#ffcc33'
export const DEFAULT_MARKER_SIZE = 12

export class MarkersLayer {
  readonly object: Points<BufferGeometry, ShaderMaterial>
  /** System index per drawn marker */
  indices: number[] = []
  private readonly buffers = new DynamicAttributes(
    [
      { name: 'position', itemSize: 3 },
      { name: 'position2d', itemSize: 2 },
      { name: 'aColor', itemSize: 3 },
      { name: 'aSize', itemSize: 1 },
      { name: 'aShape', itemSize: 1 },
    ],
    false,
    () => new BufferGeometry(),
  )

  constructor() {
    this.buffers.reserve(0)
    const material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: markersVertex,
      fragmentShader: markersFragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: { uMorph: { value: 0 }, uPixelRatio: { value: 1 } },
    })
    this.object = new Points(this.buffers.geometry!, material)
    this.object.frustumCulled = false
    this.object.renderOrder = 3
    this.object.visible = false
  }

  get uniforms() {
    return this.object.material.uniforms
  }

  /** Unknown system IDs are skipped. */
  set(markers: readonly Marker[], data: MapData, indexOf: (systemId: number) => number): void {
    const resolved = markers
      .map((marker) => ({ marker, index: indexOf(marker.systemId) }))
      .filter((entry) => entry.index >= 0)
    if (this.buffers.reserve(resolved.length)) {
      this.object.geometry = this.buffers.geometry!
    }

    const position = this.buffers.array('position')
    const position2d = this.buffers.array('position2d')
    const color = this.buffers.array('aColor')
    const size = this.buffers.array('aSize')
    const shape = this.buffers.array('aShape')
    const colorCache = new Map<ColorInput, readonly number[]>()

    resolved.forEach(({ marker, index }, k) => {
      position.set(data.systems.position.subarray(index * 3, index * 3 + 3), k * 3)
      position2d.set(data.systems.position2d.subarray(index * 2, index * 2 + 2), k * 2)
      const input = marker.color ?? DEFAULT_MARKER_COLOR
      const rgb = colorCache.get(input) ?? parseColor(input)
      colorCache.set(input, rgb)
      color.set(rgb, k * 3)
      size[k] = marker.size ?? DEFAULT_MARKER_SIZE
      shape[k] = SHAPES[marker.shape ?? 'ring'] ?? 0
    })

    this.indices = resolved.map((entry) => entry.index)
    this.buffers.commit(resolved.length)
    this.object.geometry.setDrawRange(0, resolved.length)
    this.object.visible = resolved.length > 0
  }

  dispose(): void {
    this.buffers.dispose()
    this.object.material.dispose()
  }
}
