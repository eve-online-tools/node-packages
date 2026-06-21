import { useId, type CSSProperties } from 'react'

export type ColorMaskedSpriteProps = React.SVGProps<SVGRectElement> & {
  x: number
  y: number
  width: number
  height: number
  sprite?: string
  color?: string
  className?: string
  style?: CSSProperties
}

export const ColorMaskedSprite = ({
  x,
  y,
  width,
  height,
  sprite,
  color = 'currentColor',
  className,
  style,
  ...rest
}: ColorMaskedSpriteProps) => {
  const maskId = useId().replace(/:/g, '')

  if (!sprite) {
    return (
      <rect
        {...rest}
        className={className}
        style={style}
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        opacity={0.3}
      />
    )
  }

  return (
    <g
      className={className}
      style={style}
    >
      <defs>
        <mask id={maskId}>
          <image
            href={sprite}
            x={x}
            y={y}
            width={width}
            height={height}
          />
        </mask>
      </defs>
      <rect
        {...rest}
        x={x}
        y={y}
        width={width}
        height={height}
        fill={color}
        mask={`url(#${maskId})`}
      />
    </g>
  )
}
