/**
 * Struct-of-arrays map data. Index `i` is the system's position in every `systems` array.
 *
 * Coordinates are in scene space (right-handed, Y up) and normalized so each layout fits in [-1, 1].
 * `position2d` holds scene `(x, z)` with y implied 0.
 */
export interface MapData {
  systems: {
    id: Int32Array
    constellation: Int32Array
    region: Int32Array
    /** xyz per system */
    position: Float32Array
    /** xz per system */
    position2d: Float32Array
    security: Float32Array
    name: string[]
  }
  /** Pairs of system indices, deduplicated, `a < b` */
  gates: Uint16Array
  /** Region ID to name */
  regions: Record<number, string>
  /** Constellation ID to name */
  constellations: Record<number, string>
  bounds: {
    /** min xyz, max xyz */
    position: Float32Array
    /** min xz, max xz */
    position2d: Float32Array
  }
}

export interface Vec3Like {
  x: number
  y: number
  z: number
}

export interface Vec2Like {
  x: number
  y: number
}

/** A solar system in SDE universe coordinates (left-handed, Y up, meters). */
export interface MapSystemSource {
  id: number
  constellationId: number
  regionId: number
  position: Vec3Like
  position2d?: Vec2Like
  security: number
  name: string
}

/** Input for `buildMapData` */
export interface MapDataSource {
  systems: Iterable<MapSystemSource>
  /** Pairs of solar system IDs. Either direction, duplicates and unknown IDs are dropped. */
  gates: Iterable<readonly [number, number]>
  regions?: Record<number, string>
  constellations?: Record<number, string>
}
