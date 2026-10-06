import { forwardRef, useId, useMemo, type ComponentPropsWithoutRef, type ReactNode } from 'react'

import type { Identifier as ShipTreeFactionId } from '../../data/identifiers/shipTreeFactions'
import { names as groupNames, type Identifier as GroupIdentifier } from '../../data/identifiers/shipTreeGroups'
import { useProcessedData } from '../../data-provider'
import { factionLayouts, getFactionName, hasFactionLayout } from '../../layouts'
import { useShipTreeTheme } from '../theme-provider'
import { Alert } from '../feedback'
import { createGetStyles, type StylesApiProps } from '../styles-api'
import { Capsule } from './capsule'
import { FactionNode } from './faction-node'
import { LinePath } from './line-path'
import { OmegaIcon } from './omega-icon'
import { collectLayout, computeViewBox, formatViewBox, gridToPixel } from './render-layout'
import { buildSegmentMap } from './segment-map'
import { GroupNode, ShipGroup } from './ship-group'
import { FloatingTooltip, GroupTooltip, useTooltipTrigger, type GroupTooltipProps } from '../tooltip'
import classes from './tree-display.module.css'

export type TreeDisplayStylesNames = 'root' | 'surface' | 'lines' | 'line' | 'groups'

export interface TreeDisplayProps
  extends StylesApiProps<TreeDisplayStylesNames>, Omit<ComponentPropsWithoutRef<'div'>, 'className' | 'style'> {
  /** Defaults to the faction set on an ancestor `ShipTree`. */
  faction?: ShipTreeFactionId
  /** Tooltip on ship group nodes. `false` turns it off; a function replaces its content. Defaults to `true`. */
  groupTooltip?: boolean | ((props: GroupTooltipProps) => ReactNode)
}

const supportedFactionNames = (Object.keys(factionLayouts) as unknown as ShipTreeFactionId[])
  .filter(hasFactionLayout)
  .map(getFactionName)
  .join(', ')

export const TreeDisplay = forwardRef<HTMLDivElement, TreeDisplayProps>(
  ({ classNames, className, style, styles, faction: factionProp, groupTooltip = true, ...others }, ref) => {
    const { faction: themeFaction, strictMode = false } = useShipTreeTheme()
    const faction = factionProp ?? themeFaction

    if (faction === undefined) {
      throw new Error('TreeDisplay requires a faction prop or a ShipTree ancestor with faction set')
    }

    const tooltipId = useId()
    const groupTooltips = useTooltipTrigger<GroupIdentifier>(groupTooltip !== false)
    const getStyles = createGetStyles<TreeDisplayStylesNames>(classes, { className, style, classNames, styles })
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
        <div
          ref={ref}
          {...getStyles('root')}
          {...others}
        >
          <Alert
            title="Faction layout not available"
            color="yellow"
          >
            Ship tree layout for {getFactionName(faction)} ({faction}) is not implemented yet. Supported factions:{' '}
            {supportedFactionNames}.
          </Alert>
        </div>
      )
    }

    return (
      <div
        ref={ref}
        {...getStyles('root')}
        {...others}
      >
        <svg
          {...getStyles('surface')}
          viewBox={viewBox}
          {...size}
          preserveAspectRatio="xMinYMid meet"
        >
          <g
            {...getStyles('lines')}
            aria-hidden
          >
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
            <g aria-hidden>
              <Capsule
                x={gridToPixel(0)}
                y={gridToPixel(0)}
              />
            </g>
            {nodes.map((node, index) => {
              const groupId = node.group
              if (groupId === undefined) {
                return null
              }

              const x = gridToPixel(node.x)
              const y = gridToPixel(node.y)
              const tooltipOpen = groupTooltips.active?.target === groupId

              return (
                <g key={`group-${groupId}-${index}`}>
                  <g
                    className={classes.groupTrigger}
                    role="img"
                    aria-label={groupNames[groupId as keyof typeof groupNames]}
                    aria-describedby={tooltipOpen ? tooltipId : undefined}
                    tabIndex={groupTooltip === false ? undefined : 0}
                    {...groupTooltips.getTriggerProps(groupId)}
                  >
                    <GroupNode
                      faction={faction}
                      x={x}
                      y={y}
                      groupId={groupId}
                    />
                  </g>
                  <g aria-hidden>
                    <ShipGroup
                      faction={faction}
                      groupId={groupId}
                      groupNodeX={x}
                      groupNodeY={y}
                    />
                  </g>
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
                <g
                  key={`faction-${factionId}-${index}`}
                  aria-hidden
                >
                  <FactionNode
                    faction={factionId}
                    x={x}
                    y={y}
                  />
                </g>
              )
            })}
          </g>
        </svg>
        {groupTooltips.active ? (
          <FloatingTooltip
            id={tooltipId}
            anchor={groupTooltips.active.anchor}
          >
            {typeof groupTooltip === 'function' ? (
              groupTooltip({ groupId: groupTooltips.active.target, faction })
            ) : (
              <GroupTooltip
                groupId={groupTooltips.active.target}
                faction={faction}
              />
            )}
          </FloatingTooltip>
        ) : null}
      </div>
    )
  },
)

TreeDisplay.displayName = '@eve-online-tools/eve-ship-tree/TreeDisplay'

export namespace TreeDisplay {
  export type Props = TreeDisplayProps
  export type StylesNames = TreeDisplayStylesNames
}
