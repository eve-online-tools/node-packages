import { logo } from '../../../data/icons/factionslogo'
import type { Identifier as ShipTreeFactionId } from '../../../data/identifiers/shipTreeFactions'
import { groupBoxHeight, groupBoxWidth } from '../layout-constants'

export type FactionNodeProps = {
  faction: ShipTreeFactionId
  x: number
  y: number
}

export const FactionNode = ({ faction, x, y }: FactionNodeProps) => {
  const icon = logo[faction as keyof typeof logo]

  if (!icon) {
    return null
  }

  return (
    <image
      href={icon}
      x={x - groupBoxWidth / 2}
      y={y - groupBoxHeight / 2}
      width={groupBoxWidth}
      height={groupBoxHeight}
    />
  )
}
