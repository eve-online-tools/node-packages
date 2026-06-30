import type { CSSProperties } from 'react'

import classes from './frame-label.module.css'

export type FrameLabelProps = {
  x: number
  y: number
  label: string
  className?: string
  style?: CSSProperties
}

export const FrameLabel = ({ x, y, label, className, style }: FrameLabelProps) => (
  <text
    className={className ?? classes.root}
    style={style}
    x={x}
    y={y}
    textAnchor="start"
    dominantBaseline="text-after-edge"
  >
    {label}
  </text>
)
