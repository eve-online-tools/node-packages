import { identifiers as factions } from '../../data/identifiers/shipTreeFactions'
import { identifiers as groups } from '../../data/identifiers/shipTreeGroups'
import type { Data } from '../types'
import { emptyData } from '../../test/render-with-ship-tree-providers'

const bantamTypeId = 582

const frigateGroup = {
  elements: [{ _key: 1, _value: 30 }],
  preReqSkills: [
    {
      _key: factions.caldariState,
      skills: [{ _key: 3330, display: true, level: 1 }],
    },
  ],
}

export const minimalShipTreeData = (): Data => ({
  ...emptyData(),
  shipTreeGroups: {
    [groups.frigate]: frigateGroup,
  },
  types: {
    [bantamTypeId]: {
      shipTreeGroupID: groups.frigate,
      factionID: factions.caldariState,
      metaGroupID: 1,
      techLevel: 1,
    },
  },
  requiredSkills: {
    [bantamTypeId]: {
      requiredSkills: { 3330: 1 },
    },
  },
  masteries: {},
  certificates: {},
})

export const unlockedCaldariSkills = { 3330: 5 } as const
export const lockedCaldariSkills = { 3330: 0 } as const
