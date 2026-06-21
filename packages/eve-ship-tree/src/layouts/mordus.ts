import { identifiers as f } from '../data/identifiers/shipTreeFactions'
import { identifiers as g } from '../data/identifiers/shipTreeGroups'
import { Root, Node, type RootEntry, type NodeEntry, FactionNode } from './layoutsystem'

export const mordusLayout = (): RootEntry => {
  const addTop = (n: NodeEntry) => FactionNode(0, -6, n, f.caldariState)
  const addBottom = (n: NodeEntry) => FactionNode(0, 6, n, f.gallenteFederation)

  const root = Root()

  const frigate = Node(6, 0, root, g.frigate)
  addTop(frigate)
  addBottom(frigate)

  const cruiser = Node(9, 0, frigate, g.cruiser)
  addTop(cruiser)
  addBottom(cruiser)

  const battleship = Node(9, 0, cruiser, g.battleship)
  addTop(battleship)
  addBottom(battleship)

  return root
}
