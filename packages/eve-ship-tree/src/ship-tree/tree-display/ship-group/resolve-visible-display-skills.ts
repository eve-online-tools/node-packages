import type { PerFactionInfo } from '../../../data-provider/processors/ship-tree-groups'
import type { Skills } from '../../../skills-provider/context'

export const resolveVisibleDisplaySkills = (factionInfo: PerFactionInfo | undefined, strictMode: boolean): Skills => {
  if (factionInfo === undefined) {
    return {}
  }

  if (strictMode && factionInfo.status === 'locked') {
    return {}
  }

  return factionInfo.displaySkills
}
