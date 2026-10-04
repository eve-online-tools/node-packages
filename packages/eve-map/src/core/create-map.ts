import { Color, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'

import type { MapData } from '../data/types'
import { prepareMap, type PreparedMap } from './prepare'
import { validateMapData } from '../data/validate'
import {
  applyPose,
  clamp,
  clonePose,
  DEFAULT_POLAR_3D,
  fitPoints,
  FOV_2D,
  FIT_VIEW_HEIGHT,
  FOV_3D,
  lerpPose,
  MAX_POLAR,
  MAX_VIEW_HEIGHT,
  MIN_VIEW_HEIGHT,
  viewHeightToZoom,
  zoomToViewHeight,
  type CameraPose,
  type CameraState,
  type MapView,
} from './camera'
import { parseColor, type ColorInput, type Rgb } from './colors'
import { attachControls } from './controls'
import { resolveEasing, type Easing } from './easing'
import { GatesLayer } from './layers/gates'
import { LABEL_FADE, LabelsLayer, type LabelColors, type LabelOptions } from './layers/labels'
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
  constellationLabel: ColorInput
  regionLabel: ColorInput
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
  constellationLabel: '#8392a3',
  regionLabel: '#c9d6e3',
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
  /** Initial camera. Default: fit `focus`, or the whole map. Setting it starts with `focus` following paused. */
  camera?: Partial<CameraState>
  /**
   * System IDs to keep in view. Until the user or `setCamera`/`focus()` moves the camera, the map follows them;
   * empty or unset fits the whole map. In 3D the view resets to the default angle.
   */
  focus?: readonly number[]
  /** Milliseconds after the last camera input to return to following `focus`. Default: never. */
  autoFocus?: number
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
  /** User camera input: drag, pinch, wheel and arrow keys. Hover, click and Enter work regardless. Default true. */
  controls?: boolean
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

/** System ID, region ID, constellation ID, or a list of system IDs */
export type FocusTarget = number | readonly number[]

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
  zoom?: number
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
  setControls: (enabled: boolean) => void
  /** Systems to follow, see `CreateMapOptions.focus` */
  setFocus: (systemIds: readonly number[]) => void
  /** See `CreateMapOptions.autoFocus`; null disables */
  setAutoFocus: (ms: number | null) => void
  /** Flies to a target once. Pauses `focus` following like user input does. */
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
  let prepared: PreparedMap = prepareMap(data)
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
      const i = prepared.indexOf(id)
      if (i >= 0) {
        set.add(i)
      }
    }
    return set
  }

  const buildSystems = () =>
    new SystemsLayer(
      prepared,
      resolveColors(style.color, prepared.security),
      resolveSizes(style.size, prepared.id.length),
      resolveFlags(style.visible, highlightIndices(), prepared.id.length),
      parseColor(theme.highlight),
    )

  let systems = buildSystems()
  let gates = new GatesLayer(prepared, parseColor(theme.gate), parseColor(theme.gateRegional))
  gates.updateVisibility(systems.flags.array as Float32Array)
  const markersLayer = new MarkersLayer()
  const pathLayer = new PathLayer(parseColor(theme.path))
  const labelColors = (): LabelColors => ({
    system: parseColor(theme.label),
    emphasis: parseColor(theme.highlight),
    constellation: parseColor(theme.constellationLabel),
    region: parseColor(theme.regionLabel),
    halo: parseColor(theme.labelHalo ?? theme.background),
  })
  const labels = new LabelsLayer(options.labels ?? {}, labelColors())
  scene.add(gates.object, pathLayer.object, systems.object, markersLayer.object, labels.object)
  markersLayer.set(markers, prepared)
  pathLayer.set(
    pathIds.map((id) => prepared.indexOf(id)),
    prepared,
  )
  renderer.setClearColor(toSceneColor(parseColor(theme.background)), 1)

  // Camera
  const morphFor = (v: MapView) => (v === '3d' ? 1 : 0)
  let tween: Tween | null = null
  let cameraChanged = true
  let focusIds: readonly number[] = options.focus ?? []
  let autoFocus = options.autoFocus ?? null
  let following = !options.camera
  let autoFocusTimer: number | undefined

  const measure = () => {
    width = canvas.clientWidth || canvas.width || 300
    height = canvas.clientHeight || canvas.height || 150
  }
  measure()

  /** Interleaved morphed xyz of the given systems */
  const pointsOf = (indices: readonly number[], morph: number): Float32Array => {
    const points = new Float32Array(indices.length * 3)
    const p: [number, number, number] = [0, 0, 0]
    indices.forEach((i, k) => points.set(morphPosition(prepared.position, prepared.position2d, morph, i, p), k * 3))
    return points
  }

  /** Neutral pose framing the focus systems, or every system when none resolve. */
  const followPose = (forView: MapView): CameraPose => {
    let indices = focusIds.map((id) => prepared.indexOf(id)).filter((i) => i >= 0)
    const whole = indices.length === 0
    if (whole) {
      indices = Array.from(prepared.id, (_, i) => i)
    }
    const next: CameraPose = {
      target: [0, 0, 0],
      viewHeight: FIT_VIEW_HEIGHT,
      azimuth: 0,
      polar: forView === '3d' ? DEFAULT_POLAR_3D : 0,
      fov: forView === '3d' ? FOV_3D : FOV_2D,
      morph: morphFor(forView),
    }
    const fit = fitPoints(pointsOf(indices, next.morph), next, width / height, whole ? 0.05 : 0.15)
    next.target = fit.target
    next.viewHeight = clamp(
      whole ? fit.viewHeight : Math.max(MIN_FOCUS_VIEW_HEIGHT, fit.viewHeight),
      MIN_VIEW_HEIGHT,
      MAX_VIEW_HEIGHT,
    )
    return next
  }

  let pose: CameraPose = followPose(view)
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
  let projection: Projection = createProjection(prepared.id.length)
  let projectionStale = true
  let grid: ScreenGrid | null = null

  const sizeScale = () => clamp((2 / pose.viewHeight) ** 0.3, 1, 3)

  const ensureProjection = (): Projection => {
    if (projectionStale) {
      const m = viewProjection()
      projectSystems(
        projection,
        prepared.position,
        prepared.position2d,
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

  const viewProjection = () => {
    camera.updateMatrixWorld()
    return camera.projectionMatrix.clone().multiply(camera.matrixWorldInverse).elements
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
    emit('hover', { systemId: next === null ? null : prepared.id[next], index: next, screen, originalEvent: event })
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
      render(now)
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

  const render = (now: number) => {
    const scale = sizeScale()
    for (const layer of [systems, gates, markersLayer, pathLayer, labels]) {
      layer.uniforms.uMorph.value = pose.morph
    }
    systems.uniforms.uPixelRatio.value = pixelRatio
    systems.uniforms.uSizeScale.value = scale
    markersLayer.uniforms.uPixelRatio.value = pixelRatio
    pathLayer.uniforms.uViewport.value.set(width, height)
    labels.uniforms.uViewport.value.set(width, height)

    const fading = labels.update({
      data: prepared,
      projection: ensureProjection(),
      matrix: viewProjection(),
      morph: pose.morph,
      zoom: viewHeightToZoom(pose.viewHeight),
      sizes: systems.sizes.array as Float32Array,
      sizeScale: scale,
      priority: priorityIndices(),
      width,
      height,
      pixelRatio,
      now,
      fade: reducedMotion() ? 0 : LABEL_FADE,
    })
    if (fading) {
      needsRender = true
    }

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

  const follow = (animate: boolean) => {
    if (!following || disposed) {
      return
    }
    orbit3d = { azimuth: 0, polar: DEFAULT_POLAR_3D }
    void startTween(followPose(view), { animate })
  }

  /** Pauses following until `autoFocus` ms pass without further camera input. */
  const takeControl = () => {
    following = false
    win.clearTimeout(autoFocusTimer)
    if (autoFocus !== null) {
      autoFocusTimer = win.setTimeout(() => {
        following = true
        follow(true)
      }, autoFocus)
    }
  }

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
        return prepared.systemsInRegion(target)
      }
      if (target >= CONSTELLATION_MIN && target < SYSTEM_MIN) {
        return prepared.systemsInConstellation(target)
      }
      const i = prepared.indexOf(target)
      return i >= 0 ? [i] : []
    }
    return target.map((id) => prepared.indexOf(id)).filter((i) => i >= 0)
  }

  // Public API
  const getCamera = (): CameraState => ({
    target: [...pose.target],
    zoom: viewHeightToZoom(pose.viewHeight),
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
      const before = morphPosition(prepared.position, prepared.position2d, to.morph, anchor)
      const after = morphPosition(prepared.position, prepared.position2d, morph, anchor)
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
    if (following) {
      orbit3d = { azimuth: 0, polar: DEFAULT_POLAR_3D }
      return startTween(followPose(next), animation)
    }
    return startTween(to, animation)
  }

  const pickAnchor = (target: readonly number[], morph: number): number | null => {
    let best: number | null = null
    let bestDistance = Infinity
    const p: [number, number, number] = [0, 0, 0]
    for (let i = 0; i < prepared.id.length; i++) {
      morphPosition(prepared.position, prepared.position2d, morph, i, p)
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
    const indices = resolveFocusIndices(target)
    if (indices.length === 0) {
      return Promise.resolve()
    }
    takeControl()
    const to = destination()
    const fit = fitPoints(pointsOf(indices, to.morph), to, width / height, focusOptions.padding ?? 0.15)
    to.target = fit.target
    to.viewHeight = clamp(
      focusOptions.zoom !== undefined
        ? zoomToViewHeight(focusOptions.zoom)
        : Math.max(MIN_FOCUS_VIEW_HEIGHT, fit.viewHeight),
      MIN_VIEW_HEIGHT,
      MAX_VIEW_HEIGHT,
    )
    return startTween(to, focusOptions)
  }

  const setCamera = (state: Partial<CameraState>, animation: AnimationOptions = { animate: false }) => {
    if (disposed) {
      return Promise.resolve()
    }
    takeControl()
    const to = { ...destination(), ...normalizeCamera(state, view) }
    if (view === '3d') {
      orbit3d = { azimuth: to.azimuth, polar: to.polar }
    }
    return startTween(to, animation)
  }

  const setSystemStyle = (partial: SystemStyle) => {
    style = { ...style, ...partial }
    const n = prepared.id.length
    let changed = 0
    if ('color' in partial) {
      changed += uploadRanges(systems.colors, resolveColors(style.color, prepared.security))
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
    const changed = uploadRanges(systems.flags, resolveFlags(style.visible, highlightIndices(), prepared.id.length))
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
      pathIds.map((id) => prepared.indexOf(id)),
      prepared,
    )
    invalidate()
  }

  const setMarkers = (next: readonly Marker[]) => {
    if (sameMarkers(next, markers)) {
      return
    }
    markers = [...next]
    markersLayer.set(markers, prepared)
    invalidate()
  }

  const setTheme = (partial: Partial<MapTheme>) => {
    theme = { ...theme, ...partial }
    renderer.setClearColor(toSceneColor(parseColor(theme.background)), 1)
    gates.uniforms.uGate.value.set(...parseColor(theme.gate))
    gates.uniforms.uGateRegional.value.set(...parseColor(theme.gateRegional))
    systems.uniforms.uHighlight.value.set(...parseColor(theme.highlight))
    pathLayer.uniforms.uColor.value.set(...parseColor(theme.path))
    labels.setColors(labelColors())
    invalidate()
  }

  const setLabels = (labelOptions: LabelOptions) => {
    labels.setOptions(labelOptions)
    invalidate()
  }

  const setControls = (enabled: boolean) => controls.setEnabled(enabled)

  const setFocus = (ids: readonly number[]) => {
    if (sameList(ids, focusIds)) {
      return
    }
    focusIds = [...ids]
    follow(true)
  }

  const setAutoFocus = (ms: number | null) => {
    autoFocus = ms
    if (!following) {
      takeControl()
    }
  }

  const setData = (next: MapData) => {
    validateMapData(next)
    data = next
    prepared = prepareMap(data)
    scene.remove(systems.object, gates.object)
    systems.dispose()
    gates.dispose()
    systems = buildSystems()
    gates = new GatesLayer(prepared, parseColor(theme.gate), parseColor(theme.gateRegional))
    gates.updateVisibility(systems.flags.array as Float32Array)
    scene.add(gates.object, systems.object)
    markersLayer.set(markers, prepared)
    pathLayer.set(
      pathIds.map((id) => prepared.indexOf(id)),
      prepared,
    )
    projection = createProjection(prepared.id.length)
    projectionStale = true
    hoverIndex = null
    labels.reset()
    follow(false)
    invalidate()
  }

  const pick = (x: number, y: number) => pickIndex(x, y)

  const project = (systemId: number | null | undefined): ProjectedSystem | null => {
    if (systemId === null || systemId === undefined) {
      return null
    }
    const i = prepared.indexOf(systemId)
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
    cameraChanged = true
    if (!tween) {
      follow(false)
    }
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

  const controls = attachControls(
    canvas,
    {
      is3d: () => view === '3d',
      pan: (dx, dy) => {
        takeControl()
        pan(dx, dy)
      },
      orbit: (dAzimuth, dPolar) => {
        takeControl()
        orbit(dAzimuth, dPolar)
      },
      zoomAt: (factor, x, y) => {
        takeControl()
        zoomAt(factor, x, y)
      },
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
          systemId: i === null ? null : prepared.id[i],
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
          systemId: i === null ? null : prepared.id[i],
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
        emit('click', { systemId: i === null ? null : prepared.id[i], index: i, screen, originalEvent: event })
      },
      size: () => ({ width, height }),
    },
    options.controls ?? true,
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
    win.clearTimeout(autoFocusTimer)
    controls.detach()
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
    setControls,
    setFocus,
    setAutoFocus,
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
  if (state.zoom !== undefined) {
    out.viewHeight = clamp(zoomToViewHeight(state.zoom), MIN_VIEW_HEIGHT, MAX_VIEW_HEIGHT)
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
