export interface ControlsHost {
  is3d: () => boolean
  pan: (dx: number, dy: number) => void
  orbit: (dx: number, dy: number) => void
  /** factor > 1 zooms out */
  zoomAt: (factor: number, x: number, y: number) => void
  hover: (x: number, y: number, event: PointerEvent) => void
  leave: (event: PointerEvent) => void
  click: (x: number, y: number, event: MouseEvent) => void
  contextmenu: (x: number, y: number, event: MouseEvent) => boolean
  /** Arrow key navigation, re-targets the keyboard focus to the system nearest the view center */
  keyboardNavigate: (event: KeyboardEvent) => void
  keyboardSelect: (event: KeyboardEvent) => void
  size: () => { width: number; height: number }
}

export interface ControlsOptions {
  /** Default true */
  enabled?: boolean
  /** Default true */
  keyboard?: boolean
}

const CLICK_SLOP = 4
const ORBIT_SPEED = 0.006
const KEY_PAN = 48
const KEY_ZOOM = 1.25

interface ActivePointer {
  x: number
  y: number
}

/** Pointer, wheel, touch and keyboard handling. Returns a teardown function. */
export const attachControls = (
  canvas: HTMLCanvasElement,
  host: ControlsHost,
  options: ControlsOptions,
): (() => void) => {
  if (options.enabled === false) {
    return () => {}
  }

  const pointers = new Map<number, ActivePointer>()
  let downX = 0
  let downY = 0
  let downButton = 0
  let moved = false
  let rightDragged = false
  let panMode = false
  let pinchDistance = 0
  let pinchMidX = 0
  let pinchMidY = 0

  const local = (event: MouseEvent): [number, number] => {
    const rect = canvas.getBoundingClientRect()
    return [event.clientX - rect.left, event.clientY - rect.top]
  }

  const pinchState = (): [number, number, number] => {
    const [a, b] = [...pointers.values()]
    return [Math.hypot(a.x - b.x, a.y - b.y), (a.x + b.x) / 2, (a.y + b.y) / 2]
  }

  const onPointerDown = (event: PointerEvent) => {
    const [x, y] = local(event)
    pointers.set(event.pointerId, { x, y })
    canvas.setPointerCapture?.(event.pointerId)
    if (pointers.size === 1) {
      downX = x
      downY = y
      downButton = event.button
      moved = false
      rightDragged = false
      panMode = !host.is3d() || event.button === 1 || event.button === 2 || event.shiftKey || event.ctrlKey
      canvas.style.cursor = 'grabbing'
    } else if (pointers.size === 2) {
      ;[pinchDistance, pinchMidX, pinchMidY] = pinchState()
      moved = true
    }
  }

  const onPointerMove = (event: PointerEvent) => {
    const [x, y] = local(event)
    const pointer = pointers.get(event.pointerId)
    if (!pointer) {
      if (event.pointerType !== 'touch') {
        host.hover(x, y, event)
      }
      return
    }

    const dx = x - pointer.x
    const dy = y - pointer.y
    pointer.x = x
    pointer.y = y

    if (pointers.size >= 2) {
      const [distance, midX, midY] = pinchState()
      if (pinchDistance > 0 && distance > 0) {
        host.zoomAt(pinchDistance / distance, midX, midY)
      }
      host.pan(midX - pinchMidX, midY - pinchMidY)
      pinchDistance = distance
      pinchMidX = midX
      pinchMidY = midY
      return
    }

    if (!moved && Math.hypot(x - downX, y - downY) > CLICK_SLOP) {
      moved = true
      rightDragged = downButton === 2
    }
    if (!moved) {
      return
    }
    if (panMode) {
      host.pan(dx, dy)
    } else {
      host.orbit(dx * ORBIT_SPEED, dy * ORBIT_SPEED)
    }
  }

  const onPointerUp = (event: PointerEvent) => {
    if (!pointers.has(event.pointerId)) {
      return
    }
    pointers.delete(event.pointerId)
    canvas.releasePointerCapture?.(event.pointerId)
    if (pointers.size === 1) {
      // Continue as a single pointer drag from the remaining finger.
      pinchDistance = 0
      return
    }
    if (pointers.size > 0) {
      return
    }
    canvas.style.cursor = ''
    if (!moved && event.button === 0) {
      const [x, y] = local(event)
      host.click(x, y, event)
    }
  }

  const onPointerCancel = (event: PointerEvent) => {
    pointers.delete(event.pointerId)
    if (pointers.size === 0) {
      canvas.style.cursor = ''
    }
  }

  const onPointerLeave = (event: PointerEvent) => {
    if (pointers.size === 0) {
      host.leave(event)
    }
  }

  const onContextMenu = (event: MouseEvent) => {
    if (rightDragged) {
      event.preventDefault()
      rightDragged = false
      return
    }
    const [x, y] = local(event)
    if (host.contextmenu(x, y, event)) {
      event.preventDefault()
    }
  }

  const onWheel = (event: WheelEvent) => {
    event.preventDefault()
    const { height } = host.size()
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1
    const [x, y] = local(event)
    host.zoomAt(Math.exp(Math.max(-100, Math.min(100, event.deltaY * unit)) * 0.0025), x, y)
  }

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.altKey || event.metaKey) {
      return
    }
    const { width, height } = host.size()
    const orbit = event.shiftKey && host.is3d()
    switch (event.key) {
      case 'ArrowLeft':
        orbit ? host.orbit(-0.1, 0) : host.pan(KEY_PAN, 0)
        break
      case 'ArrowRight':
        orbit ? host.orbit(0.1, 0) : host.pan(-KEY_PAN, 0)
        break
      case 'ArrowUp':
        orbit ? host.orbit(0, -0.1) : host.pan(0, KEY_PAN)
        break
      case 'ArrowDown':
        orbit ? host.orbit(0, 0.1) : host.pan(0, -KEY_PAN)
        break
      case '+':
      case '=':
        host.zoomAt(1 / KEY_ZOOM, width / 2, height / 2)
        break
      case '-':
      case '_':
        host.zoomAt(KEY_ZOOM, width / 2, height / 2)
        break
      case 'Enter':
        event.preventDefault()
        host.keyboardSelect(event)
        return
      default:
        return
    }
    event.preventDefault()
    host.keyboardNavigate(event)
  }

  canvas.style.touchAction = 'none'
  if (options.keyboard !== false && !canvas.hasAttribute('tabindex')) {
    canvas.tabIndex = 0
  }

  canvas.addEventListener('pointerdown', onPointerDown)
  canvas.addEventListener('pointermove', onPointerMove)
  canvas.addEventListener('pointerup', onPointerUp)
  canvas.addEventListener('pointercancel', onPointerCancel)
  canvas.addEventListener('pointerleave', onPointerLeave)
  canvas.addEventListener('contextmenu', onContextMenu)
  canvas.addEventListener('wheel', onWheel, { passive: false })
  if (options.keyboard !== false) {
    canvas.addEventListener('keydown', onKeyDown)
  }

  return () => {
    canvas.removeEventListener('pointerdown', onPointerDown)
    canvas.removeEventListener('pointermove', onPointerMove)
    canvas.removeEventListener('pointerup', onPointerUp)
    canvas.removeEventListener('pointercancel', onPointerCancel)
    canvas.removeEventListener('pointerleave', onPointerLeave)
    canvas.removeEventListener('contextmenu', onContextMenu)
    canvas.removeEventListener('wheel', onWheel)
    canvas.removeEventListener('keydown', onKeyDown)
    canvas.style.touchAction = ''
    canvas.style.cursor = ''
  }
}
