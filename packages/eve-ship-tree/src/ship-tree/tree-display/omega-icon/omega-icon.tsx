import { useShipTreeTheme } from '../../theme-provider'
import classes from './omega-icon.module.css'
import { createGetStyles, type StylesApiProps } from '../../styles-api'
import omegaIconSprite from 'res:/ui/texture/classes/clonegrade/omega_64.png'

export type OmegaIconStylesNames = 'root' | 'icon'

export interface OmegaIconProps extends StylesApiProps<OmegaIconStylesNames> {
  x: number
  y: number
}

export const OmegaIcon = ({ x, y, className, style, classNames, styles }: OmegaIconProps) => {
  const getStyles = createGetStyles<OmegaIconStylesNames>(classes, { className, style, classNames, styles })

  const { isOmega = false } = useShipTreeTheme()
  const size = isOmega ? 32 : 64
  const opacity = isOmega ? 0.5 : 1
  const halfSize = size / 2
  const iconStyles = getStyles('icon')

  return (
    <g
      {...getStyles('root')}
      transform={`translate(${x}, ${y})`}
    >
      <image
        className={iconStyles.className}
        style={iconStyles.style}
        href={omegaIconSprite}
        x={-halfSize}
        y={-halfSize}
        width={size}
        height={size}
        opacity={opacity}
      />
    </g>
  )
}

OmegaIcon.displayName = '@eve-online-tools/eve-ship-tree/OmegaIcon'
