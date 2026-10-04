import {
  BufferAttribute,
  DoubleSide,
  GLSL3,
  InstancedBufferGeometry,
  Mesh,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three'

import type { MapData } from '../../data/types'
import type { Rgb } from '../colors'
import { pathFragment, pathVertex } from '../shaders'
import { DynamicAttributes } from './buffers'

const createQuadGeometry = (): InstancedBufferGeometry => {
  const geometry = new InstancedBufferGeometry()
  // x: 0 start / 1 end, y: side
  geometry.setAttribute('position', new BufferAttribute(new Float32Array([0, -1, 0, 1, 0, 0, 1, 1, 0, 1, -1, 0]), 3))
  geometry.setIndex([0, 2, 1, 0, 3, 2])
  geometry.instanceCount = 0
  return geometry
}

/** Screen-space wide route polyline, one instanced quad per segment. */
export class PathLayer {
  readonly object: Mesh<InstancedBufferGeometry, ShaderMaterial>
  indices: number[] = []
  private readonly buffers = new DynamicAttributes(
    [
      { name: 'aStart', itemSize: 3 },
      { name: 'aStart2d', itemSize: 2 },
      { name: 'aEnd', itemSize: 3 },
      { name: 'aEnd2d', itemSize: 2 },
    ],
    true,
    createQuadGeometry,
  )

  constructor(color: Rgb) {
    this.buffers.reserve(0)
    const material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: pathVertex,
      fragmentShader: pathFragment,
      transparent: true,
      side: DoubleSide,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uMorph: { value: 0 },
        uViewport: { value: new Vector2(1, 1) },
        uWidth: { value: 3 },
        uColor: { value: new Vector3(...color) },
        uOpacity: { value: 0.9 },
      },
    })
    this.object = new Mesh(this.buffers.geometry as InstancedBufferGeometry, material)
    this.object.frustumCulled = false
    this.object.renderOrder = 1
    this.object.visible = false
  }

  get uniforms() {
    return this.object.material.uniforms
  }

  /** Consecutive system indices. Unknown IDs break the path into separate runs. */
  set(indices: readonly number[], data: MapData): void {
    const segments: Array<[number, number]> = []
    for (let k = 1; k < indices.length; k++) {
      if (indices[k - 1] >= 0 && indices[k] >= 0) {
        segments.push([indices[k - 1], indices[k]])
      }
    }
    if (this.buffers.reserve(segments.length)) {
      this.object.geometry = this.buffers.geometry as InstancedBufferGeometry
    }
    const start = this.buffers.array('aStart')
    const start2d = this.buffers.array('aStart2d')
    const end = this.buffers.array('aEnd')
    const end2d = this.buffers.array('aEnd2d')
    const { position, position2d } = data.systems
    segments.forEach(([a, b], k) => {
      start.set(position.subarray(a * 3, a * 3 + 3), k * 3)
      start2d.set(position2d.subarray(a * 2, a * 2 + 2), k * 2)
      end.set(position.subarray(b * 3, b * 3 + 3), k * 3)
      end2d.set(position2d.subarray(b * 2, b * 2 + 2), k * 2)
    })
    this.indices = indices.filter((i) => i >= 0)
    this.buffers.commit(segments.length)
    this.object.geometry.instanceCount = segments.length
    this.object.visible = segments.length > 0
  }

  dispose(): void {
    this.buffers.dispose()
    this.object.material.dispose()
  }
}
