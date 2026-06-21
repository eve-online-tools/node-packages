import {
  Alert,
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
import { useMemo } from 'react'

import type { Identifier as ShipTreeFactionId } from '../../data/identifiers/shipTreeFactions'
import { useProcessedData } from '../../data-provider'
import { factionLayouts, getFactionName, hasFactionLayout } from '../../layouts'
import { useShipTreeTheme } from '../theme-provider'
import { Capsule } from './capsule'
import { FactionNode } from './faction-node'
import { LinePath } from './line-path'
import { OmegaIcon } from './omega-icon'
import { collectLayout, computeViewBox, formatViewBox, gridToPixel } from './render-layout'
import { buildSegmentMap } from './segment-map'
import { GroupNode, ShipGroup } from './ship-group'
import classes from './tree-display.module.css'

export type TreeDisplayStylesNames = 'root' | 'surface' | 'lines' | 'line' | 'groups'
export type TreeDisplayVariant = undefined
export type TreeDisplayCssVariables = Record<string, never>

export interface TreeDisplayProps extends BoxProps, StylesApiProps<TreeDisplayFactory>, ElementProps<'div'> {
  /** Defaults to the faction set on an ancestor `ShipTree`. */
  faction?: ShipTreeFactionId
}

export type TreeDisplayFactory = Factory<{
  props: TreeDisplayProps
  ref: HTMLDivElement
  stylesNames: TreeDisplayStylesNames
  vars: TreeDisplayCssVariables
  variant: TreeDisplayVariant
}>

const varsResolver = createVarsResolver<TreeDisplayFactory>((_theme, _props) => ({}))

const supportedFactionNames = (Object.keys(factionLayouts) as unknown as ShipTreeFactionId[])
  .filter(hasFactionLayout)
  .map(getFactionName)
  .join(', ')

export const TreeDisplay = factory<TreeDisplayFactory>((_props) => {
  const props = useProps('TreeDisplay', null, _props)
  const {
    classNames,
    className,
    style,
    styles,
    unstyled,
    vars,
    attributes,
    faction: factionProp,
    ref,
    ...others
  } = props

  const { faction: themeFaction, strictMode = false } = useShipTreeTheme()
  const faction = factionProp ?? themeFaction

  if (faction === undefined) {
    throw new Error('TreeDisplay requires a faction prop or a ShipTree ancestor with faction set')
  }

  const getStyles = useStyles<TreeDisplayFactory>({
    name: 'TreeDisplay',
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
  const layout = factionLayouts[faction]
  const layoutSupported = hasFactionLayout(faction)

  const { segments, nodes } = useMemo(
    () => (layoutSupported ? collectLayout(layout) : { segments: [], nodes: [] }),
    [layout, layoutSupported],
  )
  const { shipTreeGroups, shipSizeByTypeId } = useProcessedData()

  const { linePaths, omegaTransitions } = useMemo(
    () =>
      layoutSupported
        ? buildSegmentMap(segments, nodes, shipTreeGroups, faction, shipSizeByTypeId, strictMode)
        : { linePaths: [], omegaTransitions: [] },
    [layoutSupported, segments, nodes, shipTreeGroups, faction, shipSizeByTypeId, strictMode],
  )
  const [viewBox, size] = useMemo(() => {
    if (!layoutSupported) {
      return ['0 0 0 0', { width: 0, height: 0 }]
    }

    const vb = computeViewBox(nodes, shipTreeGroups, faction, shipSizeByTypeId)
    const { width, height } = vb
    return [formatViewBox(vb), { width: width, height: height }]
  }, [layoutSupported, nodes, shipTreeGroups, faction, shipSizeByTypeId])

  if (!layoutSupported) {
    return (
      <Box
        ref={ref}
        {...getStyles('root')}
        {...others}
      >
        <Alert
          variant="outline"
          title="Faction layout not available"
          color="yellow"
        >
          Ship tree layout for {getFactionName(faction)} ({faction}) is not implemented yet. Supported factions:{' '}
          {supportedFactionNames}.
        </Alert>
      </Box>
    )
  }

  return (
    <Box
      ref={ref}
      {...getStyles('root')}
      {...others}
    >
      <svg
        {...getStyles('surface')}
        viewBox={viewBox}
        {...size}
        preserveAspectRatio="xMinYMid meet"
        aria-hidden
      >
        <g {...getStyles('lines')}>
          {linePaths.map((path, index) => (
            <LinePath
              key={`path-${index}`}
              {...getStyles('line')}
              {...path}
            />
          ))}
          {omegaTransitions.map((transition, index) => (
            <OmegaIcon
              key={`omega-${index}`}
              x={transition.x}
              y={transition.y}
            />
          ))}
        </g>
        <g {...getStyles('groups')}>
          <Capsule
            x={gridToPixel(0)}
            y={gridToPixel(0)}
          />
          {nodes.map((node, index) => {
            const groupId = node.group
            if (groupId === undefined) {
              return null
            }

            const x = gridToPixel(node.x)
            const y = gridToPixel(node.y)

            return (
              <g key={`group-${groupId}-${index}`}>
                <GroupNode
                  faction={faction}
                  x={x}
                  y={y}
                  groupId={groupId}
                />
                <ShipGroup
                  faction={faction}
                  groupId={groupId}
                  groupNodeX={x}
                  groupNodeY={y}
                />
              </g>
            )
          })}
          {nodes.map((node, index) => {
            const factionId = node.faction
            if (factionId === undefined) {
              return null
            }

            const x = gridToPixel(node.x)
            const y = gridToPixel(node.y)

            return (
              <FactionNode
                key={`faction-${factionId}-${index}`}
                faction={factionId}
                x={x}
                y={y}
              />
            )
          })}
        </g>
      </svg>
    </Box>
  )
})

TreeDisplay.displayName = '@eve-online-tools/eve-ship-tree/TreeDisplay'
TreeDisplay.classes = classes

export namespace TreeDisplay {
  export type Props = TreeDisplayProps
  export type StylesNames = TreeDisplayStylesNames
  export type CssVariables = TreeDisplayCssVariables
  export type Factory = TreeDisplayFactory
  export type Variant = TreeDisplayVariant
}
