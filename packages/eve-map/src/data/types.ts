export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Vec2 {
  x: number
  y: number
}

/** A solar system as in the SDE. Positions are SDE universe coordinates in meters. */
export interface MapSystem {
  id: number
  name: string
  regionId: number
  constellationId: number
  security: number
  position: Vec3
  /** Systems without one are placed at their 3D position in 2D. */
  position2d?: Vec2
  /** IDs of systems connected by a stargate. IDs not in `systems` are ignored. */
  gates: number[]
}

export interface MapData {
  systems: MapSystem[]
  /** Region ID to name */
  regions: Record<number, string>
  /** Constellation ID to name */
  constellations: Record<number, string>
}
