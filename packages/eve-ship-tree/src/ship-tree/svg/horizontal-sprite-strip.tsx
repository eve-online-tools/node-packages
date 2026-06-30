import { useId, type CSSProperties } from 'react'

export type HorizontalSpriteStripProps = {
  x: number
  y: number
  width: number
  height: number
  sprite: string
  spriteWidth: number
  capLeftWidth: number
  capRightWidth: number
  className?: string
  style?: CSSProperties
}

export const HorizontalSpriteStrip = ({
  x,
  y,
  width,
  height,
  sprite,
  spriteWidth,
  capLeftWidth,
  capRightWidth,
  className,
  style,
}: HorizontalSpriteStripProps) => {
  const clipId = useId().replace(/:/g, '')
  const middleWidth = Math.max(0, width - capLeftWidth - capRightWidth)
  const middleSpriteWidth = Math.max(1, spriteWidth - capLeftWidth - capRightWidth)
  const scaledSpriteWidth = spriteWidth * (middleWidth / middleSpriteWidth)
  const middleImageX = capLeftWidth - (capLeftWidth * middleWidth) / middleSpriteWidth

  return (
    <g
      className={className}
      style={style}
      transform={`translate(${x}, ${y})`}
    >
      <defs>
        <clipPath id={`${clipId}-left`}>
          <rect
            x={0}
            y={0}
            width={capLeftWidth}
            height={height}
          />
        </clipPath>
        <clipPath id={`${clipId}-middle`}>
          <rect
            x={capLeftWidth}
            y={0}
            width={middleWidth}
            height={height}
          />
        </clipPath>
        <clipPath id={`${clipId}-right`}>
          <rect
            x={width - capRightWidth}
            y={0}
            width={capRightWidth}
            height={height}
          />
        </clipPath>
      </defs>
      <image
        href={sprite}
        x={0}
        y={0}
        width={spriteWidth}
        height={height}
        clipPath={`url(#${clipId}-left)`}
        preserveAspectRatio="none"
      />
      {middleWidth > 0 ? (
        <image
          href={sprite}
          x={middleImageX}
          y={0}
          width={scaledSpriteWidth}
          height={height}
          clipPath={`url(#${clipId}-middle)`}
          preserveAspectRatio="none"
        />
      ) : null}
      <image
        href={sprite}
        x={width - spriteWidth}
        y={0}
        width={spriteWidth}
        height={height}
        clipPath={`url(#${clipId}-right)`}
        preserveAspectRatio="none"
      />
    </g>
  )
}
