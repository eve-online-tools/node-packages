import { Euler, type PerspectiveCamera, Quaternion, Vector3 } from 'three'

export type MapView = '2d' | '3d'

export interface CameraState {
  /** Point the camera looks at, scene space */
  target: [number, number, number]
  /** World units visible vertically at the target. Independent of FOV, so it survives the 2D/3D switch. */
  viewHeight: number
  /** Radians around +Y. Locked to 0 in 2D. */
  azimuth: number
  /** Radians from straight down. 0 in 2D. */
  polar: number
}

/** Full internal pose, including the parts driven by the view mode. */
export interface CameraPose extends CameraState {
  /** Vertical FOV, degrees */
  fov: number
  /** 0 = 2D layout, 1 = 3D layout */
  morph: number
}

export const FOV_2D = 12
export const FOV_3D = 50
export const DEFAULT_POLAR_3D = 0.9
export const MIN_VIEW_HEIGHT = 0.004
export const MAX_VIEW_HEIGHT = 6
export const MAX_POLAR = Math.PI - 0.05

export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

/** Shortest-path angle interpolation */
export const lerpAngle = (a: number, b: number, t: number): number => {
  const twoPi = Math.PI * 2
  let delta = (((b - a) % twoPi) + twoPi) % twoPi
  if (delta > Math.PI) {
    delta -= twoPi
  }
  return a + delta * t
}

export const lerpPose = (from: CameraPose, to: CameraPose, t: number): CameraPose => ({
  target: [
    lerp(from.target[0], to.target[0], t),
    lerp(from.target[1], to.target[1], t),
    lerp(from.target[2], to.target[2], t),
  ],
  // Interpolate zoom in log space so it feels uniform.
  viewHeight: Math.exp(lerp(Math.log(from.viewHeight), Math.log(to.viewHeight), t)),
  azimuth: lerpAngle(from.azimuth, to.azimuth, t),
  polar: lerp(from.polar, to.polar, t),
  fov: lerp(from.fov, to.fov, t),
  morph: lerp(from.morph, to.morph, t),
})

export const clonePose = (pose: CameraPose): CameraPose => ({ ...pose, target: [...pose.target] })

export const distanceForPose = (pose: Pick<CameraPose, 'viewHeight' | 'fov'>): number =>
  pose.viewHeight / (2 * Math.tan((pose.fov * Math.PI) / 360))

const euler = new Euler(0, 0, 0, 'YXZ')
const quaternion = new Quaternion()
const backward = new Vector3()

/** Positions and orients `camera` for `pose`. North (scene -Z) is screen up at azimuth 0. */
export const applyPose = (camera: PerspectiveCamera, pose: CameraPose, aspect: number): void => {
  const distance = distanceForPose(pose)
  euler.set(pose.polar - Math.PI / 2, pose.azimuth, 0)
  quaternion.setFromEuler(euler)
  backward.set(0, 0, 1).applyQuaternion(quaternion)

  camera.quaternion.copy(quaternion)
  camera.position.set(pose.target[0], pose.target[1], pose.target[2]).addScaledVector(backward, distance)
  camera.fov = pose.fov
  camera.aspect = aspect > 0 ? aspect : 1
  // Normalized scene fits in a radius of ~1.8 around the origin.
  camera.near = Math.max(distance * 0.02, distance - 4)
  camera.far = distance + 4
  camera.updateProjectionMatrix()
  camera.updateMatrixWorld(true)
}
