import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'

import {
  createMap,
  WebGLUnavailableError,
  type AnimationOptions,
  type CameraState,
  type ControlsOptions,
  type CreateMapOptions,
  type EveMap as EveMapInstance,
  type LabelOptions,
  type MapData,
  type MapTheme,
  type MapView,
  type Marker,
  type SystemEvent,
  type SystemStyle,
  type TransitionOptions,
} from '../index'

/** The map instance as seen by children. `setView` respects a controlled `view` prop. */
export type EveMapApi = EveMapInstance

export interface EveMapProps {
  data: MapData
  /** Controlled view. Pair with `onViewChange`. */
  view?: MapView
  /** Uncontrolled initial view. Default `2d`. */
  defaultView?: MapView
  onViewChange?: (view: MapView) => void
  /** Controlled camera. Interaction still moves the map and reports through `onCameraChange`. */
  camera?: Partial<CameraState>
  defaultCamera?: Partial<CameraState>
  onCameraChange?: (camera: CameraState) => void
  markers?: readonly Marker[]
  /** System IDs */
  highlight?: readonly number[]
  /** System IDs in route order */
  path?: readonly number[]
  systemStyle?: SystemStyle
  theme?: Partial<MapTheme>
  labels?: LabelOptions
  transition?: TransitionOptions
  /** Creation only */
  pixelRatio?: number
  /** Creation only */
  antialias?: boolean
  /** Creation only */
  controls?: ControlsOptions
  /** Creation only */
  reducedMotion?: boolean
  onSystemClick?: (event: SystemEvent) => void
  onSystemHover?: (event: SystemEvent) => void
  onSystemContextMenu?: (event: SystemEvent) => void
  onContextLost?: () => void
  onReady?: (map: EveMapApi) => void
  /** Rendered instead of the map when WebGL 2 is unavailable */
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
  /** Overlay content. A function child re-renders on every camera change, for positioning with `api.project`. */
  children?: ReactNode | ((api: EveMapApi) => ReactNode)
}

const EveMapContext = createContext<EveMapApi | null>(null)

/** The enclosing `<EveMap>` instance, or null before it is ready. */
export const useEveMap = (): EveMapApi | null => useContext(EveMapContext)

const sameArray = <T,>(a: readonly T[] | undefined, b: readonly T[] | undefined): boolean => {
  if (a === b) {
    return true
  }
  if (!a || !b || a.length !== b.length) {
    return false
  }
  return a.every((value, i) => Object.is(value, b[i]))
}

const sameCamera = (camera: Partial<CameraState>, current: CameraState): boolean => {
  const close = (a: number | undefined, b: number) => a === undefined || Math.abs(a - b) < 1e-6
  return (
    (!camera.target || camera.target.every((v, i) => close(v, current.target[i]))) &&
    close(camera.viewHeight, current.viewHeight) &&
    close(camera.azimuth, current.azimuth) &&
    close(camera.polar, current.polar)
  )
}

const sameCameraProp = (a: Partial<CameraState> | undefined, b: Partial<CameraState> | undefined): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    sameArray(a.target, b.target) &&
    a.viewHeight === b.viewHeight &&
    a.azimuth === b.azimuth &&
    a.polar === b.polar)

/** Runs `apply` when `value` changes, skipping values equal to the last applied one. */
const useApply = <T,>(
  map: EveMapInstance | null,
  value: T,
  apply: (map: EveMapInstance, value: T) => void,
  equal: (a: T, b: T) => boolean = Object.is,
) => {
  const last = useRef<{ map: EveMapInstance; value: T } | null>(null)
  useEffect(() => {
    if (!map) {
      return
    }
    if (last.current?.map === map && equal(last.current.value, value)) {
      return
    }
    last.current = { map, value }
    apply(map, value)
  })
}

const fill: CSSProperties = { position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block' }

export function EveMap(props: EveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const propsRef = useRef(props)
  // Runs before the mount effect below, so handlers and initial options always see current props.
  useLayoutEffect(() => {
    propsRef.current = props
  })
  const [map, setMap] = useState<EveMapInstance | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [failure, setFailure] = useState<unknown>(null)
  const [, setCameraVersion] = useState(0)

  if (failure) {
    throw failure
  }

  useEffect(() => {
    const container = containerRef.current
    if (!container) {
      return
    }
    // A fresh canvas per mount: a disposed map releases its context, which can't be reacquired on the same canvas.
    const canvas = container.ownerDocument.createElement('canvas')
    Object.assign(canvas.style, fill)
    container.prepend(canvas)

    const initial = propsRef.current
    const options: CreateMapOptions = {
      data: initial.data,
      view: initial.view ?? initial.defaultView,
      camera: initial.camera ?? initial.defaultCamera,
      transition: initial.transition,
      pixelRatio: initial.pixelRatio,
      antialias: initial.antialias,
      controls: initial.controls,
      reducedMotion: initial.reducedMotion,
    }

    let instance: EveMapInstance
    try {
      instance = createMap(canvas, options)
    } catch (error) {
      canvas.remove()
      if (error instanceof WebGLUnavailableError) {
        setUnavailable(true)
      } else {
        setFailure(error)
      }
      return
    }

    const offs = [
      instance.on('click', (event) => propsRef.current.onSystemClick?.(event)),
      instance.on('hover', (event) => propsRef.current.onSystemHover?.(event)),
      instance.on('contextmenu', (event) => propsRef.current.onSystemContextMenu?.(event)),
      instance.on('contextlost', () => propsRef.current.onContextLost?.()),
      instance.on('viewchange', ({ view }) => {
        if (propsRef.current.view === undefined) {
          propsRef.current.onViewChange?.(view)
        }
      }),
      instance.on('camerachange', ({ camera }) => {
        propsRef.current.onCameraChange?.(camera)
        if (typeof propsRef.current.children === 'function') {
          setCameraVersion((v) => v + 1)
        }
      }),
    ]

    setMap(instance)
    propsRef.current.onReady?.(instance)

    return () => {
      offs.forEach((off) => off())
      instance.dispose()
      canvas.remove()
      setMap(null)
    }
  }, [])

  useApply(map, props.data, (m, data) => {
    if (m.data !== data) {
      m.setData(data)
    }
  })
  useApply(map, props.view, (m, view) => {
    if (view) {
      void m.setView(view)
    }
  })
  useApply(
    map,
    props.camera,
    (m, camera) => {
      if (camera && !sameCamera(camera, m.getCamera())) {
        void m.setCamera(camera)
      }
    },
    sameCameraProp,
  )
  useApply(map, props.markers, (m, markers) => m.setMarkers(markers ?? []))
  useApply(map, props.highlight, (m, highlight) => m.setHighlight(highlight ?? []), sameArray)
  useApply(map, props.path, (m, path) => m.setPath(path ?? []), sameArray)
  // Omitted keys reset to defaults, matching declarative props.
  useApply(map, props.systemStyle, (m, style) =>
    m.setSystemStyle({ color: undefined, size: undefined, visible: undefined, ...style }),
  )
  useApply(map, props.theme, (m, theme) => {
    if (theme) {
      m.setTheme(theme)
    }
  })
  useApply(map, props.labels, (m, labels) => m.setLabels(labels ?? {}))

  const api = useMemo<EveMapApi | null>(() => {
    if (!map) {
      return null
    }
    // Controlled `view`: report intent to the parent instead of changing the map directly.
    return new Proxy(map, {
      get(target, key, receiver) {
        if (key === 'setView') {
          return (view: MapView, options?: AnimationOptions) => {
            if (propsRef.current.view !== undefined) {
              propsRef.current.onViewChange?.(view)
              return Promise.resolve()
            }
            return target.setView(view, options)
          }
        }
        return Reflect.get(target, key, receiver)
      },
    })
  }, [map])

  const { children, className, style, fallback } = props

  return (
    <div
      ref={containerRef}
      className={className}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      {unavailable ? fallback : null}
      <EveMapContext.Provider value={api}>
        {api && typeof children === 'function' ? children(api) : typeof children === 'function' ? null : children}
      </EveMapContext.Provider>
    </div>
  )
}
