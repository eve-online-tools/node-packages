import type { MotionValue } from 'motion/react'
import { useEffect, useRef, type RefObject } from 'react'

import { computeFitTransform, resolveScaleBounds } from './pan-zoom-math'

export type InitialFitOptions = {
  minScale?: number
  maxScale?: number
  initialScale?: 'fit' | number
}

type UseInitialFitInput = {
  containerRef: RefObject<HTMLElement | null>
  contentWidth: number
  contentHeight: number
  x: MotionValue<number>
  y: MotionValue<number>
  scale: MotionValue<number>
  options: InitialFitOptions
  onFitScaleChange: (fitScale: number, bounds: { minScale: number; maxScale: number }) => void
}

export const useInitialFit = ({
  containerRef,
  contentWidth,
  contentHeight,
  x,
  y,
  scale,
  options,
  onFitScaleChange,
}: UseInitialFitInput): void => {
  const optionsRef = useRef(options)
  optionsRef.current = options

  useEffect(() => {
    const element = containerRef.current

    if (!element) {
      return
    }

    const applyFit = () => {
      if (contentWidth <= 0 || contentHeight <= 0) {
        return
      }

      const { width, height } = element.getBoundingClientRect()
      const fit = computeFitTransform(width, height, contentWidth, contentHeight)
      const bounds = resolveScaleBounds(fit.scale, optionsRef.current.minScale, optionsRef.current.maxScale)
      const initialScale = optionsRef.current.initialScale

      onFitScaleChange(fit.scale, bounds)

      if (initialScale === 'fit' || initialScale === undefined) {
        x.set(fit.x)
        y.set(fit.y)
        scale.set(fit.scale)
        return
      }

      const targetScale = clampInitialScale(initialScale, bounds.minScale, bounds.maxScale)
      const scaledWidth = contentWidth * targetScale
      const scaledHeight = contentHeight * targetScale

      x.set((width - scaledWidth) / 2)
      y.set((height - scaledHeight) / 2)
      scale.set(targetScale)
    }

    applyFit()

    const observer = new ResizeObserver(applyFit)
    observer.observe(element)

    return () => observer.disconnect()
  }, [containerRef, contentWidth, contentHeight, onFitScaleChange, scale, x, y])
}

const clampInitialScale = (value: number, minScale: number, maxScale: number): number =>
  Math.min(maxScale, Math.max(minScale, value))
