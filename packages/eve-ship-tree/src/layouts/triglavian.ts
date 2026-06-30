import { identifiers as g } from '../data/identifiers/shipTreeGroups'
import { Root, Node, type RootEntry, type NodeEntry } from './layoutsystem'

export const triglavianLayout = (): RootEntry => {
  const root = Root()
  let n: NodeEntry

  const frigate = Node(6, 0, root, g.frigate)

  n = Node(0, -5, frigate)
  Node(5, -5, n, g.assaultFrigate)

  const destroyer = Node(18, 0, frigate, g.destroyer)
  n = Node(0, -5, destroyer)
  Node(5, -5, n, g.commandDestroyer)

  const cruiser = Node(18, 0, destroyer, g.cruiser)
  n = Node(0, -5, cruiser)
  Node(5, -5, n, g.heavyAssaultCruiser)
  n = Node(0, -5, n)
  Node(5, -5, n, g.logisticsCruisers)

  const battlecruiser = Node(18, 0, cruiser, g.battlecruiser)

  const battleship = Node(18, 0, battlecruiser, g.battleship)
  n = Node(0, -5, battleship)
  Node(5, -5, n, g.marauder)

  Node(18, 0, battleship, g.dreadnought)

  return root
}
