import { identifiers as g } from '../data/identifiers/shipTreeGroups'
import { Root, Node, type RootEntry, type NodeEntry } from './layoutsystem'

export const edencomLayout = (): RootEntry => {
  const root = Root()
  let n: NodeEntry

  n = Node(6, 0, root)

  const frigate = Node(6, 0, n, g.frigate)

  const cruiser = Node(18, 0, frigate, g.cruiser)
  Node(18, 0, cruiser, g.battleship)

  n = Node(0, 15, n)
  const hauler = Node(9, 0, n, g.hauler)
  Node(30, 0, hauler, g.freighter)

  n = Node(0, -5, hauler)
  Node(5, -5, n, g.transportShip)

  return root
}
