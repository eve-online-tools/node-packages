import { useCallback, useEffect, useRef, useState, type FocusEvent, type PointerEvent } from 'react'

export type ActiveTooltip<T> = { target: T; anchor: Element }

export const tooltipOpenDelayMs = 300

/** Hover and focus state for tooltips on many nodes. Hover opens after a delay so panning does not flash them. */
export const useTooltipTrigger = <T>(enabled: boolean, openDelayMs = tooltipOpenDelayMs) => {
  const [active, setActive] = useState<ActiveTooltip<T> | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  // Focus that follows a pointer press is not keyboard focus and should not open the tooltip.
  const pointerPressed = useRef(false)

  const clearTimer = () => {
    clearTimeout(timer.current)
    timer.current = undefined
  }

  const close = useCallback(() => {
    clearTimer()
    setActive(null)
  }, [])

  useEffect(() => clearTimer, [])

  useEffect(() => {
    if (active === null || !enabled) {
      return
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        close()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [active, enabled, close])

  const getTriggerProps = (target: T) =>
    enabled
      ? {
          onPointerEnter: (event: PointerEvent<Element>) => {
            const anchor = event.currentTarget
            clearTimer()
            timer.current = setTimeout(() => setActive({ target, anchor }), openDelayMs)
          },
          onPointerLeave: () => {
            pointerPressed.current = false
            close()
          },
          onPointerDown: () => {
            pointerPressed.current = true
            close()
          },
          onPointerUp: () => {
            pointerPressed.current = false
          },
          onFocus: (event: FocusEvent<Element>) => {
            if (pointerPressed.current) {
              return
            }

            clearTimer()
            setActive({ target, anchor: event.currentTarget })
          },
          onBlur: close,
        }
      : {}

  return { active: enabled ? active : null, close, getTriggerProps }
}
