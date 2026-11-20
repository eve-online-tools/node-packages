import { Identifier } from '../../data/identifiers/shipTreeFactions'
import type { ShipTreeGroupPreReqSkill, ShipTreeGroupRecord } from '../../data-provider/schema'

export const shipTreeGroupSkills = (
  group: ShipTreeGroupRecord | undefined,
  factionId: Identifier,
): ShipTreeGroupPreReqSkill[] => group?.preReqSkills?.find((entry) => entry.factionID === factionId)?.skills ?? []
