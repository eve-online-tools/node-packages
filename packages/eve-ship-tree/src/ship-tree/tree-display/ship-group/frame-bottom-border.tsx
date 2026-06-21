import type { CSSProperties } from 'react'

import { HorizontalSpriteStrip } from '../../svg'
import { groupBorderSpriteCap, groupBorderSpriteWidth, groupBottomBorderHeight } from '../layout-constants'
import groupFrameLower from 'res:/ui/texture/classes/shiptree/groups/framelower.png'

export type FrameBottomBorderProps = {
  x: number
  y: number
  width: number
  className?: string
  style?: CSSProperties
}

export const FrameBottomBorder = ({ x, y, width, className, style }: FrameBottomBorderProps) => (
  <HorizontalSpriteStrip
    className={className}
    style={style}
    x={x}
    y={y}
    width={width}
    height={groupBottomBorderHeight}
    sprite={groupFrameLower}
    spriteWidth={groupBorderSpriteWidth}
    capLeftWidth={groupBorderSpriteCap}
    capRightWidth={groupBorderSpriteCap}
  />
)
