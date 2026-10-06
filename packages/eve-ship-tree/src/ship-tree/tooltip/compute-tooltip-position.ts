export type TooltipRect = { left: number; top: number; width: number; height: number }

/** Direction the pointer points in, towards the anchor. */
export type TooltipPointer = 'left' | 'right' | 'topleft' | 'topright' | 'bottomleft' | 'bottomright'

export type TooltipPosition = {
  left: number
  top: number
  side: 'left' | 'right'
  pointer: TooltipPointer
  /** Pointer offset from the tooltip's top edge; only used by `left` and `right` pointers. */
  arrowTop: number
}

export type ComputeTooltipPositionOptions = {
  anchor: TooltipRect
  tooltip: { width: number; height: number }
  viewport: { width: number; height: number }
  gap?: number
  margin?: number
  arrowSize?: number
}

const clamp = (value: number, min: number, max: number): number => Math.max(min, Math.min(max, value))

/** Places the tooltip right of the anchor, or left when it does not fit, kept inside the viewport. */
export const computeTooltipPosition = ({
  anchor,
  tooltip,
  viewport,
  gap = 12,
  margin = 8,
  arrowSize = 12,
}: ComputeTooltipPositionOptions): TooltipPosition => {
  const rightLeft = anchor.left + anchor.width + gap
  const leftLeft = anchor.left - gap - tooltip.width
  const fitsRight = rightLeft + tooltip.width <= viewport.width - margin
  const fitsLeft = leftLeft >= margin
  const side = fitsRight || !fitsLeft ? 'right' : 'left'
  const left = clamp(
    side === 'right' ? rightLeft : leftLeft,
    margin,
    Math.max(margin, viewport.width - margin - tooltip.width),
  )

  const anchorCenterY = anchor.top + anchor.height / 2
  const top = clamp(
    anchorCenterY - tooltip.height / 2,
    margin,
    Math.max(margin, viewport.height - margin - tooltip.height),
  )
  const anchorOffset = anchorCenterY - top
  const arrowTop = clamp(anchorOffset, arrowSize, Math.max(arrowSize, tooltip.height - arrowSize))
  // The anchor is past a corner when the tooltip is pushed down or up by the viewport edge.
  const corner = anchorOffset < arrowSize ? 'top' : anchorOffset > tooltip.height - arrowSize ? 'bottom' : ''
  const towards = side === 'right' ? 'left' : 'right'
  const pointer = `${corner}${towards}` as TooltipPointer

  return { left, top, side, pointer, arrowTop }
}
