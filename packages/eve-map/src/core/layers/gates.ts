import { BufferAttribute, BufferGeometry, GLSL3, LineSegments, ShaderMaterial, Vector3 } from 'three'

import type { PreparedMap } from '../prepare'
import type { Rgb } from '../colors'
import { gatesFragment, gatesVertex } from '../shaders'
import { FLAG_HIDDEN } from '../style'
import { uploadRanges } from './systems'

const KIND_REGIONAL = 1
const KIND_HIDDEN = 2

/** One vertex per gate end, so positions are expanded from system indices. */
export class GatesLayer {
  readonly object: LineSegments<BufferGeometry, ShaderMaterial>
  private readonly kinds: BufferAttribute
  private readonly baseKinds: Float32Array

  constructor(
    private readonly data: PreparedMap,
    gate: Rgb,
    gateRegional: Rgb,
  ) {
    const { gates } = data
    const vertexCount = gates.length
    const position = new Float32Array(vertexCount * 3)
    const position2d = new Float32Array(vertexCount * 2)
    this.baseKinds = new Float32Array(vertexCount)

    for (let v = 0; v < vertexCount; v++) {
      const i = gates[v]
      position.set(data.position.subarray(i * 3, i * 3 + 3), v * 3)
      position2d.set(data.position2d.subarray(i * 2, i * 2 + 2), v * 2)
    }
    for (let g = 0; g < vertexCount; g += 2) {
      const regional = data.region[gates[g]] !== data.region[gates[g + 1]] ? KIND_REGIONAL : 0
      this.baseKinds[g] = regional
      this.baseKinds[g + 1] = regional
    }

    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(position, 3))
    geometry.setAttribute('position2d', new BufferAttribute(position2d, 2))
    this.kinds = new BufferAttribute(this.baseKinds.slice(), 1)
    geometry.setAttribute('aKind', this.kinds)

    const material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: gatesVertex,
      fragmentShader: gatesFragment,
      transparent: true,
      depthWrite: false,
      uniforms: {
        uMorph: { value: 0 },
        uGate: { value: new Vector3(...gate) },
        uGateRegional: { value: new Vector3(...gateRegional) },
        uOpacity: { value: 0.55 },
      },
    })

    this.object = new LineSegments(geometry, material)
    this.object.frustumCulled = false
    this.object.renderOrder = 0
  }

  get uniforms() {
    return this.object.material.uniforms
  }

  /** Hides gates touching a hidden system. */
  updateVisibility(flags: Float32Array): void {
    const { gates } = this.data
    const next = this.baseKinds.slice()
    for (let g = 0; g < gates.length; g += 2) {
      if ((flags[gates[g]] & FLAG_HIDDEN) !== 0 || (flags[gates[g + 1]] & FLAG_HIDDEN) !== 0) {
        next[g] = KIND_HIDDEN
        next[g + 1] = KIND_HIDDEN
      }
    }
    uploadRanges(this.kinds, next)
  }

  dispose(): void {
    this.object.geometry.dispose()
    this.object.material.dispose()
  }
}
