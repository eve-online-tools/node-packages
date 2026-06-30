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

import { BottomFrame, type BottomFrameLabel } from './grid-frame/bottom-frame'
import { TopFrame } from './grid-frame/top-frame'
import classes from './grid.module.css'

export type GridStylesNames = 'root' | 'inner' | 'header' | 'content' | 'footer'
export type GridVariant = undefined
export type GridCssVariables = Record<string, never>

export interface GridProps extends BoxProps, StylesApiProps<GridFactory>, ElementProps<'div'> {
  topLabel?: string
  versionLabel?: string
  bottomLabel?: BottomFrameLabel | null
  disclaimer?: string | null
}

export type GridFactory = Factory<{
  props: GridProps
  ref: HTMLDivElement
  stylesNames: GridStylesNames
  vars: GridCssVariables
  variant: GridVariant
  staticComponents: {
    TopFrame: typeof TopFrame
    BottomFrame: typeof BottomFrame
  }
}>

const varsResolver = createVarsResolver<GridFactory>((_theme, _props) => ({}))

export const Grid = factory<GridFactory>((_props) => {
  const props = useProps('Grid', null, _props)
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    attributes,
    children,
    topLabel,
    versionLabel,
    bottomLabel,
    disclaimer,
    ref,
    ...others
  } = props

  const getStyles = useStyles<GridFactory>({
    name: 'Grid',
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
      <div {...getStyles('inner')}>
        <div {...getStyles('header')}>
          <TopFrame label={topLabel} />
        </div>
        <Box
          {...getStyles('content')}
          data-testid="grid-content"
        >
          {children}
        </Box>
        <div {...getStyles('footer')}>
          <BottomFrame
            versionLabel={versionLabel}
            label={bottomLabel}
            disclaimer={disclaimer}
          />
        </div>
      </div>
    </Box>
  )
})

Grid.displayName = '@eve-online-tools/eve-ship-tree/Grid'
Grid.classes = classes
Grid.TopFrame = TopFrame
Grid.BottomFrame = BottomFrame

export namespace Grid {
  export type Props = GridProps
  export type StylesNames = GridStylesNames
  export type CssVariables = GridCssVariables
  export type Factory = GridFactory
  export type Variant = GridVariant
}
