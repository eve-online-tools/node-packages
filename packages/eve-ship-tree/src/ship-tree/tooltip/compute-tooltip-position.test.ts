import { computeTooltipPosition } from './compute-tooltip-position'

const viewport = { width: 1000, height: 800 }
const tooltip = { width: 300, height: 200 }

describe('computeTooltipPosition', () => {
  it('places the tooltip right of the anchor, centred vertically', () => {
    const position = computeTooltipPosition({
      anchor: { left: 100, top: 300, width: 50, height: 50 },
      tooltip,
      viewport,
    })

    expect(position).toEqual({ left: 162, top: 225, side: 'right', pointer: 'left', arrowTop: 100 })
  })

  it('flips left when there is no room on the right', () => {
    const position = computeTooltipPosition({
      anchor: { left: 800, top: 300, width: 50, height: 50 },
      tooltip,
      viewport,
    })

    expect(position.side).toBe('left')
    expect(position.pointer).toBe('right')
    expect(position.left).toBe(800 - 12 - 300)
  })

  it('uses a corner pointer when the viewport pushes the tooltip past the anchor', () => {
    const above = computeTooltipPosition({
      anchor: { left: 100, top: 0, width: 50, height: 20 },
      tooltip,
      viewport,
    })
    const below = computeTooltipPosition({
      anchor: { left: 800, top: 780, width: 50, height: 20 },
      tooltip,
      viewport,
    })

    expect(above.top).toBe(8)
    expect(above.pointer).toBe('topleft')
    expect(below.top).toBe(800 - 8 - 200)
    expect(below.pointer).toBe('bottomright')
  })
})
