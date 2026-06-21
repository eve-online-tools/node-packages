import { identifiers as f } from '../data/identifiers/shipTreeFactions'
import { identifiers as g } from '../data/identifiers/shipTreeGroups'
import { Root, Node, type RootEntry, type NodeEntry, FactionNode } from './layoutsystem'

export const soeLayout = (): RootEntry => {
  const addTop = (n: NodeEntry) => FactionNode(0, -6, n, f.amarrEmpire)
  const addBottom = (n: NodeEntry) => FactionNode(0, 6, n, f.gallenteFederation)

  const root = Root()
  let n: NodeEntry

  n = Node(3, 0, root)

  const frigate = Node(3, 0, n, g.frigate)
  addTop(frigate)
  addBottom(frigate)

  n = Node(0, 12, n)
  const expeditionCommandShip = Node(24, 0, n, g.expeditionCommandShip)
  addTop(expeditionCommandShip)
  addBottom(expeditionCommandShip)

  const cruiser = Node(12, 0, frigate, g.cruiser)
  addTop(cruiser)
  addBottom(cruiser)

  const battleship = Node(12, 0, cruiser, g.battleship)
  addTop(battleship)
  addBottom(battleship)

  return root
}
