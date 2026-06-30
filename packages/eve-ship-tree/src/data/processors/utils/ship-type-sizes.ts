import { identifiers as shipTreeGroups } from '../../identifiers/shipTreeGroups'

import type { TypeDogmaAttribute } from './ship-type-requirements'

export const dogmaAttributeIds = {
  rigSize: 1547,
} as const

export const shipSizeAttributeIds = new Set<number>(Object.values(dogmaAttributeIds))

const freighterShipTreeGroupIds = new Set<number>([shipTreeGroups.freighter, shipTreeGroups.jumpFreighters])

export const resolveRigSize = (
  shipTreeGroupID: number | undefined,
  attributes: TypeDogmaAttribute[] | undefined,
): number => {
  if (shipTreeGroupID !== undefined && freighterShipTreeGroupIds.has(shipTreeGroupID)) {
    return 4
  }

  const [, value] = (attributes ?? []).find(([attribute]) => attribute === dogmaAttributeIds.rigSize) ?? [0, 0]

  return value
}
