import { identifiers as g } from '../data/identifiers/shipTreeGroups'
import { Root, Node, type RootEntry } from './layoutsystem'

export const concordLayout = (): RootEntry => {
  const root = Root()

  const shuttle = Node(6, 0, root, g.shuttle)

  const covertOps = Node(15, 0, shuttle, g.covertOps)

  const reconShip = Node(15, 0, covertOps, g.reconShip)

  Node(15, 0, reconShip, g.blackOps)

  const n = Node(0, -6, reconShip)

  Node(4, -4, n, g.flagCruiser)

  return root
}
