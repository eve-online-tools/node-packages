import {
  Alert,
  Box,
  BoxProps,
  createVarsResolver,
  ElementProps,
  factory,
  Factory,
  LoadingOverlay,
  Overlay,
  StylesApiProps,
  useProps,
  useStyles,
} from '@mantine/core'
import { PropsWithChildren } from 'react'

import { SkillsProvider, type SkillsInput } from '../skills-provider'
import { useDataStatus, DataProvider, type DataProviderProps } from '../data-provider'
import { LOAD_DATA_GENERIC_ERROR } from '../data-provider/types'
import { PanZoomViewport, resolvePanZoomOptions, type PanZoomOptions } from './pan-zoom'
import { resolveShipTreeTheme } from './resolve-theme'
import classes from './ship-tree.module.css'
import { ThemeProvider } from './theme-provider'
import { Identifier } from '../data/identifiers/shipTreeFactions'
import { TreeDisplay } from './tree-display'

export const shipTreeDefaultBackgroundColor = '#070d13'

export type ShipTreeStylesNames = 'root' | 'inner' | 'contentShell'
export type ShipTreeVariant = undefined
export type ShipTreeCssVariables = {
  root: '--ship-tree-background-color'
}

export interface ShipTreeProps extends BoxProps, StylesApiProps<ShipTreeFactory>, ElementProps<'div'> {
  faction?: Identifier
  backgroundColor?: string
  goldenCapsule?: boolean
  isOmega?: boolean
  strictMode?: boolean
  panZoom?: boolean | PanZoomOptions
}

export type ShipTreeFactory = Factory<{
  props: ShipTreeProps
  ref: HTMLDivElement
  stylesNames: ShipTreeStylesNames
  vars: ShipTreeCssVariables
  variant: ShipTreeVariant
  staticComponents: {
    Root: typeof ShipTreeRoot
    Tree: typeof TreeDisplay
  }
}>

const defaultProps = {
  faction: 500001,
  backgroundColor: shipTreeDefaultBackgroundColor,
  goldenCapsule: false,
  isOmega: false,
  strictMode: false,
  panZoom: true,
} satisfies Partial<ShipTreeProps>

const varsResolver = createVarsResolver<ShipTreeFactory>((_theme, { backgroundColor }) => ({
  root: {
    '--ship-tree-background-color': backgroundColor ?? shipTreeDefaultBackgroundColor,
  },
}))

export const ShipTree = factory<ShipTreeFactory>((_props) => {
  const props = useProps('ShipTree', defaultProps, _props)
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    attributes,
    children,
    faction = 500001,
    backgroundColor,
    goldenCapsule = false,
    isOmega = false,
    strictMode = false,
    panZoom = true,
    ref,
    ...others
  } = props

  const getStyles = useStyles<ShipTreeFactory>({
    name: 'ShipTree',
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

  const { status, error } = useDataStatus()
  const panZoomOptions = resolvePanZoomOptions(panZoom)

  const pannableContent = (
    <div
      {...getStyles('contentShell')}
      data-faction={faction}
      data-testid="ship-tree-content"
    >
      {children}
    </div>
  )

  const readyContent = panZoomOptions ? (
    <PanZoomViewport
      className={getStyles('inner').className}
      style={getStyles('inner').style}
      options={panZoomOptions}
    >
      {pannableContent}
    </PanZoomViewport>
  ) : (
    <div
      {...getStyles('inner')}
      className={[getStyles('inner').className, classes.innerNoPanZoom].filter(Boolean).join(' ')}
    >
      {pannableContent}
    </div>
  )

  return (
    <ThemeProvider theme={resolveShipTreeTheme(faction, { goldenCapsule, isOmega, strictMode })}>
      <Box
        ref={ref}
        {...getStyles('root')}
        data-faction={faction}
        {...others}
      >
        {error ? (
          <Overlay backgroundOpacity={0}>
            <Alert
              variant="outline"
              title="Error"
              color="red"
              classNames={{
                root: classes.alertRoot,
                message: classes.alertMessage,
              }}
            >
              {LOAD_DATA_GENERIC_ERROR}
            </Alert>
          </Overlay>
        ) : null}
        {status === 'loading' ? (
          <LoadingOverlay
            overlayProps={{ blur: 1, backgroundOpacity: 0 }}
            loaderProps={{ type: 'dots' }}
            visible
          />
        ) : null}
        {status === 'ready' ? readyContent : null}
      </Box>
    </ThemeProvider>
  )
})

ShipTree.Tree = TreeDisplay
ShipTree.displayName = '@eve-online-tools/eve-ship-tree/ShipTree'
ShipTree.classes = classes

export namespace ShipTree {
  export type Props = ShipTreeProps
  export type StylesNames = ShipTreeStylesNames
  export type CssVariables = ShipTreeCssVariables
  export type Factory = ShipTreeFactory
  export type Variant = ShipTreeVariant
}

export type ShipTreeRootProps = PropsWithChildren &
  Pick<
    ShipTreeProps,
    'faction' | 'backgroundColor' | 'goldenCapsule' | 'isOmega' | 'strictMode' | 'panZoom' | 'style' | 'className'
  > & {
    skills: SkillsInput
  } & DataProviderProps

export const ShipTreeRoot = ({
  children,
  skills,
  faction = 500001 as Identifier,
  backgroundColor,
  goldenCapsule,
  isOmega,
  strictMode,
  panZoom,
  style,
  className,
  ...dataProps
}: ShipTreeRootProps) => (
  <SkillsProvider skills={skills}>
    <DataProvider {...dataProps}>
      <ShipTree
        faction={faction}
        backgroundColor={backgroundColor}
        goldenCapsule={goldenCapsule}
        isOmega={isOmega}
        strictMode={strictMode}
        panZoom={panZoom}
        style={style}
        className={className}
      >
        {children}
      </ShipTree>
    </DataProvider>
  </SkillsProvider>
)

ShipTreeRoot.displayName = '@eve-online-tools/eve-ship-tree/ShipTreeRoot'
ShipTree.Root = ShipTreeRoot
