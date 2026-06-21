import { describe, expect, it } from 'vitest'

import {
  groupBoxHeight,
  groupBoxWidth,
  groupLabelGap,
  groupShipsPaddingBottom,
  groupShipsPaddingLeft,
  groupShipsPaddingTop,
  groupTopBorderHeight,
  resolveShipNodeSize,
  shipNodeGap,
  shipNodeHeight,
  shipNodeWidth,
} from '../layout-constants'
import { computeGroupVisualBounds, computeShipGroupLayout, resolveGroupShipLayout } from './compute-ship-group-layout'

const groupNodeX = 100
const groupNodeY = 200

const groupTopLeft = {
  x: groupNodeX - groupBoxWidth / 2,
  y: groupNodeY - groupBoxHeight / 2,
}

const origin = {
  x: groupNodeX + groupBoxWidth / 2,
  y: groupTopLeft.y,
}

describe('computeShipGroupLayout', () => {
  it('anchors the container origin to the group node top-right', () => {
    const layout = computeShipGroupLayout({
      groupNodeX,
      groupNodeY,
      shipCount: 1,
    })

    expect(layout.origin).toEqual(origin)
  })

  it('lays out 1 ship with matching top and bottom border widths', () => {
    const layout = computeShipGroupLayout({
      groupNodeX,
      groupNodeY,
      shipCount: 1,
    })

    expect(layout.containerWidth).toBe(groupShipsPaddingLeft + shipNodeWidth)
    expect(layout.containerHeight).toBe(groupShipsPaddingTop + shipNodeHeight + groupShipsPaddingBottom)
    expect(layout.topBorder).toEqual({
      x: groupTopLeft.x,
      y: origin.y - groupTopBorderHeight,
      width: origin.x + layout.containerWidth - groupTopLeft.x,
    })
    expect(layout.bottomBorder).toEqual({
      x: origin.x,
      y: origin.y + layout.containerHeight,
      width: groupShipsPaddingLeft + shipNodeWidth,
    })
    expect(layout.shipPositions).toHaveLength(1)
    expect(layout.shipPositions[0]).toEqual({
      index: 0,
      x: origin.x + groupShipsPaddingLeft,
      y: origin.y + groupShipsPaddingTop,
    })
  })

  it('lays out 3 ships with full-width borders', () => {
    const layout = computeShipGroupLayout({
      groupNodeX,
      groupNodeY,
      shipCount: 3,
    })

    const fullWidth = groupShipsPaddingLeft + 3 * shipNodeWidth + 2 * shipNodeGap

    expect(layout.containerWidth).toBe(fullWidth)
    expect(layout.bottomBorder.width).toBe(fullWidth)
    expect(layout.shipPositions).toHaveLength(3)
  })

  it('uses a 1-ship-wide bottom border for 4 ships', () => {
    const layout = computeShipGroupLayout({
      groupNodeX,
      groupNodeY,
      shipCount: 4,
    })

    expect(layout.containerWidth).toBe(groupShipsPaddingLeft + 3 * shipNodeWidth + 2 * shipNodeGap)
    expect(layout.bottomBorder.width).toBe(groupShipsPaddingLeft + shipNodeWidth)
    expect(layout.shipPositions).toHaveLength(4)
    expect(layout.shipPositions[3]).toEqual({
      index: 3,
      x: origin.x + groupShipsPaddingLeft,
      y: origin.y + groupShipsPaddingTop + shipNodeHeight + shipNodeGap,
    })
  })

  it('uses a 2-ship-wide bottom border for 5 ships', () => {
    const layout = computeShipGroupLayout({
      groupNodeX,
      groupNodeY,
      shipCount: 5,
    })

    expect(layout.bottomBorder.width).toBe(groupShipsPaddingLeft + 2 * shipNodeWidth + shipNodeGap)
  })

  it('positions the label above the top border with gap', () => {
    const layout = computeShipGroupLayout({
      groupNodeX,
      groupNodeY,
      shipCount: 1,
    })

    expect(layout.label).toEqual({
      x: origin.x,
      y: layout.topBorder.y - groupLabelGap,
    })
  })

  it('scales layout with a custom shipNodeSize', () => {
    const shipNodeSize = 112
    const layout = computeShipGroupLayout({
      groupNodeX,
      groupNodeY,
      shipCount: 2,
      shipNodeSize,
    })

    expect(layout.containerWidth).toBe(groupShipsPaddingLeft + 2 * shipNodeSize + shipNodeGap)
    expect(layout.shipPositions[1]?.x).toBe(origin.x + groupShipsPaddingLeft + shipNodeSize + shipNodeGap)
  })
})

describe('resolveShipNodeSize', () => {
  it.each([
    [0, 80],
    [1, 96],
    [2, 112],
    [3, 128],
    [4, 144],
  ])('maps size class %i to %i px', (sizeClass, expected) => {
    expect(resolveShipNodeSize(sizeClass)).toBe(expected)
  })
})

describe('resolveGroupShipLayout', () => {
  it('uses the highest size class in the group', () => {
    const shipSizeByTypeId = { 582: 1, 620: 2 }

    expect(resolveGroupShipLayout([582, 620], shipSizeByTypeId)).toEqual({
      shipCount: 2,
      shipNodeSize: 112,
    })
  })
})

describe('computeGroupVisualBounds', () => {
  it('returns group box bounds when a group has no ships', () => {
    const layout = computeShipGroupLayout({
      groupNodeX,
      groupNodeY,
      shipCount: 0,
    })

    expect(computeGroupVisualBounds(layout, 0, groupNodeX, groupNodeY)).toEqual({
      minX: groupNodeX - groupBoxWidth / 2,
      minY: groupNodeY - groupBoxHeight / 2,
      maxX: groupNodeX + groupBoxWidth / 2,
      maxY: groupNodeY + groupBoxHeight / 2,
    })
  })
})
