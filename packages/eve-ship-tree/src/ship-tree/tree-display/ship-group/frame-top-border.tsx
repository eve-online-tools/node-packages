import type { CSSProperties } from 'react'

import { HorizontalSpriteStrip } from '../../svg'
import { groupBorderSpriteCap, groupBorderSpriteWidth, groupTopBorderHeight } from '../layout-constants'
import groupFrameUpper from 'res:/ui/texture/classes/shiptree/groups/frameupper.png'

export type FrameTopBorderProps = {
  x: number
  y: number
  width: number
  className?: string
  style?: CSSProperties
}

export const FrameTopBorder = ({ x, y, width, className, style }: FrameTopBorderProps) => (
  <HorizontalSpriteStrip
    className={className}
    style={style}
    x={x}
    y={y}
    width={width}
    height={groupTopBorderHeight}
    sprite={groupFrameUpper}
    spriteWidth={groupBorderSpriteWidth}
    capLeftWidth={groupBorderSpriteCap}
    capRightWidth={groupBorderSpriteCap}
  />
)
