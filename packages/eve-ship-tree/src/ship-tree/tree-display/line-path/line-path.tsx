import { useId } from 'react'

import { lineSpriteHeight, lineSpriteWidth } from '../layout-constants'
import { getLineSegmentFillColor, getLineSegmentSprite, type LinePathFade, type LinePathStatus } from './sprites'
import classes from './line-path.module.css'
import { createGetStyles, type StylesApiProps } from '../../styles-api'

export type LinePathStylesNames = 'root'
export type { LinePathFade, LinePathStatus } from './sprites'

export interface LinePathProps extends StylesApiProps<LinePathStylesNames> {
  points: { x: number; y: number }[]
  status?: LinePathStatus
  fade?: LinePathFade
}

export type LinePathLeg = {
  startX: number
  startY: number
  angle: number
  length: number
}

export const formatPolyline = (points: { x: number; y: number }[]): string => {
  if (points.length === 0) {
    return ''
  }

  const [first, ...rest] = points
  return `M ${first!.x} ${first!.y}${rest.map((p) => ` L ${p.x} ${p.y}`).join('')}`
}

export const legGeometry = (x1: number, y1: number, x2: number, y2: number): LinePathLeg | null => {
  const dx = x2 - x1
  const dy = y2 - y1
  const length = Math.hypot(dx, dy)

  if (length === 0) {
    return null
  }

  return {
    startX: x1,
    startY: y1,
    angle: (Math.atan2(dy, dx) * 180) / Math.PI,
    length,
  }
}

export const LinePath = ({ points, status = 'locked', fade, className, style, classNames, styles }: LinePathProps) => {
  const getStyles = createGetStyles<LinePathStylesNames>(classes, { className, style, classNames, styles })
  const instanceId = useId().replace(/:/g, '')
  const rootStyles = getStyles('root')

  const [fillColor, fillOpacity] = getLineSegmentFillColor(status)
  const [sprite, spriteOpacity] = getLineSegmentSprite(status)

  const legs: LinePathLeg[] = []
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i]!
    const to = points[i + 1]!
    const leg = legGeometry(from.x, from.y, to.x, to.y)
    if (leg !== null) {
      legs.push(leg)
    }
  }

  if (legs.length === 0) {
    return null
  }

  const legFade = fade !== undefined && legs.length === 1 ? fade : undefined

  return (
    <g
      {...rootStyles}
      data-color={fillColor}
    >
      {legs.map((leg, index) => {
        const legId = `${instanceId}-${index}`
        const fadeMaskId = `${legId}-fade-mask`
        const fadeGradientId = `${legId}-fade-gradient`
        const patternId = `${legId}-pattern`

        return (
          <g
            key={index}
            transform={`translate(${leg.startX}, ${leg.startY}) rotate(${leg.angle})`}
            mask={legFade ? `url(#${fadeMaskId})` : undefined}
          >
            <defs>
              {legFade && (
                <>
                  <linearGradient
                    id={fadeGradientId}
                    gradientUnits="userSpaceOnUse"
                    x1={0}
                    y1={0}
                    x2={leg.length}
                    y2={0}
                  >
                    <stop
                      offset="0"
                      stopColor="white"
                      stopOpacity={legFade === 'out' ? 1 : 0}
                    />
                    <stop
                      offset="1"
                      stopColor="white"
                      stopOpacity={legFade === 'out' ? 0 : 1}
                    />
                  </linearGradient>
                  <mask id={fadeMaskId}>
                    <rect
                      x={0}
                      y={-lineSpriteHeight / 2}
                      width={leg.length}
                      height={lineSpriteHeight}
                      fill={`url(#${fadeGradientId})`}
                    />
                  </mask>
                </>
              )}
              <pattern
                id={patternId}
                patternUnits="userSpaceOnUse"
                width={lineSpriteWidth}
                height={lineSpriteHeight}
              >
                <image
                  href={sprite}
                  width={lineSpriteWidth}
                  height={lineSpriteHeight}
                  preserveAspectRatio="none"
                  opacity={spriteOpacity}
                />
              </pattern>
            </defs>
            <rect
              x={0}
              y={-(lineSpriteHeight - 2) / 2}
              width={leg.length}
              height={lineSpriteHeight - 2}
              fill={fillColor}
              fillOpacity={fillOpacity}
            />
            <rect
              x={0}
              y={-lineSpriteHeight / 2}
              width={leg.length}
              height={lineSpriteHeight}
              fill={`url(#${patternId})`}
            />
          </g>
        )
      })}
    </g>
  )
}

LinePath.displayName = '@eve-online-tools/eve-ship-tree/LinePath'
