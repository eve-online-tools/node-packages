import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

import { cx } from '../styles-api'
import { computeTooltipPosition, type TooltipPosition } from './compute-tooltip-position'
import classes from './floating-tooltip.module.css'

export type FloatingTooltipProps = {
  anchor: Element
  id?: string
  className?: string
  style?: CSSProperties
  children: ReactNode
}

const samePosition = (a: TooltipPosition | null, b: TooltipPosition): boolean =>
  a !== null && a.left === b.left && a.top === b.top && a.side === b.side && a.arrowTop === b.arrowTop

/** Fixed-position tooltip next to `anchor`. Follows the anchor every frame so it tracks pan and zoom. */
export const FloatingTooltip = ({ anchor, id, className, style, children }: FloatingTooltipProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<TooltipPosition | null>(null)

  useLayoutEffect(() => {
    let frame = 0

    const update = () => {
      const element = ref.current

      if (element) {
        const anchorRect = anchor.getBoundingClientRect()
        const next = computeTooltipPosition({
          anchor: anchorRect,
          tooltip: { width: element.offsetWidth, height: element.offsetHeight },
          viewport: { width: window.innerWidth, height: window.innerHeight },
        })

        setPosition((current) => (samePosition(current, next) ? current : next))
      }

      frame = requestAnimationFrame(update)
    }

    update()

    return () => cancelAnimationFrame(frame)
  }, [anchor])

  return createPortal(
    <div
      ref={ref}
      id={id}
      role="tooltip"
      className={cx(classes.root, className)}
      data-side={position?.side ?? 'right'}
      style={
        {
          ...style,
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          visibility: position === null ? 'hidden' : undefined,
          '--ship-tree-tooltip-arrow-top': `${position?.arrowTop ?? 0}px`,
        } as CSSProperties
      }
    >
      {children}
    </div>,
    document.body,
  )
}
