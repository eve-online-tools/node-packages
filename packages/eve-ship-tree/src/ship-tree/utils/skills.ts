import { Identifier } from '../../data/identifiers/shipTreeFactions'
import type { ShipTreeGroupPreReqSkill, ShipTreeGroupRecord } from '../types/ship-tree-group'

export const shipTreeGroupSkills = (
  group: ShipTreeGroupRecord | undefined,
  factionId: Identifier,
): ShipTreeGroupPreReqSkill[] => group?.preReqSkills?.find((entry) => entry._key === factionId)?.skills ?? []
