import type { Identifier as GroupIdentifier } from '../data/identifiers/shipTreeGroups'
import type { Identifier as FactionIdentifier } from '../data/identifiers/shipTreeFactions'

export type RootEntry = {
  links: NodeEntry[]
}

export type NodeEntry = RootEntry & {
  x: number
  y: number
  parent: RootEntry | NodeEntry
  group?: GroupIdentifier
  faction?: FactionIdentifier
  parentGroup?: GroupIdentifier
}

export const Root = (): RootEntry => ({
  links: [],
})

export const Node = (x: number, y: number, parent: RootEntry, group?: GroupIdentifier): NodeEntry => {
  const node: NodeEntry = {
    x,
    y,
    parent,
    group,
    links: [],
  }

  parent.links.push(node)

  return node
}

export const FactionNode = (x: number, y: number, parent: RootEntry, faction: FactionIdentifier): NodeEntry => {
  const node = Node(x, y, parent)
  node.faction = faction
  return node
}

type ViewBox = {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

export const calculateLayoutSize = (root: RootEntry): ViewBox => {
  if (root.links.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  const viewBox: ViewBox = {
    minX: 0,
    minY: 0,
    maxX: 0,
    maxY: 0,
  }

  const visit = (node: NodeEntry, x: number, y: number) => {
    for (const link of node.links) {
      const newX = x + link.x
      const newY = y + link.y

      viewBox.minX = Math.min(viewBox.minX, newX)
      viewBox.minY = Math.min(viewBox.minY, newY)
      viewBox.maxX = Math.max(viewBox.maxX, newX)
      viewBox.maxY = Math.max(viewBox.maxY, newY)

      visit(link, newX, newY)
    }
  }

  for (const link of root.links) {
    const x = link.x
    const y = link.y

    viewBox.minX = Math.min(viewBox.minX, x)
    viewBox.minY = Math.min(viewBox.minY, y)
    viewBox.maxX = Math.max(viewBox.maxX, x)
    viewBox.maxY = Math.max(viewBox.maxY, y)

    visit(link, x, y)
  }

  return viewBox
}
