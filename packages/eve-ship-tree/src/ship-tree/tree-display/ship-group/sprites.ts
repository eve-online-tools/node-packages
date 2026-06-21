import shipFrameElite from 'res:/ui/texture/classes/shiptree/groups/frameelite.png'
import shipFrameLocked from 'res:/ui/texture/classes/shiptree/groups/framelocked.png'
import shipFrameUnlocked from 'res:/ui/texture/classes/shiptree/groups/frameunlocked.png'
import navyIcon from 'res:/ui/texture/classes/shiptree/tech/navy.png'
import tech2Icon from 'res:/ui/texture/classes/shiptree/tech/tech2.png'
import tech3Icon from 'res:/ui/texture/classes/shiptree/tech/tech3.png'

import type { ShipTechLevel, ShipState } from '../../../data-provider/processors/ship-types'

export type ShipStatus = 'locked' | 'unlocked' | 'mastered'

const shipFrameTint: Record<ShipStatus, [sprite: string, opacity: number]> = {
  locked: [shipFrameLocked, 0.4],
  unlocked: [shipFrameUnlocked, 1.0],
  mastered: [shipFrameElite, 1.0],
}

const shipIconTint: Record<ShipStatus, [string, number]> = {
  locked: ['#ffffff', 0.4],
  unlocked: ['#ffffff', 1.0],
  mastered: ['#fcd17e', 1.0],
}

const shipVignetteTint: Record<ShipStatus, [string, number]> = {
  locked: ['#0b0d1a', 0.1],
  unlocked: ['#0b0d1a', 1.0],
  mastered: ['#fcd17e', 0.15],
}

const techLevelIcons: Partial<Record<ShipTechLevel, string>> = {
  T2: tech2Icon,
  T3: tech3Icon,
  navy: navyIcon,
}

const shipGroupIconTint: Record<ShipStatus, [string, number]> = {
  locked: ['#C0E5FA', 0.6],
  unlocked: ['#C0E5FA', 1.0],
  mastered: ['#C0E5FA', 1.0],
}

const shipGroupBackgroundTint: Record<ShipStatus, [string, number]> = {
  locked: ['#070c13', 1.0],
  unlocked: ['#070c13', 1.0],
  mastered: ['#070c13', 1.0],
}

const shipGroupSkillBarTint: Record<Exclude<ShipStatus, 'mastered'>, [string, number]> = {
  locked: ['#cc3333', 0.6],
  unlocked: ['#C0E5FA', 1.0],
}

const shipGroupSkillBarFrameTint: Record<Exclude<ShipStatus, 'mastered'>, [string, number]> = {
  locked: ['#4F5E66', 0.6],
  unlocked: ['#4F5E66', 0.6],
}

export const getShipFrame = (status: ShipStatus): [string, number] => shipFrameTint[status]

export const getShipIconTint = (status: ShipStatus): [string, number] => shipIconTint[status]

export const getShipStatus = (state: ShipState | undefined, masteryLevel: number): ShipStatus => {
  if (state === 'unlocked' && masteryLevel === 5) {
    return 'mastered'
  }

  return state ?? 'locked'
}

export const getShipVignetteTint = (status: ShipStatus): [string, number] => shipVignetteTint[status]

export const getTechLevelIcon = (techLevel: ShipTechLevel | undefined): string | undefined =>
  techLevel === undefined ? undefined : techLevelIcons[techLevel]

export const getShipGroupBackgroundTint = (status: ShipStatus): [string, number] => shipGroupBackgroundTint[status]

export const getShipGroupIconTint = (status: ShipStatus): [string, number] => shipGroupIconTint[status]

export const getShipGroupSkillBarTint = (status: Exclude<ShipStatus, 'mastered'>): [string, number] =>
  shipGroupSkillBarTint[status]

export const getShipGroupSkillBarFrameTint = (status: Exclude<ShipStatus, 'mastered'>): [string, number] =>
  shipGroupSkillBarFrameTint[status]
