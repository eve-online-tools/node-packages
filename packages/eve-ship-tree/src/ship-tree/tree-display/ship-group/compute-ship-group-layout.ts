import {
  groupBottomBorderHeight,
  groupBoxHeight,
  groupBoxWidth,
  groupLabelGap,
  groupShipsPaddingBottom,
  groupShipsPaddingLeft,
  groupShipsPaddingRight,
  groupShipsPaddingTop,
  groupTopBorderHeight,
  resolveShipNodeSize,
  shipLabelOverflow,
  shipNodeGap,
  shipNodeWidth,
  shipsPerRow,
} from '../layout-constants'

export type LayoutPoint = {
  x: number
  y: number
}

export type LayoutRect = LayoutPoint & {
  width: number
  height?: number
}

export type ShipPosition = LayoutPoint & {
  index: number
}

export type ShipGroupLayout = {
  origin: LayoutPoint
  contentOrigin: LayoutPoint
  containerWidth: number
  containerHeight: number
  topBorder: LayoutRect
  bottomBorder: LayoutRect
  label: LayoutPoint
  shipPositions: ShipPosition[]
}

export type PixelBounds = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export type ComputeShipGroupLayoutInput = {
  groupNodeX: number
  groupNodeY: number
  shipCount: number
  shipNodeSize?: number
}

const gridAxisSpan = (count: number, cellSize: number, gap: number): number =>
  count <= 0 ? 0 : count * cellSize + (count - 1) * gap

const computeGridDimensions = (shipCount: number) => {
  if (shipCount === 0) {
    return { columnCount: 0, rowCount: 0, lastRowColumnCount: 0 }
  }

  const columnCount = Math.min(shipCount, shipsPerRow)
  const rowCount = Math.ceil(shipCount / shipsPerRow)
  const lastRowColumnCount = shipCount % shipsPerRow || shipsPerRow

  return { columnCount, rowCount, lastRowColumnCount }
}

export const resolveGroupShipLayout = (
  shipTypes: number[],
  shipSizeByTypeId: Record<number, number>,
): { shipCount: number; shipNodeSize: number } => {
  const shipCount = shipTypes.length
  const sizeClass = shipTypes.reduce((max, id) => Math.max(max, shipSizeByTypeId[id] ?? 0), 0)

  return { shipCount, shipNodeSize: resolveShipNodeSize(sizeClass) }
}

export const computeShipGroupLayout = ({
  groupNodeX,
  groupNodeY,
  shipCount,
  shipNodeSize = shipNodeWidth,
}: ComputeShipGroupLayoutInput): ShipGroupLayout => {
  const { columnCount, rowCount, lastRowColumnCount } = computeGridDimensions(shipCount)

  const groupTopLeft = {
    x: groupNodeX - groupBoxWidth / 2,
    y: groupNodeY - groupBoxHeight / 2,
  }

  const origin = {
    x: groupNodeX + groupBoxWidth / 2,
    y: groupTopLeft.y,
  }

  const contentOrigin = {
    x: origin.x + groupShipsPaddingLeft,
    y: origin.y + groupShipsPaddingTop,
  }

  const containerWidth =
    groupShipsPaddingLeft + gridAxisSpan(columnCount, shipNodeSize, shipNodeGap) + groupShipsPaddingRight
  const containerHeight =
    groupShipsPaddingTop + gridAxisSpan(rowCount, shipNodeSize, shipNodeGap) + groupShipsPaddingBottom

  const topBorderY = origin.y - groupTopBorderHeight

  const topBorder = {
    x: groupTopLeft.x,
    y: topBorderY,
    width: origin.x + containerWidth - groupTopLeft.x,
  }

  const bottomBorder = {
    x: origin.x,
    y: origin.y + containerHeight,
    width: groupShipsPaddingLeft + gridAxisSpan(lastRowColumnCount, shipNodeSize, shipNodeGap),
  }

  const label = {
    x: origin.x,
    y: topBorderY - groupLabelGap,
  }

  const shipPositions = Array.from({ length: shipCount }, (_, index) => {
    const column = index % shipsPerRow
    const row = Math.floor(index / shipsPerRow)

    return {
      index,
      x: contentOrigin.x + column * (shipNodeSize + shipNodeGap),
      y: contentOrigin.y + row * (shipNodeSize + shipNodeGap),
    }
  })

  return {
    origin,
    contentOrigin,
    containerWidth,
    containerHeight,
    topBorder,
    bottomBorder,
    label,
    shipPositions,
  }
}

export const computeGroupVisualBounds = (
  layout: ShipGroupLayout,
  shipCount: number,
  groupNodeX: number,
  groupNodeY: number,
): PixelBounds => {
  if (shipCount === 0) {
    return {
      minX: groupNodeX - groupBoxWidth / 2,
      minY: groupNodeY - groupBoxHeight / 2,
      maxX: groupNodeX + groupBoxWidth / 2,
      maxY: groupNodeY + groupBoxHeight / 2,
    }
  }

  return {
    minX: layout.topBorder.x,
    minY: layout.label.y - shipLabelOverflow,
    maxX: layout.origin.x + layout.containerWidth,
    maxY: layout.bottomBorder.y + groupBottomBorderHeight,
  }
}

/** Pixel distance from a group node center to the right edge of its ship icons. */
export const computeShipIconsExtentFromGroupCenter = (shipCount: number, shipNodeSize = shipNodeWidth): number => {
  const { origin, containerWidth } = computeShipGroupLayout({
    groupNodeX: 0,
    groupNodeY: 0,
    shipCount,
    shipNodeSize,
  })

  return origin.x + containerWidth
}
