import type { CSSProperties } from 'react'

import classes from './horizontal-sprite-strip.module.css'

export type HorizontalSpriteStripProps = {
  sprite: string
  spriteWidth: number
  capLeftWidth: number
  capRightWidth: number
  height: number
  className?: string
  style?: CSSProperties
  'data-testid'?: string
}

export const HorizontalSpriteStrip = ({
  sprite,
  spriteWidth,
  capLeftWidth,
  capRightWidth,
  height,
  className,
  style,
  'data-testid': dataTestId = 'horizontal-sprite-strip',
}: HorizontalSpriteStripProps) => (
  <div
    className={[classes.root, className].filter(Boolean).join(' ')}
    style={
      {
        ...style,
        '--sprite-strip-image': `url("${sprite}")`,
        '--sprite-strip-width': spriteWidth,
        '--sprite-strip-cap-left-width': capLeftWidth,
        '--sprite-strip-cap-right-width': capRightWidth,
        '--sprite-strip-height': height,
      } as CSSProperties
    }
    aria-hidden
    data-testid={dataTestId}
  >
    <div
      className={classes.capLeft}
      data-testid="sprite-strip-cap-left"
    />
    <div
      className={classes.stretch}
      data-testid="sprite-strip-stretch"
    />
    <div
      className={classes.capRight}
      data-testid="sprite-strip-cap-right"
    />
  </div>
)
