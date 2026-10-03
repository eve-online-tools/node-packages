import { holoIcon } from '../../../data/icons/types'
import { useShipTreeTheme } from '../../theme-provider'
import { ColorMaskedSprite } from '../../svg'
import { groupIconLargeSize } from '../layout-constants'
import classes from './capsule.module.css'
import { createGetStyles, type StylesApiProps } from '../../styles-api'

const capsuleTypeId = 670
const goldenCapsuleColor = '#FCD17E'

export type CapsuleStylesNames = 'root' | 'icon'

export interface CapsuleProps extends StylesApiProps<CapsuleStylesNames> {
  x: number
  y: number
  size?: number
}

export const Capsule = ({ x, y, size = groupIconLargeSize, className, style, classNames, styles }: CapsuleProps) => {
  const getStyles = createGetStyles<CapsuleStylesNames>(classes, { className, style, classNames, styles })

  const { goldenCapsule = false } = useShipTreeTheme()
  const iconStyles = getStyles('icon')
  const halfSize = size / 2

  return (
    <g
      {...getStyles('root')}
      data-golden-capsule={goldenCapsule || undefined}
      transform={`translate(${x}, ${y})`}
    >
      <ColorMaskedSprite
        className={iconStyles.className}
        style={iconStyles.style}
        x={-halfSize}
        y={-halfSize}
        width={size}
        height={size}
        sprite={holoIcon[capsuleTypeId]}
        color={goldenCapsule ? goldenCapsuleColor : '#ffffff'}
      />
    </g>
  )
}

Capsule.displayName = '@eve-online-tools/eve-ship-tree/Capsule'
