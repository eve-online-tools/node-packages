import eliteLineSprite from 'res:/ui/texture/classes/shiptree/lines/elite.png'
import lockedLineSprite from 'res:/ui/texture/classes/shiptree/lines/locked.png'
import unlockedLineSprite from 'res:/ui/texture/classes/shiptree/lines/unlocked.png'
import type { GroupStatus } from '../../../data-provider/processors/ship-tree-groups'

export type LinePathStatus = GroupStatus | 'mastered'
export type LinePathFade = 'in' | 'out'

const lineSegmentSprites: Record<LinePathStatus, [string, number]> = {
  unlocked: [unlockedLineSprite, 1.0],
  locked: [lockedLineSprite, 1.0],
  mastered: [eliteLineSprite, 1.0],
} as const

const lineSegmentFillColors: Record<LinePathStatus, [string, number]> = {
  unlocked: ['#ffffff', 1.0],
  locked: ['#000000', 0.7],
  mastered: ['#FFCC00', 1.0],
} as const

export const getLineSegmentSprite = (status: LinePathStatus): [string, number] => lineSegmentSprites[status]

export const getLineSegmentFillColor = (status: LinePathStatus): [string, number] => lineSegmentFillColors[status]
