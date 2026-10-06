import { identifiers as g } from '../data/identifiers/shipTreeGroups'
import { Root, Node, type RootEntry, type NodeEntry } from './layoutsystem'

export const oreLayout = (): RootEntry => {
  const root = Root()
  let n: NodeEntry

  n = Node(6, 0, root)

  const miningFrigate = Node(6, 0, n, g.miningFrigate)

  n = Node(0, 14, n)
  const oreHauler = Node(36, 0, n, g.oreHauler)

  const factionMiningFrigate = Node(0, -7, miningFrigate, g.factionMiningFrigate)
  n = Node(0, -4, factionMiningFrigate)
  Node(3, -3, n, g.expeditionFrigate)

  const miningDestroyer = Node(18, 0, miningFrigate, g.miningDestroyer)
  const factionMiningDestroyer = Node(0, -7, miningDestroyer, g.factionMiningDestroyer)
  n = Node(0, -4, factionMiningDestroyer)
  Node(3, -3, n, g.miningCommandDestroyer)

  const miningBarge = Node(15, 0, miningDestroyer, g.miningBarge)
  n = Node(0, -4, miningBarge)
  Node(3, -3, n, g.exhumer)

  const industrialCommandShip = Node(12, 0, oreHauler, g.industrialCommandShip)
  Node(15, 0, industrialCommandShip, g.capitalIndustrialShip)

  n = Node(0, 14, oreHauler)
  Node(27, 0, n, g.freighter)

  return root
}
