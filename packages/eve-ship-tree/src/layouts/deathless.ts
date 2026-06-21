import { identifiers as f } from '../data/identifiers/shipTreeFactions'
import { identifiers as g } from '../data/identifiers/shipTreeGroups'
import { Root, Node, type RootEntry, type NodeEntry, FactionNode } from './layoutsystem'

export const deathlessLayout = (): RootEntry => {
  const addTop = (n: NodeEntry) => FactionNode(0, -6, n, f.caldariState)
  const addBottom = (n: NodeEntry) => FactionNode(0, 6, n, f.minmatarRepublic)

  const root = Root()

  const destroyer = Node(6, 0, root, g.destroyer)
  addTop(destroyer)
  addBottom(destroyer)

  const battlecruiser = Node(9, 0, destroyer, g.battlecruiser)
  addTop(battlecruiser)
  addBottom(battlecruiser)

  return root
}
