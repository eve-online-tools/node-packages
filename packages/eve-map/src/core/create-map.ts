import { Color, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'

import { createMapIndex, type MapIndex } from '../data/lookup'
import type { MapData } from '../data/types'
import { validateMapData } from '../data/validate'
import {
  applyPose,
  clamp,
  clonePose,
  DEFAULT_POLAR_3D,
  FOV_2D,
  FOV_3D,
  lerpPose,
  MAX_POLAR,
  MAX_VIEW_HEIGHT,
  MIN_VIEW_HEIGHT,
  type CameraPose,
  type CameraState,
  type MapView,
} from './camera'
import { parseColor, type ColorInput, type Rgb } from './colors'
import { attachControls, type ControlsOptions } from './controls'
import { resolveEasing, type Easing } from './easing'
import { GatesLayer } from './layers/gates'
import { LabelsLayer, type LabelOptions } from './layers/labels'
import { MarkersLayer, type Marker } from './layers/markers'
import { PathLayer } from './layers/path'
import { SystemsLayer, uploadRanges } from './layers/systems'
import {
  buildScreenGrid,
  createProjection,
  morphPosition,
  projectSystems,
  queryNearest,
  type Projection,
  type ScreenGrid,
} from './projection'
import { FLAG_HIGHLIGHT, resolveColors, resolveFlags, resolveSizes, type SystemStyle } from './style'
import { WebGLUnavailableError } from './webgl'

export interface MapTheme {
  background: ColorInput
  gate: ColorInput
  /** Gates between regions */
  gateRegional: ColorInput
  label: ColorInput
  /** Outline behind label text. Default: `background` */
  labelHalo?: ColorInput
  /** Highlight ring and priority label color */
  highlight: ColorInput
  path: ColorInput
}

export const DEFAULT_THEME: Required<Omit<MapTheme, 'labelHalo'>> = {
  background: '#06080c',
  gate: '#2a3a4e',
  gateRegional: '#6e3f78',
  label: '#b7c3cf',
  highlight: '#ffffff',
  path: '#ffcc33',
}

export interface TransitionOptions {
  /** Milliseconds. Default 600. */
  duration?: number
  /** Default `cubicInOut` */
  easing?: Easing
}

export interface CreateMapOptions {
  data: MapData
  /** Default `2d` */
  view?: MapView
  /** Initial camera. Default: fit the whole map. */
  camera?: Partial<CameraState>
  transition?: TransitionOptions
  /** Default `min(devicePixelRatio, 2)` */
  pixelRatio?: number
  /** Default true */
  antialias?: boolean
  theme?: Partial<MapTheme>
  systemStyle?: SystemStyle
  labels?: LabelOptions
  /** System IDs */
  highlight?: Iterable<number>
  /** System IDs in route order */
  path?: readonly number[]
  markers?: readonly Marker[]
  controls?: ControlsOptions
  /** Pick radius in CSS px. Default 10. */
  pickRadius?: number
  /** Overrides `prefers-reduced-motion` detection. Reduced motion makes transitions and fly-to instant. */
  reducedMotion?: boolean
}

export interface ScreenPoint {
  x: number
  y: number
}

export interface SystemEvent {
  systemId: number | null
  index: number | null
  /** Canvas-relative CSS px */
  screen: ScreenPoint
  originalEvent: Event | null
}

export interface MapEventMap {
  hover: SystemEvent
  click: SystemEvent
  contextmenu: SystemEvent
  camerachange: { camera: CameraState }
  viewchange: { view: MapView; previous: MapView }
  contextlost: { originalEvent: Event }
  contextrestored: { originalEvent: Event }
}

export type MapEventType = keyof MapEventMap

/** System ID, region ID, constellation ID, a list of system IDs, or scene-space bounds */
export type FocusTarget =
  | number
  | readonly number[]
  | { min: readonly [number, number, number]; max: readonly [number, number, number] }

export interface AnimationOptions {
  /** Default true, ignored under reduced motion */
  animate?: boolean
  /** Milliseconds, defaults to the transition duration */
  duration?: number
  easing?: Easing
}

export interface FocusOptions extends AnimationOptions {
  /** Fraction added around the target. Default 0.15. */
  padding?: number
  /** Fixed zoom instead of fitting the target */
  viewHeight?: number
}

export interface ProjectedSystem extends ScreenPoint {
  /** In front of the camera, inside the canvas and not hidden */
  visible: boolean
}

export interface MapStats {
  /** Frames rendered since creation */
  frames: number
  /** Draw calls in the last frame */
  drawCalls: number
}

export interface EveMap {
  readonly canvas: HTMLCanvasElement
  /** Escape hatch for diagnostics. Do not render into it directly. */
  readonly renderer: WebGLRenderer
  readonly data: MapData
  /** The view being shown or transitioned to */
  readonly view: MapView
  setView: (view: MapView, options?: AnimationOptions) => Promise<void>
  setData: (data: MapData) => void
  setSystemStyle: (style: SystemStyle) => void
  setHighlight: (systemIds: Iterable<number>) => void
  setPath: (systemIds: readonly number[]) => void
  setMarkers: (markers: readonly Marker[]) => void
  setTheme: (theme: Partial<MapTheme>) => void
  setLabels: (options: LabelOptions) => void
  focus: (target: FocusTarget, options?: FocusOptions) => Promise<void>
  getCamera: () => CameraState
  setCamera: (camera: Partial<CameraState>, options?: AnimationOptions) => Promise<void>
  /** Canvas-relative CSS px to system index */
  pick: (x: number, y: number) => number | null
  /** Canvas-relative CSS px for DOM overlays. Null for unknown IDs. */
  project: (systemId: number | null | undefined) => ProjectedSystem | null
  on: <T extends MapEventType>(type: T, listener: (event: MapEventMap[T]) => void) => () => void
  off: <T extends MapEventType>(type: T, listener: (event: MapEventMap[T]) => void) => void
  resize: () => void
  /** Requests a frame. Only needed after mutating `renderer` state directly. */
  invalidate: () => void
  getStats: () => MapStats
  dispose: () => void
}

interface Tween {
  from: CameraPose
  to: CameraPose
  start: number | null
  duration: number
  ease: (t: number) => number
  resolve: () => void
  promise: Promise<void>
}

const REGION_MIN = 10_000_000
const CONSTELLATION_MIN = 20_000_000
const SYSTEM_MIN = 30_000_000
const FIT_VIEW_HEIGHT = 2.2
const MIN_FOCUS_VIEW_HEIGHT = 0.06
const TARGET_LIMIT = 2

const toSceneColor = (rgb: Rgb): Color => new Color().setRGB(rgb[0], rgb[1], rgb[2], SRGBColorSpace)

/**
 * Creates a map on `canvas`. Throws `WebGLUnavailableError` when WebGL 2 can't be initialized.
 * The canvas should be sized with CSS; the drawing buffer follows its client size.
 */
export const createMap = (canvas: HTMLCanvasElement, options: CreateMapOptions): EveMap => {
  validateMapData(options.data)

  let renderer: WebGLRenderer
  try {
    renderer = new WebGLRenderer({
      canvas,
      antialias: options.antialias ?? true,
      alpha: false,
      powerPreference: 'default',
    })
  } catch (error) {
    throw new WebGLUnavailableError(undefined, { cause: error })
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose()
    throw new WebGLUnavailableError()
  }

  const win = canvas.ownerDocument.defaultView ?? window
  const listeners = new Map<MapEventType, Set<(event: never) => void>>()
  const emit = <T extends MapEventType>(type: T, event: MapEventMap[T]) => {
    listeners.get(type)?.forEach((listener) => (listener as (e: MapEventMap[T]) => void)(event))
  }

  let data = options.data
  let index: MapIndex = createMapIndex(data)
  let theme = { ...DEFAULT_THEME, ...options.theme }
  let style: SystemStyle = { ...options.systemStyle }
  let highlightIds = new Set(options.highlight ?? [])
  let pathIds: readonly number[] = options.path ?? []
  let markers: readonly Marker[] = options.markers ?? []
  const transition = { duration: options.transition?.duration ?? 600, easing: options.transition?.easing }
  const pixelRatio = options.pixelRatio ?? Math.min(win.devicePixelRatio || 1, 2)
  const pickRadius = options.pickRadius ?? 10

  const scene = new Scene()
  const camera = new PerspectiveCamera(FOV_2D, 1, 0.01, 10)
  renderer.setPixelRatio(pixelRatio)

  let width = 1
  let height = 1
  let view: MapView = options.view ?? '2d'
  let orbit3d = { azimuth: 0, polar: DEFAULT_POLAR_3D }

  const highlightIndices = () => {
    const set = new Set<number>()
    for (const id of highlightIds) {
      const i = index.indexOf(id)
      if (i >= 0) {
        set.add(i)
      }
    }
    return set
  }

  const buildSystems = () =>
    new SystemsLayer(
      data,
      resolveColors(style.color, data.systems.security),
      resolveSizes(style.size, data.systems.id.length),
      resolveFlags(style.visible, highlightIndices(), data.systems.id.length),
      parseColor(theme.highlight),
    )

  let systems = buildSystems()
  let gates = new GatesLayer(data, parseColor(theme.gate), parseColor(theme.gateRegional))
  gates.updateVisibility(systems.flags.array as Float32Array)
  const markersLayer = new MarkersLayer()
  const pathLayer = new PathLayer(parseColor(theme.path))
  const labels = new LabelsLayer(
    options.labels ?? {},
    parseColor(theme.label),
    parseColor(theme.highlight),
    parseColor(theme.labelHalo ?? theme.background),
  )
  scene.add(gates.object, pathLayer.object, systems.object, markersLayer.object, labels.object)
  markersLayer.set(markers, data, index.indexOf)
  pathLayer.set(
    pathIds.map((id) => index.indexOf(id)),
    data,
  )
  renderer.setClearColor(toSceneColor(parseColor(theme.background)), 1)

  // Camera
  const morphFor = (v: MapView) => (v === '3d' ? 1 : 0)
  let pose: CameraPose = {
    target: [0, 0, 0],
    viewHeight: FIT_VIEW_HEIGHT,
    azimuth: 0,
    polar: view === '3d' ? DEFAULT_POLAR_3D : 0,
    fov: view === '3d' ? FOV_3D : FOV_2D,
    morph: morphFor(view),
  }
  let tween: Tween | null = null
  let cameraChanged = true

  const measure = () => {
    width = canvas.clientWidth || canvas.width || 300
    height = canvas.clientHeight || canvas.height || 150
  }
  measure()

  {
    const bounds = view === '3d' ? data.bounds.position : data.bounds.position2d
    const stride = view === '3d' ? 3 : 2
    const cx = (bounds[0] + bounds[stride]) / 2
    const cz = (bounds[stride - 1] + bounds[stride * 2 - 1]) / 2
    pose.target = view === '3d' ? [cx, (bounds[1] + bounds[4]) / 2, cz] : [cx, 0, cz]
    const aspect = width / height
    pose.viewHeight = aspect < 1 ? FIT_VIEW_HEIGHT / aspect : FIT_VIEW_HEIGHT
  }
  if (options.camera) {
    pose = { ...pose, ...normalizeCamera(options.camera, view) }
    if (view === '3d') {
      orbit3d = { azimuth: pose.azimuth, polar: pose.polar }
    }
  }

  // Reduced motion
  const motionQuery = win.matchMedia?.('(prefers-reduced-motion: reduce)')
  let systemReducedMotion = motionQuery?.matches ?? false
  const onMotionChange = (event: MediaQueryListEvent) => {
    systemReducedMotion = event.matches
  }
  motionQuery?.addEventListener?.('change', onMotionChange)
  const reducedMotion = () => options.reducedMotion ?? systemReducedMotion

  // Projection and picking
  let projection: Projection = createProjection(data.systems.id.length)
  let projectionStale = true
  let grid: ScreenGrid | null = null

  const sizeScale = () => clamp((2 / pose.viewHeight) ** 0.3, 1, 3)

  const ensureProjection = (): Projection => {
    if (projectionStale) {
      camera.updateMatrixWorld()
      const m = camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements
      projectSystems(
        projection,
        data.systems.position,
        data.systems.position2d,
        systems.flags.array as Float32Array,
        pose.morph,
        m,
        width,
        height,
      )
      projectionStale = false
      grid = null
    }
    return projection
  }

  const pickIndex = (x: number, y: number, radius = pickRadius): number | null => {
    const p = ensureProjection()
    grid ??= buildScreenGrid(p, width, height)
    return queryNearest(grid, p, x, y, radius)
  }

  const setPose = (next: CameraPose) => {
    pose = next
    applyPose(camera, pose, width / height)
    projectionStale = true
    cameraChanged = true
    invalidate()
  }

  // Frame loop: render on demand only.
  let rafId = 0
  let needsRender = true
  let disposed = false
  let offscreen = false
  let documentHidden = canvas.ownerDocument.hidden ?? false
  let contextLost = false
  let frames = 0
  let pendingHover: { x: number; y: number; event: PointerEvent } | null = null
  let pendingKeyboardFocus = false
  let hoverIndex: number | null = null

  const paused = () => disposed || offscreen || documentHidden || contextLost

  const schedule = () => {
    if (rafId || paused()) {
      return
    }
    if (needsRender || tween || pendingHover || pendingKeyboardFocus) {
      rafId = win.requestAnimationFrame(frame)
    }
  }

  function invalidate() {
    needsRender = true
    schedule()
  }

  const setHoverIndex = (next: number | null, screen: { x: number; y: number }, event: Event | null) => {
    if (next === hoverIndex) {
      return
    }
    hoverIndex = next
    systems.uniforms.uHover.value = next ?? -1
    canvas.style.cursor = next === null ? '' : 'pointer'
    emit('hover', { systemId: next === null ? null : data.systems.id[next], index: next, screen, originalEvent: event })
    invalidate()
  }

  const nearestToCenter = () => pickIndex(width / 2, height / 2, Math.min(width, height) / 6)

  function frame(now: number) {
    rafId = 0
    if (paused()) {
      return
    }

    if (tween) {
      tween.start ??= now
      const t = tween.duration > 0 ? Math.min(1, (now - tween.start) / tween.duration) : 1
      const current = tween
      setPose(t >= 1 ? clonePose(current.to) : lerpPose(current.from, current.to, current.ease(t)))
      if (t >= 1) {
        tween = null
        current.resolve()
      }
    }

    if (pendingHover) {
      const { x, y, event } = pendingHover
      pendingHover = null
      setHoverIndex(pickIndex(x, y), { x, y }, event)
    }

    if (pendingKeyboardFocus) {
      pendingKeyboardFocus = false
      const i = nearestToCenter()
      setHoverIndex(i, i === null ? { x: width / 2, y: height / 2 } : screenOf(i), null)
    }

    if (needsRender) {
      needsRender = false
      render()
    }

    schedule()
  }

  const priorityIndices = (): number[] => {
    const list: number[] = []
    if (hoverIndex !== null) {
      list.push(hoverIndex)
    }
    const flags = systems.flags.array as Float32Array
    for (let i = 0; i < flags.length; i++) {
      if (flags[i] & FLAG_HIGHLIGHT) {
        list.push(i)
      }
    }
    list.push(...pathLayer.indices, ...markersLayer.indices)
    return list
  }

  const render = () => {
    const scale = sizeScale()
    for (const layer of [systems, gates, markersLayer, pathLayer, labels]) {
      layer.uniforms.uMorph.value = pose.morph
    }
    systems.uniforms.uPixelRatio.value = pixelRatio
    systems.uniforms.uSizeScale.value = scale
    markersLayer.uniforms.uPixelRatio.value = pixelRatio
    pathLayer.uniforms.uViewport.value.set(width, height)
    labels.uniforms.uViewport.value.set(width, height)

    labels.update(
      {
        data,
        projection: ensureProjection(),
        sizes: systems.sizes.array as Float32Array,
        sizeScale: scale,
        priority: priorityIndices(),
        width,
        height,
      },
      pixelRatio,
    )

    renderer.render(scene, camera)
    frames++

    if (cameraChanged) {
      cameraChanged = false
      emit('camerachange', { camera: getCamera() })
    }
  }

  const screenOf = (i: number): ScreenPoint => {
    const p = ensureProjection()
    return { x: p.x[i], y: p.y[i] }
  }

  // Tweens
  const startTween = (to: CameraPose, animation: AnimationOptions = {}): Promise<void> => {
    const previous = tween
    tween = null
    previous?.resolve()

    const duration = animation.duration ?? transition.duration
    if (animation.animate === false || reducedMotion() || duration <= 0 || paused()) {
      setPose(to)
      return Promise.resolve()
    }

    let resolve!: () => void
    const promise = new Promise<void>((r) => {
      resolve = r
    })
    tween = {
      from: clonePose(pose),
      to,
      start: null,
      duration,
      ease: resolveEasing(animation.easing ?? transition.easing),
      resolve,
      promise,
    }
    schedule()
    return promise
  }

  /** Where the camera will end up, accounting for a running tween */
  const destination = (): CameraPose => clonePose(tween?.to ?? pose)

  /** Applies a user camera edit to the current pose and any running tween, so input never fights an animation. */
  const editPose = (edit: (p: CameraPose) => void) => {
    const next = clonePose(pose)
    edit(next)
    if (tween) {
      edit(tween.from)
      edit(tween.to)
    }
    setPose(next)
  }

  const clampTarget = (p: CameraPose) => {
    p.target = p.target.map((v) => clamp(v, -TARGET_LIMIT, TARGET_LIMIT)) as [number, number, number]
  }

  const right = new Vector3()
  const up = new Vector3()

  const pan = (dx: number, dy: number) => {
    const worldPerPixel = pose.viewHeight / height
    right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    up.set(0, 1, 0).applyQuaternion(camera.quaternion)
    editPose((p) => {
      p.target[0] += (-right.x * dx + up.x * dy) * worldPerPixel
      p.target[1] += (-right.y * dx + up.y * dy) * worldPerPixel
      p.target[2] += (-right.z * dx + up.z * dy) * worldPerPixel
      clampTarget(p)
    })
  }

  const zoomAt = (factor: number, x: number, y: number) => {
    const next = clamp(pose.viewHeight * factor, MIN_VIEW_HEIGHT, MAX_VIEW_HEIGHT)
    const k = next / pose.viewHeight
    const ox = ((x - width / 2) / height) * pose.viewHeight
    const oy = (-(y - height / 2) / height) * pose.viewHeight
    right.set(1, 0, 0).applyQuaternion(camera.quaternion)
    up.set(0, 1, 0).applyQuaternion(camera.quaternion)
    editPose((p) => {
      p.viewHeight = clamp(p.viewHeight * k, MIN_VIEW_HEIGHT, MAX_VIEW_HEIGHT)
      p.target[0] += (right.x * ox + up.x * oy) * (1 - k)
      p.target[1] += (right.y * ox + up.y * oy) * (1 - k)
      p.target[2] += (right.z * ox + up.z * oy) * (1 - k)
      clampTarget(p)
    })
  }

  const orbit = (dAzimuth: number, dPolar: number) => {
    if (view !== '3d' || tween) {
      return
    }
    editPose((p) => {
      p.azimuth -= dAzimuth
      p.polar = clamp(p.polar - dPolar, 0, MAX_POLAR)
    })
    orbit3d = { azimuth: pose.azimuth, polar: pose.polar }
  }

  const resolveFocusIndices = (target: FocusTarget): number[] => {
    if (typeof target === 'number') {
      if (target >= REGION_MIN && target < CONSTELLATION_MIN) {
        return index.systemsInRegion(target)
      }
      if (target >= CONSTELLATION_MIN && target < SYSTEM_MIN) {
        return index.systemsInConstellation(target)
      }
      const i = index.indexOf(target)
      return i >= 0 ? [i] : []
    }
    if (Array.isArray(target)) {
      return target.map((id: number) => index.indexOf(id)).filter((i: number) => i >= 0)
    }
    return []
  }

  // Public API
  const getCamera = (): CameraState => ({
    target: [...pose.target],
    viewHeight: pose.viewHeight,
    azimuth: pose.azimuth,
    polar: pose.polar,
  })

  const setView = (next: MapView, animation?: AnimationOptions): Promise<void> => {
    if (disposed) {
      return Promise.resolve()
    }
    if (next === view) {
      return tween?.promise ?? Promise.resolve()
    }
    const previous = view
    if (previous === '3d' && !tween) {
      orbit3d = { azimuth: pose.azimuth, polar: pose.polar }
    }
    view = next

    const to = destination()
    const morph = morphFor(next)
    // Keep the system nearest the target under the camera while the layout morphs.
    const anchor = pickAnchor(to.target, to.morph)
    if (anchor !== null) {
      const before = morphPosition(data.systems.position, data.systems.position2d, to.morph, anchor)
      const after = morphPosition(data.systems.position, data.systems.position2d, morph, anchor)
      to.target = [
        after[0] + to.target[0] - before[0],
        after[1] + to.target[1] - before[1],
        after[2] + to.target[2] - before[2],
      ]
    }
    if (next === '2d') {
      to.target[1] = 0
    }
    to.morph = morph
    to.fov = next === '3d' ? FOV_3D : FOV_2D
    to.polar = next === '3d' ? orbit3d.polar : 0
    to.azimuth = next === '3d' ? orbit3d.azimuth : 0

    emit('viewchange', { view: next, previous })
    return startTween(to, animation)
  }

  const pickAnchor = (target: readonly number[], morph: number): number | null => {
    let best: number | null = null
    let bestDistance = Infinity
    const p: [number, number, number] = [0, 0, 0]
    for (let i = 0; i < data.systems.id.length; i++) {
      morphPosition(data.systems.position, data.systems.position2d, morph, i, p)
      const d = (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2 + (p[2] - target[2]) ** 2
      if (d < bestDistance) {
        bestDistance = d
        best = i
      }
    }
    return best
  }

  const focus = (target: FocusTarget, focusOptions: FocusOptions = {}): Promise<void> => {
    if (disposed) {
      return Promise.resolve()
    }
    const to = destination()
    let min: [number, number, number]
    let max: [number, number, number]
    if (typeof target === 'object' && !Array.isArray(target) && 'min' in target) {
      min = [...target.min]
      max = [...target.max]
    } else {
      const indices = resolveFocusIndices(target)
      if (indices.length === 0) {
        return Promise.resolve()
      }
      min = [Infinity, Infinity, Infinity]
      max = [-Infinity, -Infinity, -Infinity]
      const p: [number, number, number] = [0, 0, 0]
      for (const i of indices) {
        morphPosition(data.systems.position, data.systems.position2d, to.morph, i, p)
        for (let c = 0; c < 3; c++) {
          min[c] = Math.min(min[c], p[c])
          max[c] = Math.max(max[c], p[c])
        }
      }
    }
    const center: [number, number, number] = [(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]
    const radius = Math.hypot(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2
    const aspect = width / height
    const fit = (2 * radius * (1 + (focusOptions.padding ?? 0.15))) / Math.min(1, aspect)
    to.target = center
    to.viewHeight = clamp(
      focusOptions.viewHeight ?? Math.max(MIN_FOCUS_VIEW_HEIGHT, fit),
      MIN_VIEW_HEIGHT,
      MAX_VIEW_HEIGHT,
    )
    return startTween(to, focusOptions)
  }

  const setCamera = (state: Partial<CameraState>, animation: AnimationOptions = { animate: false }) => {
    if (disposed) {
      return Promise.resolve()
    }
    const to = { ...destination(), ...normalizeCamera(state, view) }
    if (view === '3d') {
      orbit3d = { azimuth: to.azimuth, polar: to.polar }
    }
    return startTween(to, animation)
  }

  const setSystemStyle = (partial: SystemStyle) => {
    style = { ...style, ...partial }
    const n = data.systems.id.length
    let changed = 0
    if ('color' in partial) {
      changed += uploadRanges(systems.colors, resolveColors(style.color, data.systems.security))
    }
    if ('size' in partial) {
      changed += uploadRanges(systems.sizes, resolveSizes(style.size, n))
    }
    if ('visible' in partial) {
      changed += updateFlags()
    }
    if (changed > 0) {
      invalidate()
    }
  }

  const updateFlags = (): number => {
    const changed = uploadRanges(systems.flags, resolveFlags(style.visible, highlightIndices(), data.systems.id.length))
    if (changed > 0) {
      gates.updateVisibility(systems.flags.array as Float32Array)
      projectionStale = true
    }
    return changed
  }

  const setHighlight = (ids: Iterable<number>) => {
    highlightIds = new Set(ids)
    if (updateFlags() > 0) {
      invalidate()
    }
  }

  const setPath = (ids: readonly number[]) => {
    if (sameList(ids, pathIds)) {
      return
    }
    pathIds = [...ids]
    pathLayer.set(
      pathIds.map((id) => index.indexOf(id)),
      data,
    )
    invalidate()
  }

  const setMarkers = (next: readonly Marker[]) => {
    if (sameMarkers(next, markers)) {
      return
    }
    markers = [...next]
    markersLayer.set(markers, data, index.indexOf)
    invalidate()
  }

  const setTheme = (partial: Partial<MapTheme>) => {
    theme = { ...theme, ...partial }
    renderer.setClearColor(toSceneColor(parseColor(theme.background)), 1)
    gates.uniforms.uGate.value.set(...parseColor(theme.gate))
    gates.uniforms.uGateRegional.value.set(...parseColor(theme.gateRegional))
    systems.uniforms.uHighlight.value.set(...parseColor(theme.highlight))
    pathLayer.uniforms.uColor.value.set(...parseColor(theme.path))
    labels.uniforms.uColor.value.set(...parseColor(theme.label))
    labels.uniforms.uEmphasisColor.value.set(...parseColor(theme.highlight))
    labels.uniforms.uHalo.value.set(...parseColor(theme.labelHalo ?? theme.background))
    invalidate()
  }

  const setLabels = (labelOptions: LabelOptions) => {
    labels.setOptions(labelOptions)
    invalidate()
  }

  const setData = (next: MapData) => {
    validateMapData(next)
    data = next
    index = createMapIndex(data)
    scene.remove(systems.object, gates.object)
    systems.dispose()
    gates.dispose()
    systems = buildSystems()
    gates = new GatesLayer(data, parseColor(theme.gate), parseColor(theme.gateRegional))
    gates.updateVisibility(systems.flags.array as Float32Array)
    scene.add(gates.object, systems.object)
    markersLayer.set(markers, data, index.indexOf)
    pathLayer.set(
      pathIds.map((id) => index.indexOf(id)),
      data,
    )
    projection = createProjection(data.systems.id.length)
    projectionStale = true
    hoverIndex = null
    labels.shown = []
    invalidate()
  }

  const pick = (x: number, y: number) => pickIndex(x, y)

  const project = (systemId: number | null | undefined): ProjectedSystem | null => {
    if (systemId === null || systemId === undefined) {
      return null
    }
    const i = index.indexOf(systemId)
    if (i < 0) {
      return null
    }
    const p = ensureProjection()
    return { x: p.x[i], y: p.y[i], visible: p.visible[i] === 1 }
  }

  const resize = () => {
    measure()
    renderer.setSize(width, height, false)
    applyPose(camera, pose, width / height)
    projectionStale = true
    invalidate()
  }

  // Observers and listeners
  const resizeObserver = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => resize())
  resizeObserver?.observe(canvas)

  const intersectionObserver =
    typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver((entries) => {
          const entry = entries[entries.length - 1]
          offscreen = !entry.isIntersecting
          schedule()
        })
  intersectionObserver?.observe(canvas)

  const onVisibilityChange = () => {
    documentHidden = canvas.ownerDocument.hidden
    schedule()
  }
  canvas.ownerDocument.addEventListener('visibilitychange', onVisibilityChange)

  const onContextLost = (event: Event) => {
    event.preventDefault()
    contextLost = true
    if (rafId) {
      win.cancelAnimationFrame(rafId)
      rafId = 0
    }
    emit('contextlost', { originalEvent: event })
  }
  const onContextRestored = (event: Event) => {
    // three re-creates its GL state on restore and re-uploads buffers and textures lazily on the next render.
    contextLost = false
    emit('contextrestored', { originalEvent: event })
    invalidate()
  }
  canvas.addEventListener('webglcontextlost', onContextLost)
  canvas.addEventListener('webglcontextrestored', onContextRestored)

  const detachControls = attachControls(
    canvas,
    {
      is3d: () => view === '3d',
      pan,
      orbit,
      zoomAt,
      hover: (x, y, event) => {
        pendingHover = { x, y, event }
        schedule()
      },
      leave: (event) => {
        pendingHover = null
        setHoverIndex(null, { x: -1, y: -1 }, event)
      },
      click: (x, y, event) => {
        const i = pickIndex(x, y)
        emit('click', {
          systemId: i === null ? null : data.systems.id[i],
          index: i,
          screen: { x, y },
          originalEvent: event,
        })
      },
      contextmenu: (x, y, event) => {
        if (!listeners.get('contextmenu')?.size) {
          return false
        }
        const i = pickIndex(x, y)
        emit('contextmenu', {
          systemId: i === null ? null : data.systems.id[i],
          index: i,
          screen: { x, y },
          originalEvent: event,
        })
        return true
      },
      keyboardNavigate: () => {
        pendingKeyboardFocus = true
        schedule()
      },
      keyboardSelect: (event) => {
        const i = hoverIndex ?? nearestToCenter()
        const screen = i === null ? { x: width / 2, y: height / 2 } : screenOf(i)
        emit('click', { systemId: i === null ? null : data.systems.id[i], index: i, screen, originalEvent: event })
      },
      size: () => ({ width, height }),
    },
    options.controls ?? {},
  )

  const dispose = () => {
    if (disposed) {
      return
    }
    disposed = true
    if (rafId) {
      win.cancelAnimationFrame(rafId)
      rafId = 0
    }
    tween?.resolve()
    tween = null
    detachControls()
    resizeObserver?.disconnect()
    intersectionObserver?.disconnect()
    motionQuery?.removeEventListener?.('change', onMotionChange)
    canvas.ownerDocument.removeEventListener('visibilitychange', onVisibilityChange)
    canvas.removeEventListener('webglcontextlost', onContextLost)
    canvas.removeEventListener('webglcontextrestored', onContextRestored)
    for (const layer of [systems, gates, markersLayer, pathLayer, labels]) {
      layer.dispose()
    }
    scene.clear()
    renderer.renderLists.dispose()
    renderer.dispose()
    // Release the context now rather than at GC, browsers cap live contexts.
    renderer.forceContextLoss()
    listeners.clear()
  }

  renderer.setSize(width, height, false)
  applyPose(camera, pose, width / height)
  invalidate()

  return {
    canvas,
    renderer,
    get data() {
      return data
    },
    get view() {
      return view
    },
    setView,
    setData,
    setSystemStyle,
    setHighlight,
    setPath,
    setMarkers,
    setTheme,
    setLabels,
    focus,
    getCamera,
    setCamera,
    pick,
    project,
    on: (type, listener) => {
      let set = listeners.get(type)
      if (!set) {
        set = new Set()
        listeners.set(type, set)
      }
      set.add(listener as (event: never) => void)
      return () => set.delete(listener as (event: never) => void)
    },
    off: (type, listener) => {
      listeners.get(type)?.delete(listener as (event: never) => void)
    },
    resize,
    invalidate,
    getStats: () => ({ frames, drawCalls: renderer.info.render.calls }),
    dispose,
  }
}

const sameList = (a: readonly number[], b: readonly number[]): boolean =>
  a.length === b.length && a.every((v, i) => v === b[i])

const sameMarkers = (a: readonly Marker[], b: readonly Marker[]): boolean =>
  a.length === b.length &&
  a.every((m, i) => {
    const o = b[i]
    const sameColor =
      Array.isArray(m.color) && Array.isArray(o.color) ? sameList(m.color, o.color) : m.color === o.color
    return m.systemId === o.systemId && m.size === o.size && m.shape === o.shape && sameColor
  })

/** 2D locks rotation, so orientation fields are dropped there. */
function normalizeCamera(state: Partial<CameraState>, view: MapView): Partial<CameraPose> {
  const out: Partial<CameraPose> = {}
  if (state.target) {
    out.target = [state.target[0], view === '2d' ? 0 : state.target[1], state.target[2]]
  }
  if (state.viewHeight !== undefined) {
    out.viewHeight = clamp(state.viewHeight, MIN_VIEW_HEIGHT, MAX_VIEW_HEIGHT)
  }
  if (view === '3d') {
    if (state.azimuth !== undefined) {
      out.azimuth = state.azimuth
    }
    if (state.polar !== undefined) {
      out.polar = clamp(state.polar, 0, MAX_POLAR)
    }
  }
  return out
}
