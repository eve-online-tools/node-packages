import { identifiers as f } from '../data/identifiers/shipTreeFactions'
import { identifiers as g } from '../data/identifiers/shipTreeGroups'
import { Root, Node, type RootEntry, type NodeEntry, FactionNode } from './layoutsystem'

export const guristasLayout = (): RootEntry => {
  const addTop = (n: NodeEntry) => FactionNode(0, -7, n, f.caldariState)
  const addBottom = (n: NodeEntry) => FactionNode(0, 7, n, f.gallenteFederation)

  const root = Root()
  let n: NodeEntry

  const frigate = Node(6, 0, root, g.frigate)
  addTop(frigate)
  addBottom(frigate)

  const destroyer = Node(10, 0, frigate, g.destroyer)
  addTop(destroyer)
  addBottom(destroyer)

  const cruiser = Node(10, 0, destroyer, g.cruiser)
  addTop(cruiser)
  addBottom(cruiser)

  const battlecruiser = Node(10, 0, cruiser, g.battlecruiser)
  addTop(battlecruiser)
  addBottom(battlecruiser)

  const battleship = Node(10, 0, battlecruiser, g.battleship)
  addTop(battleship)
  addBottom(battleship)

  n = Node(7, 0, battleship)

  const dreadnought = Node(7, 0, n, g.dreadnought)
  addTop(dreadnought)
  addBottom(dreadnought)

  n = Node(7, -12, n)

  const carrier = Node(7, 0, n, g.carrier)
  addTop(carrier)
  addBottom(carrier)

  n = Node(7, -12, n)

  const titan = Node(7, 0, n, g.titan)
  addTop(titan)
  addBottom(titan)

  return root
}
