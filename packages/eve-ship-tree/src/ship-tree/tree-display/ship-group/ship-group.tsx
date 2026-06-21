import { useMemo } from 'react'

import { type Identifier as GroupIdentifier, names as groupNames } from '../../../data/identifiers/shipTreeGroups'
import type { Identifier as ShipTreeFactionId } from '../../../data/identifiers/shipTreeFactions'
import { useProcessedData } from '../../../data-provider'
import { Ship } from './ship'
import { computeShipGroupLayout, resolveGroupShipLayout } from './compute-ship-group-layout'
import { FrameBottomBorder } from './frame-bottom-border'
import { FrameLabel } from './frame-label'
import { FrameTopBorder } from './frame-top-border'

export type ShipGroupProps = {
  faction: ShipTreeFactionId
  groupId: GroupIdentifier
  groupNodeX: number
  groupNodeY: number
}

export const ShipGroup = ({ faction, groupId, groupNodeX, groupNodeY }: ShipGroupProps) => {
  const { shipTreeGroups, shipSizeByTypeId } = useProcessedData()

  const shipTypes = useMemo(
    () => shipTreeGroups[groupId]?.factions[faction]?.shipTypes ?? [],
    [shipTreeGroups, groupId, faction],
  )

  const { shipCount, shipNodeSize } = useMemo(
    () => resolveGroupShipLayout(shipTypes, shipSizeByTypeId),
    [shipTypes, shipSizeByTypeId],
  )

  const layout = useMemo(
    () =>
      computeShipGroupLayout({
        groupNodeX,
        groupNodeY,
        shipCount,
        shipNodeSize,
      }),
    [groupNodeX, groupNodeY, shipCount, shipNodeSize],
  )

  const label = groupNames[groupId as keyof typeof groupNames]

  return (
    <g>
      <FrameTopBorder
        x={layout.topBorder.x}
        y={layout.topBorder.y}
        width={layout.topBorder.width}
      />
      <FrameBottomBorder
        x={layout.bottomBorder.x}
        y={layout.bottomBorder.y}
        width={layout.bottomBorder.width}
      />
      {shipTypes.map((typeId, index) => {
        const position = layout.shipPositions[index]
        if (position === undefined) {
          return null
        }

        return (
          <Ship
            key={typeId}
            typeId={typeId}
            x={position.x}
            y={position.y}
            width={shipNodeSize}
            height={shipNodeSize}
          />
        )
      })}
      {label ? (
        <FrameLabel
          x={layout.label.x}
          y={layout.label.y}
          label={label}
        />
      ) : null}
    </g>
  )
}
