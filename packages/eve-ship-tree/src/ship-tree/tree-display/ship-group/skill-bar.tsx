import type { CSSProperties } from 'react'
import { SkillLevel } from '../../../skills-provider/context'
import { getShipGroupSkillBarFrameTint, getShipGroupSkillBarTint } from './sprites'

export type SkillBarLevel = SkillLevel

const blockCount = 5
const blockMargin = 2
const blockWidthFraction = 0.2

export type SkillBarProps = {
  x: number
  y: number
  width: number
  height: number
  level: SkillLevel
  requiredLevel?: SkillLevel
  className?: string
  style?: CSSProperties
}

const clampLevel = (level: number): number => Math.max(0, Math.min(blockCount, Math.floor(level)))

export const SkillBar = ({ x, y, width, height, level, requiredLevel, className, style }: SkillBarProps) => {
  const filledLevels = clampLevel(level)
  const requiredLevels = requiredLevel === undefined ? filledLevels : clampLevel(requiredLevel)
  const missingLevels =
    requiredLevel === undefined || filledLevels >= requiredLevels ? 0 : requiredLevels - filledLevels
  const slotWidth = width * blockWidthFraction
  const blockWidth = slotWidth - blockMargin * 2
  const blockHeight = height - blockMargin * 2

  const [lockedTint, lockedTintOpacity] = getShipGroupSkillBarTint('locked')
  const [unlockedTint, unlockedTintOpacity] = getShipGroupSkillBarTint('unlocked')
  const [frameTint, frameTintOpacity] = getShipGroupSkillBarFrameTint('unlocked')

  return (
    <g
      className={className}
      style={style}
    >
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill="#000000"
        stroke={frameTint}
        strokeOpacity={frameTintOpacity}
      />
      {Array.from({ length: filledLevels }, (_, index) => (
        <rect
          key={`filled-${index}`}
          x={x + index * slotWidth + blockMargin}
          y={y + blockMargin}
          width={blockWidth}
          height={blockHeight}
          fill={unlockedTint}
          opacity={unlockedTintOpacity}
        />
      ))}
      {Array.from({ length: missingLevels }, (_, index) => (
        <rect
          key={`required-${index}`}
          x={x + (filledLevels + index) * slotWidth + blockMargin}
          y={y + blockMargin}
          width={blockWidth}
          height={blockHeight}
          fill={lockedTint}
          opacity={lockedTintOpacity}
        />
      ))}
    </g>
  )
}
