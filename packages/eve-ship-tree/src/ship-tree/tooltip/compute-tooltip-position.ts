export type TooltipRect = { left: number; top: number; width: number; height: number }

/** `horizontal` places the tooltip right or left of the anchor, `vertical` above or below it. */
export type TooltipPlacement = 'horizontal' | 'vertical'

export type TooltipSide = 'left' | 'right' | 'top' | 'bottom'

/** Direction the pointer points in, towards the anchor. */
export type TooltipPointer = 'left' | 'right' | 'up' | 'down' | 'topleft' | 'topright' | 'bottomleft' | 'bottomright'

export type TooltipPosition = {
  left: number
  top: number
  side: TooltipSide
  pointer: TooltipPointer
  /** Pointer offset along the edge facing the anchor; only used by `left`, `right`, `up` and `down` pointers. */
  arrowOffset: number
}

export type ComputeTooltipPositionOptions = {
  anchor: TooltipRect
  tooltip: { width: number; height: number }
  viewport: { width: number; height: number }
  placement?: TooltipPlacement
  gap?: number
  margin?: number
  arrowSize?: number
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

const axes = {
  horizontal: { start: 'left', size: 'width', crossStart: 'top', crossSize: 'height' },
  vertical: { start: 'top', size: 'height', crossStart: 'left', crossSize: 'width' },
} as const

const resolvePointer = (side: TooltipSide, corner: 'start' | 'end' | undefined): TooltipPointer => {
  switch (side) {
    case 'right':
    case 'left': {
      const towards = side === 'right' ? 'left' : 'right'
      return corner === undefined ? towards : `${corner === 'start' ? 'top' : 'bottom'}${towards}`
    }
    case 'bottom':
    case 'top': {
      const edge = side === 'bottom' ? 'top' : 'bottom'
      if (corner === undefined) {
        return side === 'bottom' ? 'up' : 'down'
      }
      return `${edge}${corner === 'start' ? 'left' : 'right'}`
    }
  }
}

/**
 * Places the tooltip next to the anchor, kept inside the viewport.
 * Horizontal prefers the right and flips left; vertical prefers above and flips below.
 */
export const computeTooltipPosition = ({
  anchor,
  tooltip,
  viewport,
  placement = 'horizontal',
  gap = 12,
  margin = 8,
  arrowSize = 12,
}: ComputeTooltipPositionOptions): TooltipPosition => {
  const { start, size, crossStart, crossSize } = axes[placement]

  const after = anchor[start] + anchor[size] + gap
  const before = anchor[start] - gap - tooltip[size]
  const fitsAfter = after + tooltip[size] <= viewport[size] - margin
  const fitsBefore = before >= margin
  const useAfter = placement === 'horizontal' ? fitsAfter || !fitsBefore : fitsAfter && !fitsBefore
  const main = clamp(useAfter ? after : before, margin, Math.max(margin, viewport[size] - margin - tooltip[size]))

  const anchorCenter = anchor[crossStart] + anchor[crossSize] / 2
  const cross = clamp(
    anchorCenter - tooltip[crossSize] / 2,
    margin,
    Math.max(margin, viewport[crossSize] - margin - tooltip[crossSize]),
  )
  const anchorOffset = anchorCenter - cross
  const arrowOffset = clamp(anchorOffset, arrowSize, Math.max(arrowSize, tooltip[crossSize] - arrowSize))
  // The anchor is past a corner when the viewport edge pushes the tooltip along its cross axis.
  const corner = anchorOffset < arrowSize ? 'start' : anchorOffset > tooltip[crossSize] - arrowSize ? 'end' : undefined

  const side: TooltipSide = placement === 'horizontal' ? (useAfter ? 'right' : 'left') : useAfter ? 'bottom' : 'top'

  return {
    left: placement === 'horizontal' ? main : cross,
    top: placement === 'horizontal' ? cross : main,
    side,
    pointer: resolvePointer(side, corner),
    arrowOffset,
  }
}
