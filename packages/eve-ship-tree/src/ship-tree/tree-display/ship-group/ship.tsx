import type { CSSProperties } from 'react'

import bgFill from 'res:/ui/texture/classes/shiptree/groups/bgfill.png'
import bgVignette from 'res:/ui/texture/classes/shiptree/groups/bgvignette.png'
import { useProcessedData } from '../../../data-provider'
import { holoIcon } from '../../../data/icons/types'
import { ColorMaskedSprite } from '../../svg'
import { shipNodeHoloScale, shipNodeMasteryHeight, shipNodeTechLevelSize } from '../layout-constants'
import { masteryIcon } from './mastery'
import { getShipFrame, getShipIconTint, getShipStatus, getShipVignetteTint, getTechLevelIcon } from './sprites'

export type ShipProps = {
  typeId: number
  x: number
  y: number
  width: number
  height: number
  className?: string
  style?: CSSProperties
  iconClassName?: string
  iconStyle?: CSSProperties
}

export const Ship = ({ typeId, x, y, width, height, className, style, iconClassName, iconStyle }: ShipProps) => {
  const { shipTypes } = useProcessedData()
  const shipType = shipTypes[typeId]
  const masteryLevel = shipType?.masteryLevel ?? 0
  const status = getShipStatus(shipType?.state, masteryLevel)
  const [frame, frameOpacity] = getShipFrame(status)
  const holoSize = width * shipNodeHoloScale
  const holoX = x + (width - holoSize) / 2
  const holoY = y
  const holoSprite = holoIcon[typeId as keyof typeof holoIcon]
  const [tint, tintOpacity] = getShipIconTint(status)
  const masterySprite = masteryIcon(masteryLevel)
  const techLevelSprite = getTechLevelIcon(shipType?.techLevel)
  const masterySize = shipNodeMasteryHeight
  const techSize = shipNodeTechLevelSize
  const masteryX = x + (width - masterySize) / 2
  const masteryY = y + height - masterySize

  const stateWithMastery = status === 'unlocked' && masteryLevel === 5 ? 'mastered' : status

  const [vignetteTint, vignetteOpacity] = getShipVignetteTint(stateWithMastery)

  return (
    <g
      className={className}
      style={style}
    >
      <ColorMaskedSprite
        sprite={frame}
        color={tint}
        x={x}
        y={y}
        width={width}
        height={height}
        opacity={frameOpacity}
      />
      <ColorMaskedSprite
        sprite={bgFill}
        color={tint}
        x={x}
        y={y}
        width={width}
        height={height}
        opacity={0.1}
      />
      <ColorMaskedSprite
        sprite={bgVignette}
        color={vignetteTint}
        x={x}
        y={y}
        width={width}
        height={height}
        opacity={vignetteOpacity}
      />
      {holoSprite ? (
        <ColorMaskedSprite
          className={iconClassName}
          style={iconStyle}
          x={holoX}
          y={holoY}
          width={holoSize}
          height={holoSize}
          sprite={holoSprite}
          color={tint}
          opacity={tintOpacity}
        />
      ) : null}
      <ColorMaskedSprite
        x={masteryX}
        y={masteryY}
        width={masterySize}
        height={masterySize}
        sprite={masterySprite}
        color={tint}
      />
      {techLevelSprite ? (
        <image
          href={techLevelSprite}
          x={x}
          y={y}
          width={techSize}
          height={techSize}
          opacity={tintOpacity}
        />
      ) : null}
    </g>
  )
}
