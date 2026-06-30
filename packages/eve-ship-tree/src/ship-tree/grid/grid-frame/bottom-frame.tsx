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
import bottomFrameLeft from 'res:/ui/texture/classes/shiptree/frame/bottomleft.png'
import bottomFrameLine from 'res:/ui/texture/classes/shiptree/frame/bottomline.png'
import bottomFrameSeparator from 'res:/ui/texture/classes/shiptree/frame/bottomseperator.png'

import { HorizontalSpriteStrip } from './horizontal-sprite-strip'
import classes from './bottom-frame.module.css'

export type BottomFrameLabel = readonly [string, string]

export type BottomFrameStylesNames =
  | 'root'
  | 'leftSection'
  | 'left'
  | 'versionLabel'
  | 'label'
  | 'labelLine'
  | 'separator'
  | 'line'
  | 'disclaimer'
export type BottomFrameVariant = 'filled' | 'outline'
export type BottomFrameCssVariables = Record<string, never>

export interface BottomFrameProps extends BoxProps, StylesApiProps<BottomFrameFactory>, ElementProps<'div'> {
  versionLabel?: string
  label?: BottomFrameLabel | null
  disclaimer?: string | null
}

export type BottomFrameFactory = Factory<{
  props: BottomFrameProps
  ref: HTMLDivElement
  stylesNames: BottomFrameStylesNames
  vars: BottomFrameCssVariables
  variant: BottomFrameVariant
}>

const defaultProps = {
  versionLabel: 'V1.569.496',
  label: ['Showing', 'Military and industrial vessels'],
  disclaimer: 'Courtesy of Kaalakiota Corporation',
} satisfies Partial<BottomFrameProps>

const varsResolver = createVarsResolver<BottomFrameFactory>((_theme, _props) => ({}))

export const BottomFrame = factory<BottomFrameFactory>((_props) => {
  const props = useProps('BottomFrame', defaultProps, _props)
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    attributes,
    versionLabel,
    label,
    disclaimer,
    ref,
    ...others
  } = props

  const getStyles = useStyles<BottomFrameFactory>({
    name: 'BottomFrame',
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
      <div {...getStyles('leftSection')}>
        <img
          {...getStyles('left')}
          src={bottomFrameLeft}
          alt=""
        />
        {versionLabel ? <span {...getStyles('versionLabel')}>{versionLabel}</span> : null}
      </div>
      {label ? (
        <>
          <div {...getStyles('label')}>
            <span {...getStyles('labelLine')}>{label[0]}</span>
            <span {...getStyles('labelLine')}>{label[1]}</span>
          </div>
          <img
            {...getStyles('separator')}
            src={bottomFrameSeparator}
            alt=""
            aria-hidden
          />
        </>
      ) : null}
      <HorizontalSpriteStrip
        {...getStyles('line')}
        sprite={bottomFrameLine}
        spriteWidth={40}
        capLeftWidth={2}
        capRightWidth={2}
        height={2}
      />
      {disclaimer ? (
        <>
          <img
            {...getStyles('separator')}
            src={bottomFrameSeparator}
            alt=""
            aria-hidden
          />
          <span {...getStyles('disclaimer')}>{disclaimer}</span>
          <img
            {...getStyles('separator')}
            src={bottomFrameSeparator}
            alt=""
            aria-hidden
          />
        </>
      ) : null}
    </Box>
  )
})

BottomFrame.displayName = '@eve-online-tools/eve-ship-tree/BottomFrame'
BottomFrame.classes = classes

export namespace BottomFrame {
  export type Props = BottomFrameProps
  export type StylesNames = BottomFrameStylesNames
  export type CssVariables = BottomFrameCssVariables
  export type Factory = BottomFrameFactory
  export type Variant = BottomFrameVariant
}
