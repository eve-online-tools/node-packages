// Grid coordinate system and viewport padding (render-layout, viewBox)
export const cellSize = 24
export const paddingCells = 4

// Ship tree group node icon (group-node, capsule-root)
export const groupBoxWidth = 48
export const groupBoxHeight = 48
export const groupIconLargeSize = 32

// Expanded ship group container (ship-group layout, segment-map extent)
export const groupShipsPaddingTop = 4
export const groupShipsPaddingLeft = 4
export const groupShipsPaddingBottom = 4
export const groupShipsPaddingRight = 0
export const groupTopBorderHeight = 3
export const groupBottomBorderHeight = 1
export const groupBorderSpriteWidth = 12
export const groupBorderSpriteCap = 4
export const groupLabelGap = 0
export const shipsPerRow = 3

// Ship frame size by rig-size class (0–4): shipSizeBase + (sizeClass × shipSizeStep)
export const shipSizeBase = 80
export const shipSizeStep = 16

export const resolveShipNodeSize = (sizeClass: number): number => shipSizeBase + sizeClass * shipSizeStep

// Individual ships within a ship group grid (ship) — default cell size for tests
export const shipNodeWidth = groupBoxWidth * 2
export const shipNodeHeight = groupBoxHeight * 2
export const shipNodeGap = 1
export const shipNodeHoloScale = 0.7
export const shipNodeMasteryHeight = 30
export const shipNodeTechLevelSize = 32

export const shipLabelOverflow = 12

// Skill bars below group nodes (group-node, skill-bar)
export const skillBarHeight = 10
export const skillBarGap = 1

/** Pixel distance from a group node center to the bottom edge of its skill bars. */
export const computeSkillBarsExtentFromGroupCenter = (skillBarCount: number): number => {
  const groupBottomHalf = groupBoxHeight / 2

  if (skillBarCount === 0) {
    return groupBottomHalf
  }

  return groupBottomHalf + skillBarGap + skillBarCount * skillBarHeight + (skillBarCount - 1) * skillBarGap
}

// Connection line segments between groups (line-path)
export const lineSpriteWidth = 10
export const lineSpriteHeight = 10
