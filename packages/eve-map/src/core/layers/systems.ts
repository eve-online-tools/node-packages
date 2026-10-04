import { BufferAttribute, BufferGeometry, GLSL3, Points, ShaderMaterial, Vector3 } from 'three'

import type { PreparedMap } from '../prepare'
import type { Rgb } from '../colors'
import { systemsFragment, systemsVertex } from '../shaders'
import { diffRanges } from '../style'

export const uploadRanges = (attribute: BufferAttribute, next: Float32Array, maxGap = 16): number => {
  const current = attribute.array as Float32Array
  const ranges = diffRanges(current, next, attribute.itemSize, maxGap)
  for (const range of ranges) {
    current.set(next.subarray(range.start, range.start + range.count), range.start)
    attribute.addUpdateRange(range.start, range.count)
  }
  if (ranges.length > 0) {
    attribute.needsUpdate = true
  }
  return ranges.length
}

export class SystemsLayer {
  readonly object: Points<BufferGeometry, ShaderMaterial>
  readonly colors: BufferAttribute
  readonly sizes: BufferAttribute
  readonly flags: BufferAttribute

  constructor(data: PreparedMap, colors: Float32Array, sizes: Float32Array, flags: Float32Array, highlight: Rgb) {
    const geometry = new BufferGeometry()
    geometry.setAttribute('position', new BufferAttribute(data.position, 3))
    geometry.setAttribute('position2d', new BufferAttribute(data.position2d, 2))
    this.colors = new BufferAttribute(colors, 3)
    this.sizes = new BufferAttribute(sizes, 1)
    this.flags = new BufferAttribute(flags, 1)
    geometry.setAttribute('aColor', this.colors)
    geometry.setAttribute('aSize', this.sizes)
    geometry.setAttribute('aFlags', this.flags)

    const material = new ShaderMaterial({
      glslVersion: GLSL3,
      vertexShader: systemsVertex,
      fragmentShader: systemsFragment,
      transparent: true,
      depthTest: true,
      depthWrite: true,
      uniforms: {
        uMorph: { value: 0 },
        uPixelRatio: { value: 1 },
        uSizeScale: { value: 1 },
        uHover: { value: -1 },
        uHighlight: { value: new Vector3(...highlight) },
      },
    })

    this.object = new Points(geometry, material)
    this.object.frustumCulled = false
    this.object.renderOrder = 2
  }

  get uniforms() {
    return this.object.material.uniforms
  }

  dispose(): void {
    this.object.geometry.dispose()
    this.object.material.dispose()
  }
}
