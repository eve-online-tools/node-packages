import { forwardRef, useEffect, type ComponentPropsWithoutRef, type CSSProperties, type PropsWithChildren } from 'react'

import { SkillsProvider, type SkillsInput } from '../skills-provider'
import { useDataStatus, DataProvider, type DataProviderProps } from '../data-provider'
import { LOAD_DATA_GENERIC_ERROR } from '../data-provider/types'
import { Alert, LoadingOverlay } from './feedback'
import { PanZoomViewport, resolvePanZoomOptions, type PanZoomOptions } from './pan-zoom'
import { resolveShipTreeTheme } from './resolve-theme'
import classes from './ship-tree.module.css'
import { createGetStyles, cx, type StylesApiProps } from './styles-api'
import { ThemeProvider } from './theme-provider'
import { Identifier } from '../data/identifiers/shipTreeFactions'
import { TreeDisplay } from './tree-display'
import { preloadShipTreeSprites } from './sprites'

export const shipTreeDefaultBackgroundColor = '#070d13'

export type ShipTreeStylesNames = 'root' | 'inner' | 'contentShell'

export interface ShipTreeProps
  extends StylesApiProps<ShipTreeStylesNames>, Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'style'> {
  faction?: Identifier
  backgroundColor?: string
  goldenCapsule?: boolean
  isOmega?: boolean
  strictMode?: boolean
  panZoom?: boolean | PanZoomOptions
}

const ShipTreeBase = forwardRef<HTMLDivElement, ShipTreeProps>(
  (
    {
      classNames,
      className,
      style,
      styles,
      children,
      faction = 500001,
      backgroundColor = shipTreeDefaultBackgroundColor,
      goldenCapsule = false,
      isOmega = false,
      strictMode = false,
      panZoom = true,
      ...others
    },
    ref,
  ) => {
    const getStyles = createGetStyles<ShipTreeStylesNames>(classes, { className, style, classNames, styles }, {
      '--ship-tree-background-color': backgroundColor,
    } as CSSProperties)

    useEffect(() => {
      void preloadShipTreeSprites()
    }, [])

    const { status, error } = useDataStatus()
    const panZoomOptions = resolvePanZoomOptions(panZoom)
    const innerStyles = getStyles('inner')

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
        className={innerStyles.className}
        style={innerStyles.style}
        options={panZoomOptions}
      >
        {pannableContent}
      </PanZoomViewport>
    ) : (
      <div
        className={cx(innerStyles.className, classes.innerNoPanZoom)}
        style={innerStyles.style}
      >
        {pannableContent}
      </div>
    )

    return (
      <ThemeProvider theme={resolveShipTreeTheme(faction, { goldenCapsule, isOmega, strictMode })}>
        <div
          ref={ref}
          {...getStyles('root')}
          data-faction={faction}
          {...others}
        >
          {error ? (
            <div className={classes.errorOverlay}>
              <Alert
                title="Error"
                color="red"
                classNames={{
                  root: classes.alertRoot,
                  message: classes.alertMessage,
                }}
              >
                {LOAD_DATA_GENERIC_ERROR}
              </Alert>
            </div>
          ) : null}
          {status === 'loading' ? <LoadingOverlay /> : null}
          {status === 'ready' ? readyContent : null}
        </div>
      </ThemeProvider>
    )
  },
)

ShipTreeBase.displayName = '@eve-online-tools/eve-ship-tree/ShipTree'

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
      <ShipTreeBase
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
      </ShipTreeBase>
    </DataProvider>
  </SkillsProvider>
)

ShipTreeRoot.displayName = '@eve-online-tools/eve-ship-tree/ShipTreeRoot'

export const ShipTree = Object.assign(ShipTreeBase, { Root: ShipTreeRoot, Tree: TreeDisplay })

export namespace ShipTree {
  export type Props = ShipTreeProps
  export type StylesNames = ShipTreeStylesNames
}
