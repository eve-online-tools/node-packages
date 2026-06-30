import { MantineProvider } from '@mantine/core'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'

import { LinePath } from './line-path'
import { getLineSegmentFillColor } from './sprites'

const renderLinePath = (ui: ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

const renderWithSvg = (path: ReactElement) => renderLinePath(<svg>{path}</svg>)

describe('LinePath', () => {
  it('renders underlay and texture rects for a straight segment', () => {
    const { container } = renderWithSvg(
      <LinePath
        status="unlocked"
        points={[
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ]}
      />,
    )

    const textureRect = container.querySelector('g[transform="translate(0, 0) rotate(0)"] rect[fill^="url(#"]')

    expect(container.querySelectorAll('rect')).toHaveLength(2)
    expect(textureRect).toHaveAttribute('width', '100')
  })

  it('applies the locked fill color data attribute for Mantine styling', () => {
    const { container } = renderWithSvg(
      <LinePath
        status="locked"
        points={[
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ]}
      />,
    )

    expect(container.querySelector(`g[data-color="${getLineSegmentFillColor('locked')[0]}"]`)).toBeInTheDocument()
  })

  it('defines a local texture pattern per leg', () => {
    const { container } = renderWithSvg(
      <LinePath
        status="mastered"
        points={[
          { x: 0, y: 0 },
          { x: 40, y: 0 },
        ]}
      />,
    )

    expect(container.querySelector('pattern')).toBeInTheDocument()
    expect(container.querySelector('rect[fill^="url(#"]')).toBeInTheDocument()
  })

  it('renders nothing for degenerate paths', () => {
    const { container } = renderWithSvg(
      <LinePath
        points={[
          { x: 10, y: 20 },
          { x: 10, y: 20 },
        ]}
      />,
    )

    expect(container.querySelector('rect')).not.toBeInTheDocument()
  })

  it('applies a fade mask in local leg coordinates when fade is set', () => {
    const { container } = renderWithSvg(
      <LinePath
        status="unlocked"
        points={[
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ]}
        fade="in"
      />,
    )

    const gradient = container.querySelector('linearGradient')
    const stops = container.querySelectorAll('linearGradient stop')
    const legGroup = container.querySelector('g[transform="translate(0, 0) rotate(0)"][mask]')

    expect(legGroup).toBeInTheDocument()
    expect(container.querySelector('mask rect')).toHaveAttribute('width', '100')
    expect(gradient).toHaveAttribute('gradientUnits', 'userSpaceOnUse')
    expect(gradient).toHaveAttribute('x1', '0')
    expect(gradient).toHaveAttribute('y1', '0')
    expect(gradient).toHaveAttribute('x2', '100')
    expect(gradient).toHaveAttribute('y2', '0')
    expect(stops).toHaveLength(2)
    expect(stops[0]).toHaveAttribute('stop-opacity', '0')
    expect(stops[1]).toHaveAttribute('stop-opacity', '1')
  })

  it('flips the fade gradient for fade out', () => {
    const { container } = renderWithSvg(
      <LinePath
        status="unlocked"
        points={[
          { x: 0, y: 0 },
          { x: 100, y: 0 },
        ]}
        fade="out"
      />,
    )

    const stops = container.querySelectorAll('linearGradient stop')

    expect(stops[0]).toHaveAttribute('stop-opacity', '1')
    expect(stops[1]).toHaveAttribute('stop-opacity', '0')
  })

  it('aligns fade and texture rects with upward faction travel lines', () => {
    const { container } = renderWithSvg(
      <LinePath
        status="unlocked"
        points={[
          { x: 144, y: 0 },
          { x: 144, y: -144 },
        ]}
        fade="out"
      />,
    )

    const legGroup = container.querySelector('g[transform="translate(144, 0) rotate(-90)"][mask]')

    expect(legGroup).toBeInTheDocument()
    expect(container.querySelector('mask rect')).toHaveAttribute('width', '144')
    expect(legGroup?.querySelector('rect[fill^="url(#"]')).toHaveAttribute('width', '144')
    expect(container.querySelector('mask g[transform]')).not.toBeInTheDocument()
  })

  it('renders one texture leg per polyline segment', () => {
    const { container } = renderWithSvg(
      <LinePath
        status="unlocked"
        points={[
          { x: 0, y: 0 },
          { x: 100, y: 0 },
          { x: 100, y: 50 },
        ]}
      />,
    )

    expect(container.querySelectorAll('rect[fill^="url(#"]')).toHaveLength(2)
  })
})
