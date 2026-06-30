import { createVarsResolver, factory, Factory, StylesApiProps, useProps, useStyles } from '@mantine/core'
import type { CSSProperties } from 'react'

import { useShipTreeTheme } from '../../theme-provider'
import classes from './omega-icon.module.css'
import omegaIconSprite from 'res:/ui/texture/classes/clonegrade/omega_64.png'

export type OmegaIconStylesNames = 'root' | 'icon'
export type OmegaIconCssVariables = Record<string, never>

export interface OmegaIconProps extends StylesApiProps<OmegaIconFactory> {
  x: number
  y: number
  className?: string
  style?: CSSProperties
}

export type OmegaIconFactory = Factory<{
  props: OmegaIconProps
  ref: SVGGElement
  stylesNames: OmegaIconStylesNames
  vars: OmegaIconCssVariables
}>

const varsResolver = createVarsResolver<OmegaIconFactory>((_theme, _props) => ({}))

export const OmegaIcon = factory<OmegaIconFactory>((_props) => {
  const props = useProps('OmegaIcon', null, _props)
  const { x, y, className, style, classNames, styles, unstyled, vars, attributes, ref, ...others } = props

  const getStyles = useStyles<OmegaIconFactory>({
    name: 'OmegaIcon',
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

  const { isOmega = false } = useShipTreeTheme()
  const size = isOmega ? 32 : 64
  const opacity = isOmega ? 0.5 : 1
  const halfSize = size / 2
  const iconStyles = getStyles('icon')

  return (
    <g
      ref={ref}
      {...getStyles('root')}
      transform={`translate(${x}, ${y})`}
      {...others}
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
})

OmegaIcon.displayName = '@eve-online-tools/eve-ship-tree/OmegaIcon'
OmegaIcon.classes = classes

export namespace OmegaIcon {
  export type Props = OmegaIconProps
  export type StylesNames = OmegaIconStylesNames
  export type CssVariables = OmegaIconCssVariables
  export type Factory = OmegaIconFactory
}
