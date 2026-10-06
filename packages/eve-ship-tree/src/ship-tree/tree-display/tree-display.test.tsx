import { act, fireEvent, render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import {
  lockedCaldariSkills,
  minimalShipTreeData,
  unlockedCaldariSkills,
} from '../../data-provider/__fixtures__/minimal-data'
import { identifiers as groups } from '../../data/identifiers/shipTreeGroups'
import { useProcessedData } from '../../data-provider'
import { ShipTree } from '../ship-tree'
import { TreeDisplay } from './tree-display'
import { renderWithShipTreeProviders } from '../../test/render-with-ship-tree-providers'

const renderTreeDisplay = (ui: ReactElement, options?: Parameters<typeof renderWithShipTreeProviders>[1]) =>
  renderWithShipTreeProviders(ui, options)

const GroupStatusProbe = () => {
  const { shipTreeGroups } = useProcessedData()

  return <span data-testid="group-status">{shipTreeGroups[groups.frigate]?.factions[500001]?.status ?? 'missing'}</span>
}

describe('TreeDisplay', () => {
  it('throws when used outside DataProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => render(<TreeDisplay faction={500001} />)).toThrow(
      'useProcessedData must be used within a DataProvider',
    )

    consoleError.mockRestore()
  })

  it('throws when data is not ready yet', () => {
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>(() => {
          /* never resolves */
        }),
    )
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      renderWithShipTreeProviders(<TreeDisplay faction={500001} />, {
        baseUrl: '/ship-tree-data',
        fetch: fetchImpl as typeof fetch,
      }),
    ).toThrow('Ship tree data is not ready yet')

    consoleError.mockRestore()
  })

  it('renders svg for guristas pirates layout', () => {
    const { container } = renderTreeDisplay(<TreeDisplay faction={500010} />)

    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(screen.queryByText(/Faction layout not available/i)).not.toBeInTheDocument()
  })

  it('derives faction from ShipTree theme when prop is omitted', () => {
    const { container } = renderTreeDisplay(
      <ShipTree faction={500003}>
        <TreeDisplay />
      </ShipTree>,
    )

    expect(container.querySelector('svg')).toBeInTheDocument()
    expect(container.querySelector('[data-faction="500003"]')).toBeInTheDocument()
  })

  it('throws when faction is missing outside ShipTree', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => renderTreeDisplay(<TreeDisplay />)).toThrow(
      'TreeDisplay requires a faction prop or a ShipTree ancestor with faction set',
    )

    consoleError.mockRestore()
  })

  it('renders the ship tree svg', () => {
    const { container } = renderTreeDisplay(<TreeDisplay faction={500001} />)

    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('reflects unlock state from realistic fixture data', () => {
    renderTreeDisplay(
      <>
        <GroupStatusProbe />
        <TreeDisplay faction={500001} />
      </>,
      {
        data: minimalShipTreeData(),
        skills: unlockedCaldariSkills,
      },
    )

    expect(screen.getByTestId('group-status')).toHaveTextContent('unlocked')
  })

  it('shows locked group state with insufficient skills', () => {
    renderTreeDisplay(<GroupStatusProbe />, {
      data: minimalShipTreeData(),
      skills: lockedCaldariSkills,
    })

    expect(screen.getByTestId('group-status')).toHaveTextContent('locked')
  })

  describe('group tooltips', () => {
    const frigateNode = () => screen.getByRole('img', { name: 'Frigate' })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('opens on focus and fades out on Escape', () => {
      vi.useFakeTimers()
      renderTreeDisplay(<TreeDisplay faction={500001} />, { data: minimalShipTreeData() })

      fireEvent.focus(frigateNode())
      expect(screen.getByRole('tooltip')).toHaveTextContent('Frigate')
      expect(frigateNode()).toHaveAttribute('aria-describedby', screen.getByRole('tooltip').id)

      fireEvent.keyDown(document, { key: 'Escape' })
      expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'closed')
      expect(frigateNode()).not.toHaveAttribute('aria-describedby')

      act(() => {
        vi.advanceTimersByTime(150)
      })
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('opens on hover after a delay and closes after leaving', () => {
      vi.useFakeTimers()
      renderTreeDisplay(<TreeDisplay faction={500001} />, { data: minimalShipTreeData() })

      fireEvent.pointerEnter(frigateNode())
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'open')

      fireEvent.pointerLeave(frigateNode())
      act(() => {
        vi.advanceTimersByTime(100 + 150)
      })
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('stays open while the pointer moves into the tooltip', () => {
      vi.useFakeTimers()
      renderTreeDisplay(<TreeDisplay faction={500001} />, { data: minimalShipTreeData() })

      fireEvent.pointerEnter(frigateNode())
      act(() => {
        vi.advanceTimersByTime(300)
      })

      fireEvent.pointerLeave(frigateNode())
      fireEvent.pointerEnter(screen.getByRole('tooltip'))
      act(() => {
        vi.advanceTimersByTime(500)
      })
      expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'open')

      fireEvent.pointerLeave(screen.getByRole('tooltip'))
      expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'closed')
    })

    it('renders custom content', () => {
      renderTreeDisplay(
        <TreeDisplay
          faction={500001}
          groupTooltip={({ groupId }) => <span>custom {groupId}</span>}
        />,
        { data: minimalShipTreeData() },
      )

      fireEvent.focus(frigateNode())
      expect(screen.getByRole('tooltip')).toHaveTextContent(`custom ${groups.frigate}`)
    })

    it('can be turned off', () => {
      renderTreeDisplay(
        <TreeDisplay
          faction={500001}
          groupTooltip={false}
        />,
        { data: minimalShipTreeData() },
      )

      expect(frigateNode()).not.toHaveAttribute('tabindex')
      fireEvent.focus(frigateNode())
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })
  })

  describe('ship tooltips', () => {
    const shipNode = () => screen.getByRole('img', { name: 'Ship 582' })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('opens on focus above or below the ship and fades out on Escape', () => {
      vi.useFakeTimers()
      renderTreeDisplay(<TreeDisplay faction={500001} />, { data: minimalShipTreeData() })

      fireEvent.focus(shipNode())
      const tooltip = screen.getByRole('tooltip')
      expect(tooltip).toHaveTextContent('Ship 582')
      expect(['top', 'bottom']).toContain(tooltip.getAttribute('data-side'))
      expect(shipNode()).toHaveAttribute('aria-describedby', tooltip.id)

      fireEvent.keyDown(document, { key: 'Escape' })
      act(() => {
        vi.advanceTimersByTime(150)
      })
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()
    })

    it('opens on hover after a delay', () => {
      vi.useFakeTimers()
      renderTreeDisplay(<TreeDisplay faction={500001} />, { data: minimalShipTreeData() })

      fireEvent.pointerEnter(shipNode())
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument()

      act(() => {
        vi.advanceTimersByTime(300)
      })
      expect(screen.getByRole('tooltip')).toHaveAttribute('data-state', 'open')
    })

    it('renders custom content', () => {
      renderTreeDisplay(
        <TreeDisplay
          faction={500001}
          shipTooltip={({ typeId }) => <span>custom {typeId}</span>}
        />,
        { data: minimalShipTreeData() },
      )

      fireEvent.focus(shipNode())
      expect(screen.getByRole('tooltip')).toHaveTextContent('custom 582')
    })

    it('can be turned off', () => {
      renderTreeDisplay(
        <TreeDisplay
          faction={500001}
          shipTooltip={false}
        />,
        { data: minimalShipTreeData() },
      )

      expect(screen.queryByRole('img', { name: 'Ship 582' })).not.toBeInTheDocument()
    })
  })
})
