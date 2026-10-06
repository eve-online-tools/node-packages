import { identifiers as g } from '../data/identifiers/shipTreeGroups'
import { Root, Node, type RootEntry } from './layoutsystem'

export const soctLayout = (): RootEntry => {
  const root = Root()

  const shuttle = Node(6, 0, root, g.shuttle)

  const frigate = Node(12, 0, shuttle, g.frigate)

  const destroyer = Node(12, 0, frigate, g.destroyer)

  const battlecruiser = Node(12, 0, destroyer, g.battlecruiser)

  Node(12, 0, battlecruiser, g.battleship)

  return root
}
