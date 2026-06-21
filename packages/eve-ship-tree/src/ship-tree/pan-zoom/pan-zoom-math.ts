export const clamp = (value: number, min: number, max: number): number => Math.min(max, Math.max(min, value))

export type PanZoomTransform = {
  x: number
  y: number
  scale: number
}

export const computeFitTransform = (
  viewportWidth: number,
  viewportHeight: number,
  contentWidth: number,
  contentHeight: number,
): PanZoomTransform => {
  if (viewportWidth <= 0 || viewportHeight <= 0 || contentWidth <= 0 || contentHeight <= 0) {
    return { x: 0, y: 0, scale: 1 }
  }

  const fitScale = Math.min(viewportWidth / contentWidth, viewportHeight / contentHeight)

  return {
    x: (viewportWidth - contentWidth * fitScale) / 2,
    y: (viewportHeight - contentHeight * fitScale) / 2,
    scale: fitScale,
  }
}

export const resolveScaleBounds = (
  fitScale: number,
  minScale?: number,
  maxScale?: number,
): { minScale: number; maxScale: number } => ({
  minScale: minScale ?? fitScale * 0.25,
  maxScale: maxScale ?? fitScale * 4,
})

export const zoomAtPoint = (
  currentX: number,
  currentY: number,
  currentScale: number,
  pointerX: number,
  pointerY: number,
  scaleFactor: number,
  minScale: number,
  maxScale: number,
): PanZoomTransform => {
  const newScale = clamp(currentScale * scaleFactor, minScale, maxScale)
  const ratio = newScale / currentScale

  return {
    x: pointerX - (pointerX - currentX) * ratio,
    y: pointerY - (pointerY - currentY) * ratio,
    scale: newScale,
  }
}

export const pinchAtOrigin = (
  initialX: number,
  initialY: number,
  initialScale: number,
  originX: number,
  originY: number,
  pinchOffset: number,
  minScale: number,
  maxScale: number,
): PanZoomTransform => {
  const newScale = clamp(initialScale * pinchOffset, minScale, maxScale)
  const ratio = newScale / initialScale

  return {
    x: originX - (originX - initialX) * ratio,
    y: originY - (originY - initialY) * ratio,
    scale: newScale,
  }
}
