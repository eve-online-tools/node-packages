import { identifiers as g } from '../data/identifiers/shipTreeGroups'
import { Root, Node, type RootEntry, type NodeEntry } from './layoutsystem'

export const empireLayout = (): RootEntry => {
  const root = Root()
  let n: NodeEntry

  const corvette = Node(6, 0, root, g.corvette)

  n = Node(0, 12, corvette)
  n = Node(1, 1, n)
  const shuttle = Node(6, 0, n, g.shuttle)

  n = Node(10, 0, corvette)
  n = Node(1, -1, n)
  const frigate = Node(0, -7, n, g.frigate)
  const navyFrigate = Node(0, -6, frigate, g.navyFrigate)
  n = Node(0, -6, navyFrigate)
  Node(4, -4, n, g.interceptor)
  n = Node(0, -6, n)
  Node(4, -4, n, g.assaultFrigate)
  n = Node(0, -6, n)
  Node(4, -4, n, g.covertOps)
  n = Node(0, -6, n)
  Node(4, -4, n, g.electronicAttackShip)
  n = Node(0, -6, n)
  Node(4, -4, n, g.logisticsFrigates)

  const destroyer = Node(18, 0, frigate, g.destroyer)
  const navyDestroyer = Node(0, -6, destroyer, g.navyDestroyer)
  n = Node(0, -6, navyDestroyer)
  Node(4, -4, n, g.interdictor)
  n = Node(0, -6, n)
  Node(4, -4, n, g.commandDestroyer)
  n = Node(0, -6, n)
  Node(4, -4, n, g.tacticalDestroyer)

  const cruiser = Node(18, 0, destroyer, g.cruiser)
  const navyCruiser = Node(0, -6, cruiser, g.navyCruiser)
  n = Node(0, -6, navyCruiser)
  Node(4, -4, n, g.reconShip)
  n = Node(0, -6, n)
  Node(4, -4, n, g.heavyAssaultCruiser)
  n = Node(0, -6, n)
  Node(4, -4, n, g.heavyInterdictionCruiser)
  n = Node(0, -6, n)
  Node(4, -4, n, g.logisticsCruisers)
  n = Node(0, -8, n)
  Node(6, -6, n, g.strategicCruiser)

  const battlecruiser = Node(22, 0, cruiser, g.battlecruiser)
  const navyBattlecruiser = Node(0, -6, battlecruiser, g.navyBattlecruiser)
  n = Node(0, -6, navyBattlecruiser)
  Node(4, -4, n, g.commandShips)

  const battleship = Node(22, 0, battlecruiser, g.battleship)
  const navyBattleship = Node(0, -6, battleship, g.navyBattleship)
  n = Node(0, -6, navyBattleship)
  Node(4, -4, n, g.blackOps)
  n = Node(0, -6, n)
  Node(4, -4, n, g.marauder)
  n = Node(24, 0, battleship)

  const dreadnought = Node(4, 0, n, g.dreadnought)

  n = Node(0, -28, n)

  Node(6, -6, n, g.carrier)
  n = Node(0, -9, n)
  Node(6, -6, n, g.commandCarrier)
  n = Node(0, -9, n)
  Node(6, -6, n, g.titan)

  const navyDreadnought = Node(0, -6, dreadnought, g.navyDreadnought)
  n = Node(0, -9, navyDreadnought)
  Node(3, -3, n, g.lancerDreadnought)

  const hauler = Node(62, 0, shuttle, g.hauler)
  n = Node(0, -6, hauler)
  Node(3, -3, n, g.transportShip)

  const freighter = Node(43, 0, hauler, g.freighter)
  n = Node(0, -2, freighter)
  Node(9, -9, n, g.jumpFreighters)

  return root
}
