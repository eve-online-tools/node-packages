import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react'

export type ActiveTooltip<T> = { target: T; anchor: Element }

export const tooltipOpenDelayMs = 300
export const tooltipFadeMs = 150
// Time to move the pointer from the node into the tooltip before it closes.
export const tooltipLeaveGraceMs = 100

/**
 * Hover and focus state for tooltips on many nodes. Hover opens after a delay so panning does not flash them.
 * `active` stays set while the tooltip fades out; `open` is false during the fade.
 */
export const useTooltipTrigger = <T>(enabled: boolean, openDelayMs = tooltipOpenDelayMs) => {
  const [active, setActive] = useState<ActiveTooltip<T> | null>(null)
  const [open, setOpen] = useState(false)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Focus that follows a pointer press is not keyboard focus and should not open the tooltip.
  const pointerPressed = useRef(false)

  const clearTimers = () => {
    clearTimeout(openTimer.current)
    clearTimeout(closeTimer.current)
  }

  const show = useCallback((next: ActiveTooltip<T>) => {
    clearTimers()
    setActive(next)
    setOpen(true)
  }, [])

  const close = useCallback(() => {
    clearTimers()
    setOpen(false)
    closeTimer.current = setTimeout(() => setActive(null), tooltipFadeMs)
  }, [])

  const closeAfterGrace = () => {
    clearTimers()
    closeTimer.current = setTimeout(close, tooltipLeaveGraceMs)
  }

  useEffect(() => clearTimers, [])

  useEffect(() => {
    if (!open || !enabled) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, enabled, close])

  const getTriggerProps = (target: T) =>
    enabled
      ? {
          onPointerEnter: (event: PointerEvent<Element>) => {
            const anchor = event.currentTarget
            clearTimers()
            openTimer.current = setTimeout(() => show({ target, anchor }), openDelayMs)
          },
          onPointerLeave: () => {
            pointerPressed.current = false
            closeAfterGrace()
          },
          onPointerDown: () => {
            pointerPressed.current = true
            close()
          },
          onPointerUp: () => {
            pointerPressed.current = false
          },
          onFocus: (event: FocusEvent<Element>) => {
            if (!pointerPressed.current) {
              show({ target, anchor: event.currentTarget })
            }
          },
          onBlur: close,
        }
      : {}

  const tooltipProps = {
    onPointerEnter: () => {
      if (open) {
        clearTimers()
      }
    },
    onPointerLeave: close,
  }

  return {
    active: enabled ? active : null,
    open: enabled && open,
    close,
    getTriggerProps,
    tooltipProps,
  }
}
