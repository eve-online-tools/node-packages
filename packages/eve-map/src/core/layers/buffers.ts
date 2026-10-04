import { BufferAttribute, type BufferGeometry, InstancedBufferAttribute } from 'three'

export interface AttributeSpec {
  name: string
  itemSize: number
}

/**
 * Fixed-capacity attributes for small dynamic layers. Writes reuse the buffers and upload only the used prefix;
 * the geometry is only replaced when capacity has to grow.
 */
export class DynamicAttributes {
  capacity = 0
  attributes = new Map<string, BufferAttribute>()

  constructor(
    private readonly specs: readonly AttributeSpec[],
    private readonly instanced: boolean,
    private readonly createGeometry: () => BufferGeometry,
  ) {}

  geometry: BufferGeometry | null = null

  /** Ensures room for `count` items. Returns true when the geometry was replaced. */
  reserve(count: number): boolean {
    if (count <= this.capacity && this.geometry) {
      return false
    }
    let capacity = Math.max(64, this.capacity)
    while (capacity < count) {
      capacity *= 2
    }
    this.geometry?.dispose()
    this.capacity = capacity
    this.geometry = this.createGeometry()
    this.attributes.clear()
    for (const spec of this.specs) {
      const array = new Float32Array(capacity * spec.itemSize)
      const attribute = this.instanced
        ? new InstancedBufferAttribute(array, spec.itemSize)
        : new BufferAttribute(array, spec.itemSize)
      this.attributes.set(spec.name, attribute)
      this.geometry.setAttribute(spec.name, attribute)
    }
    return true
  }

  array(name: string): Float32Array {
    return this.attributes.get(name)!.array as Float32Array
  }

  /** Marks the first `count` items of every attribute for upload. */
  commit(count: number): void {
    for (const attribute of this.attributes.values()) {
      attribute.clearUpdateRanges()
      if (count > 0) {
        attribute.addUpdateRange(0, count * attribute.itemSize)
        attribute.needsUpdate = true
      }
    }
  }

  dispose(): void {
    this.geometry?.dispose()
    this.geometry = null
  }
}
