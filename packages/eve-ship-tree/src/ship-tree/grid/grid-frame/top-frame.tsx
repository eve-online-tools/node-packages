import {
  Box,
  BoxProps,
  createVarsResolver,
  ElementProps,
  factory,
  Factory,
  StylesApiProps,
  useProps,
  useStyles,
} from '@mantine/core'
import topFrameLeft from 'res:/ui/texture/classes/shiptree/frame/topleft.png'
import topFrameLine from 'res:/ui/texture/classes/shiptree/frame/topright.png'

import { HorizontalSpriteStrip } from './horizontal-sprite-strip'
import classes from './top-frame.module.css'

export type TopFrameStylesNames = 'root' | 'left' | 'middle' | 'label' | 'line'
export type TopFrameVariant = 'filled' | 'outline'
export type TopFrameCssVariables = Record<string, never>

export interface TopFrameProps extends BoxProps, StylesApiProps<TopFrameFactory>, ElementProps<'div'> {
  label?: string
}

export type TopFrameFactory = Factory<{
  props: TopFrameProps
  ref: HTMLDivElement
  stylesNames: TopFrameStylesNames
  vars: TopFrameCssVariables
  variant: TopFrameVariant
}>

const defaultProps = {
  label: 'Ship Tree',
} satisfies Partial<TopFrameProps>

const varsResolver = createVarsResolver<TopFrameFactory>((_theme, _props) => ({}))

export const TopFrame = factory<TopFrameFactory>((_props) => {
  const props = useProps('TopFrame', defaultProps, _props)
  const { classNames, className, style, styles, unstyled, vars, attributes, label, ref, ...others } = props

  const getStyles = useStyles<TopFrameFactory>({
    name: 'TopFrame',
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

  return (
    <Box
      ref={ref}
      {...getStyles('root')}
      {...others}
    >
      <img
        {...getStyles('left')}
        src={topFrameLeft}
        alt=""
      />
      <div {...getStyles('middle')}>
        <span {...getStyles('label')}>{label}</span>
      </div>
      <HorizontalSpriteStrip
        {...getStyles('line')}
        sprite={topFrameLine}
        spriteWidth={49}
        capLeftWidth={40}
        capRightWidth={4}
        height={26}
      />
    </Box>
  )
})

TopFrame.displayName = '@eve-online-tools/eve-ship-tree/TopFrame'
TopFrame.classes = classes

export namespace TopFrame {
  export type Props = TopFrameProps
  export type StylesNames = TopFrameStylesNames
  export type CssVariables = TopFrameCssVariables
  export type Factory = TopFrameFactory
  export type Variant = TopFrameVariant
}
