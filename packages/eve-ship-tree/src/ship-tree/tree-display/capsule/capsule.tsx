import { createVarsResolver, factory, Factory, StylesApiProps, useProps, useStyles } from '@mantine/core'
import type { CSSProperties } from 'react'

import { holoIcon } from '../../../data/icons/types'
import { useShipTreeTheme } from '../../theme-provider'
import { ColorMaskedSprite } from '../../svg'
import { groupIconLargeSize } from '../layout-constants'
import classes from './capsule.module.css'

const capsuleTypeId = 670
const goldenCapsuleColor = '#FCD17E'

export type CapsuleStylesNames = 'root' | 'icon'
export type CapsuleCssVariables = Record<string, never>

export interface CapsuleProps extends StylesApiProps<CapsuleFactory> {
  x: number
  y: number
  size?: number
  className?: string
  style?: CSSProperties
}

export type CapsuleFactory = Factory<{
  props: CapsuleProps
  ref: SVGGElement
  stylesNames: CapsuleStylesNames
  vars: CapsuleCssVariables
}>

const defaultProps = {
  size: groupIconLargeSize,
} satisfies Partial<CapsuleProps>

const varsResolver = createVarsResolver<CapsuleFactory>((_theme, _props) => ({}))

export const Capsule = factory<CapsuleFactory>((_props) => {
  const props = useProps('Capsule', defaultProps, _props)
  const { x, y, size, className, style, classNames, styles, unstyled, vars, attributes, ref, ...others } = props

  const getStyles = useStyles<CapsuleFactory>({
    name: 'Capsule',
    classes,
    props,
    className,
    style,
    classNames,
    styles,
    unstyled,
    attributes,
    vars,
    varsResolver,
  })

  const { goldenCapsule = false } = useShipTreeTheme()
  const iconStyles = getStyles('icon')
  const halfSize = size / 2

  return (
    <g
      ref={ref}
      {...getStyles('root')}
      data-golden-capsule={goldenCapsule || undefined}
      transform={`translate(${x}, ${y})`}
      {...others}
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
})

Capsule.displayName = '@eve-online-tools/eve-ship-tree/Capsule'
Capsule.classes = classes

export namespace Capsule {
  export type Props = CapsuleProps
  export type StylesNames = CapsuleStylesNames
  export type CssVariables = CapsuleCssVariables
  export type Factory = CapsuleFactory
}
