import { describe, expect, it } from 'vitest'

import { clamp, computeFitTransform, pinchAtOrigin, resolveScaleBounds, zoomAtPoint } from './pan-zoom-math'

describe('pan-zoom-math', () => {
  describe('clamp', () => {
    it('clamps values to the given range', () => {
      expect(clamp(5, 0, 10)).toBe(5)
      expect(clamp(-1, 0, 10)).toBe(0)
      expect(clamp(11, 0, 10)).toBe(10)
    })
  })

  describe('computeFitTransform', () => {
    it('fits content inside the viewport and centers it', () => {
      expect(computeFitTransform(400, 300, 800, 600)).toEqual({
        x: 0,
        y: 0,
        scale: 0.5,
      })
    })

    it('centers content when the viewport aspect ratio leaves extra space', () => {
      expect(computeFitTransform(1000, 800, 400, 300)).toEqual({
        x: 0,
        y: 25,
        scale: 2.5,
      })
    })

    it('returns a neutral transform for invalid dimensions', () => {
      expect(computeFitTransform(0, 300, 800, 600)).toEqual({ x: 0, y: 0, scale: 1 })
    })
  })

  describe('resolveScaleBounds', () => {
    it('derives bounds from fit scale when custom bounds are omitted', () => {
      expect(resolveScaleBounds(0.5)).toEqual({
        minScale: 0.125,
        maxScale: 2,
      })
    })

    it('uses explicit bounds when provided', () => {
      expect(resolveScaleBounds(0.5, 0.2, 3)).toEqual({
        minScale: 0.2,
        maxScale: 3,
      })
    })
  })

  describe('zoomAtPoint', () => {
    it('zooms toward the pointer and keeps the pointer position stable', () => {
      const result = zoomAtPoint(0, 0, 1, 100, 100, 2, 0.25, 4)

      expect(result.scale).toBe(2)
      expect(result.x).toBe(-100)
      expect(result.y).toBe(-100)
    })

    it('clamps zoom to the configured bounds', () => {
      expect(zoomAtPoint(0, 0, 1, 100, 100, 10, 0.5, 2).scale).toBe(2)
    })
  })

  describe('pinchAtOrigin', () => {
    it('zooms around the pinch origin', () => {
      const result = pinchAtOrigin(0, 0, 1, 100, 100, 2, 0.25, 4)

      expect(result.scale).toBe(2)
      expect(result.x).toBe(-100)
      expect(result.y).toBe(-100)
    })
  })
})
