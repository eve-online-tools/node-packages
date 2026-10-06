import {
  useLayoutEffect,
  useRef,
  useState,
  type ComponentPropsWithoutRef,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'

import background from 'res:/ui/texture/classes/framewithpointer/background_04.png'
import pointerBottomLeft from 'res:/ui/texture/classes/framewithpointer/pointer_bottomleft_02.png'
import pointerBottomRight from 'res:/ui/texture/classes/framewithpointer/pointer_bottomright_02.png'
import pointerLeft from 'res:/ui/texture/classes/framewithpointer/pointer_left_02.png'
import pointerRight from 'res:/ui/texture/classes/framewithpointer/pointer_right_02.png'
import pointerTopLeft from 'res:/ui/texture/classes/framewithpointer/pointer_topleft_02.png'
import pointerTopRight from 'res:/ui/texture/classes/framewithpointer/pointer_topright_02.png'
import { cx } from '../styles-api'
import { computeTooltipPosition, type TooltipPointer, type TooltipPosition } from './compute-tooltip-position'
import classes from './floating-tooltip.module.css'

export type FloatingTooltipProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  anchor: Element
  /** `false` fades the tooltip out; unmount it after `tooltipFadeMs`. */
  open?: boolean
  children: ReactNode
}

const pointerSprites: Record<TooltipPointer, string> = {
  left: pointerLeft,
  right: pointerRight,
  topleft: pointerTopLeft,
  topright: pointerTopRight,
  bottomleft: pointerBottomLeft,
  bottomright: pointerBottomRight,
}

const samePosition = (a: TooltipPosition | null, b: TooltipPosition): boolean =>
  a !== null &&
  a.left === b.left &&
  a.top === b.top &&
  a.side === b.side &&
  a.pointer === b.pointer &&
  a.arrowTop === b.arrowTop

/** Fixed-position tooltip next to `anchor`. Follows the anchor every frame so it tracks pan and zoom. */
export const FloatingTooltip = ({
  anchor,
  open = true,
  className,
  style,
  children,
  ...others
}: FloatingTooltipProps) => {
  const ref = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<TooltipPosition | null>(null)

  useLayoutEffect(() => {
    let frame = 0

    const update = () => {
      const element = ref.current

      if (element) {
        const next = computeTooltipPosition({
          anchor: anchor.getBoundingClientRect(),
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
      {...others}
      ref={ref}
      role="tooltip"
      className={cx(classes.root, className)}
      data-side={position?.side ?? 'right'}
      data-pointer={position?.pointer ?? 'left'}
      data-state={open ? 'open' : 'closed'}
      style={
        {
          ...style,
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          visibility: position === null ? 'hidden' : undefined,
          '--ship-tree-tooltip-arrow-top': `${position?.arrowTop ?? 0}px`,
          '--ship-tree-tooltip-background': `url("${background}")`,
          '--ship-tree-tooltip-pointer': `url("${pointerSprites[position?.pointer ?? 'left']}")`,
        } as CSSProperties
      }
    >
      {children}
    </div>,
    document.body,
  )
}
