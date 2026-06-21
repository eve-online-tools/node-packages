import type { CSSProperties } from 'react'

import { iconLarge } from '../../../data/icons/shipTreeGroups'
import type { Identifier } from '../../../data/identifiers/shipTreeGroups'
import type { Identifier as ShipTreeFactionId } from '../../../data/identifiers/shipTreeFactions'
import { useProcessedData } from '../../../data-provider'
import { useShipTreeTheme } from '../../theme-provider'
import groupIconFrame from 'res:/ui/texture/classes/shiptree/groups/groupiconframe.png'
import { groupBoxHeight, groupBoxWidth, groupIconLargeSize, skillBarGap, skillBarHeight } from '../layout-constants'
import { resolveVisibleDisplaySkills } from './resolve-visible-display-skills'
import { SkillBar } from './skill-bar'
import { getShipGroupBackgroundTint, getShipGroupIconTint } from './sprites'
import { ColorMaskedSprite } from '../../svg'

export type GroupNodeProps = {
  faction?: ShipTreeFactionId
  groupId: Identifier
  x: number
  y: number
  backgroundClassName?: string
  backgroundStyle?: CSSProperties
  frameClassName?: string
  frameStyle?: CSSProperties
  iconClassName?: string
  iconStyle?: CSSProperties
}

export const GroupNode = ({
  faction,
  groupId,
  x,
  y,
  backgroundClassName,
  backgroundStyle,
  frameClassName,
  frameStyle,
  iconClassName,
  iconStyle,
}: GroupNodeProps) => {
  const { strictMode = false } = useShipTreeTheme()
  const { shipTreeGroups } = useProcessedData()

  const factionInfo =
    faction === undefined ? undefined : shipTreeGroups[groupId]?.factions[faction as ShipTreeFactionId]
  const status = factionInfo?.status ?? 'locked'

  const displaySkills = resolveVisibleDisplaySkills(factionInfo, strictMode)
  const currentSkills = factionInfo?.currentSkills ?? {}

  const icon = iconLarge[groupId as keyof typeof iconLarge]
  const [backgroundTint, backgroundTintOpacity] = getShipGroupBackgroundTint(status)
  const [iconTint, iconTintOpacity] = getShipGroupIconTint(status)

  const frameX = x - groupBoxWidth / 2
  const frameY = y - groupBoxHeight / 2
  const iconX = x - groupIconLargeSize / 2
  const iconY = y - groupIconLargeSize / 2
  const groupLeftX = x - groupBoxWidth / 2
  const groupBottomY = y + groupBoxHeight / 2

  return (
    <>
      <rect
        className={backgroundClassName}
        style={backgroundStyle}
        fill={backgroundTint}
        opacity={backgroundTintOpacity}
        x={frameX}
        y={frameY}
        width={groupBoxWidth}
        height={groupBoxHeight}
      />
      <image
        className={frameClassName}
        style={frameStyle}
        href={groupIconFrame}
        x={frameX}
        y={frameY}
        width={groupBoxWidth}
        height={groupBoxHeight}
      />
      {icon ? (
        <ColorMaskedSprite
          className={iconClassName}
          style={iconStyle}
          sprite={icon}
          color={iconTint}
          opacity={iconTintOpacity}
          x={iconX}
          y={iconY}
          width={groupIconLargeSize}
          height={groupIconLargeSize}
        />
      ) : null}
      {Object.entries(displaySkills).map(([skillId, requiredLevel], index) => (
        <SkillBar
          key={skillId}
          x={groupLeftX + 1}
          y={groupBottomY + skillBarGap + index * (skillBarHeight + skillBarGap)}
          width={groupBoxWidth - 2}
          height={skillBarHeight}
          level={currentSkills[Number(skillId)] ?? 0}
          requiredLevel={requiredLevel}
        />
      ))}
    </>
  )
}
