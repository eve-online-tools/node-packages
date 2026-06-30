import { useGesture } from '@use-gesture/react'
import { motion, useMotionValue } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

import { pinchAtOrigin, zoomAtPoint } from './pan-zoom-math'
import classes from './pan-zoom-viewport.module.css'
import { useInitialFit } from './use-initial-fit'

export type PanZoomOptions = {
  minScale?: number
  maxScale?: number
  initialScale?: 'fit' | number
  wheelZoom?: boolean
  pinchZoom?: boolean
  pan?: boolean
}

const defaultPanZoomOptions: Required<Pick<PanZoomOptions, 'wheelZoom' | 'pinchZoom' | 'pan'>> & {
  initialScale: 'fit' | number
} = {
  initialScale: 'fit',
  wheelZoom: true,
  pinchZoom: true,
  pan: true,
}

export const resolvePanZoomOptions = (panZoom?: boolean | PanZoomOptions): PanZoomOptions | null => {
  if (panZoom === false) {
    return null
  }

  if (panZoom === true || panZoom === undefined) {
    return defaultPanZoomOptions
  }

  return { ...defaultPanZoomOptions, ...panZoom }
}

export type PanZoomViewportProps = {
  children: ReactNode
  contentWidth?: number
  contentHeight?: number
  options?: PanZoomOptions
  className?: string
  style?: CSSProperties
}

type PinchMemo = [number, number, number]

export const PanZoomViewport = ({
  children,
  contentWidth: contentWidthProp,
  contentHeight: contentHeightProp,
  options = {},
  className,
  style,
}: PanZoomViewportProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const scale = useMotionValue(1)
  const [scaleBounds, setScaleBounds] = useState({ minScale: 0.1, maxScale: 4 })
  const [measuredSize, setMeasuredSize] = useState({ width: 0, height: 0 })

  const mergedOptions = { ...defaultPanZoomOptions, ...options }

  const contentWidth = contentWidthProp ?? measuredSize.width
  const contentHeight = contentHeightProp ?? measuredSize.height

  useEffect(() => {
    if (contentWidthProp !== undefined && contentHeightProp !== undefined) {
      return
    }

    const element = contentRef.current

    if (!element) {
      return
    }

    const updateSize = () => {
      setMeasuredSize({
        width: element.offsetWidth,
        height: element.offsetHeight,
      })
    }

    updateSize()

    const observer = new ResizeObserver(updateSize)
    observer.observe(element)

    return () => observer.disconnect()
  }, [children, contentHeightProp, contentWidthProp])

  const onFitScaleChange = useCallback((_fitScale: number, bounds: { minScale: number; maxScale: number }) => {
    setScaleBounds(bounds)
  }, [])

  useInitialFit({
    containerRef,
    contentWidth,
    contentHeight,
    x,
    y,
    scale,
    options: mergedOptions,
    onFitScaleChange,
  })

  const getLocalPoint = useCallback((clientX: number, clientY: number) => {
    const rect = containerRef.current?.getBoundingClientRect()

    if (!rect) {
      return { x: clientX, y: clientY }
    }

    return { x: clientX - rect.left, y: clientY - rect.top }
  }, [])

  useGesture(
    {
      onDrag: ({ offset: [dx, dy], pinching, cancel }) => {
        if (!mergedOptions.pan || pinching) {
          cancel()
          return
        }

        x.set(dx)
        y.set(dy)
      },
      onPinch: ({ origin: [ox, oy], offset: [pinchOffset], first, memo }) => {
        if (!mergedOptions.pinchZoom) {
          return memo
        }

        const nextMemo: PinchMemo = first ? [x.get(), y.get(), scale.get()] : (memo as PinchMemo)
        const [initialX, initialY, initialScale] = nextMemo
        const local = getLocalPoint(ox, oy)
        const result = pinchAtOrigin(
          initialX,
          initialY,
          initialScale,
          local.x,
          local.y,
          pinchOffset,
          scaleBounds.minScale,
          scaleBounds.maxScale,
        )

        x.set(result.x)
        y.set(result.y)
        scale.set(result.scale)

        return nextMemo
      },
      onWheel: ({ event, delta: [, dy] }) => {
        if (!mergedOptions.wheelZoom) {
          return
        }

        event.preventDefault()

        const local = getLocalPoint(event.clientX, event.clientY)
        const result = zoomAtPoint(
          x.get(),
          y.get(),
          scale.get(),
          local.x,
          local.y,
          1 - dy * 0.001,
          scaleBounds.minScale,
          scaleBounds.maxScale,
        )

        x.set(result.x)
        y.set(result.y)
        scale.set(result.scale)
      },
    },
    {
      target: containerRef,
      eventOptions: { passive: false },
      ...(mergedOptions.pan
        ? {
            drag: {
              from: () => [x.get(), y.get()],
              filterTaps: true,
            },
          }
        : {}),
      ...(mergedOptions.pinchZoom ? { pinch: { rubberband: true } } : {}),
    },
  )

  return (
    <div
      ref={containerRef}
      className={[classes.root, className].filter(Boolean).join(' ')}
      style={style}
      data-testid="pan-zoom-viewport"
    >
      <motion.div
        className={classes.transformLayer}
        style={{ x, y, scale }}
      >
        <div
          ref={contentRef}
          className={classes.content}
        >
          {children}
        </div>
      </motion.div>
    </div>
  )
}
