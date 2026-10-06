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
import pointerDown from 'res:/ui/texture/classes/framewithpointer/pointer_down_02.png'
import pointerLeft from 'res:/ui/texture/classes/framewithpointer/pointer_left_02.png'
import pointerRight from 'res:/ui/texture/classes/framewithpointer/pointer_right_02.png'
import pointerTopLeft from 'res:/ui/texture/classes/framewithpointer/pointer_topleft_02.png'
import pointerTopRight from 'res:/ui/texture/classes/framewithpointer/pointer_topright_02.png'
import pointerUp from 'res:/ui/texture/classes/framewithpointer/pointer_up_02.png'
import { cx } from '../styles-api'
import {
  computeTooltipPosition,
  type TooltipPlacement,
  type TooltipPointer,
  type TooltipPosition,
} from './compute-tooltip-position'
import classes from './floating-tooltip.module.css'

export type FloatingTooltipProps = Omit<ComponentPropsWithoutRef<'div'>, 'children'> & {
  anchor: Element
  /** `false` fades the tooltip out; unmount it after `tooltipFadeMs`. */
  open?: boolean
  /** `horizontal` opens right or left of the anchor, `vertical` above or below it. Defaults to `horizontal`. */
  placement?: TooltipPlacement
  children: ReactNode
}

const pointerSprites: Record<TooltipPointer, string> = {
  left: pointerLeft,
  right: pointerRight,
  up: pointerUp,
  down: pointerDown,
  topleft: pointerTopLeft,
  topright: pointerTopRight,
  bottomleft: pointerBottomLeft,
  bottomright: pointerBottomRight,
}

const defaultPosition = {
  horizontal: { side: 'right', pointer: 'left' },
  vertical: { side: 'top', pointer: 'down' },
} as const satisfies Record<TooltipPlacement, Pick<TooltipPosition, 'side' | 'pointer'>>

const samePosition = (a: TooltipPosition | null, b: TooltipPosition): boolean =>
  a !== null &&
  a.left === b.left &&
  a.top === b.top &&
  a.side === b.side &&
  a.pointer === b.pointer &&
  a.arrowOffset === b.arrowOffset

/** Fixed-position tooltip next to `anchor`. Follows the anchor every frame so it tracks pan and zoom. */
export const FloatingTooltip = ({
  anchor,
  open = true,
  placement = 'horizontal',
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
          placement,
        })

        setPosition((current) => (samePosition(current, next) ? current : next))
      }

      frame = requestAnimationFrame(update)
    }

    update()

    return () => cancelAnimationFrame(frame)
  }, [anchor, placement])

  return createPortal(
    <div
      {...others}
      ref={ref}
      role="tooltip"
      className={cx(classes.root, className)}
      data-side={position?.side ?? defaultPosition[placement].side}
      data-pointer={position?.pointer ?? defaultPosition[placement].pointer}
      data-state={open ? 'open' : 'closed'}
      style={
        {
          ...style,
          left: position?.left ?? 0,
          top: position?.top ?? 0,
          visibility: position === null ? 'hidden' : undefined,
          '--ship-tree-tooltip-arrow-offset': `${position?.arrowOffset ?? 0}px`,
          '--ship-tree-tooltip-background': `url("${background}")`,
          '--ship-tree-tooltip-pointer': `url("${pointerSprites[position?.pointer ?? defaultPosition[placement].pointer]}")`,
        } as CSSProperties
      }
    >
      {children}
    </div>,
    document.body,
  )
}
