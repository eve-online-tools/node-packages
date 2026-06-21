import { MantineProvider } from '@mantine/core'
import { render, screen, waitFor } from '@testing-library/react'
import type { ReactElement } from 'react'

import { DataProvider } from '../data-provider'
import { LOAD_DATA_GENERIC_ERROR } from '../data-provider/types'
import { SkillsProvider } from '../skills-provider'
import { ShipTree } from './ship-tree'
import { useShipTreeTheme } from './theme-provider'
import { emptyData, renderWithShipTreeProviders } from '../test/render-with-ship-tree-providers'

const ThemeConsumer = () => {
  const { faction } = useShipTreeTheme()

  return <span data-testid="theme-faction">{faction ?? ''}</span>
}

const renderShipTree = (ui: ReactElement, options?: Parameters<typeof renderWithShipTreeProviders>[1]) =>
  renderWithShipTreeProviders(ui, options)

describe('ShipTree', () => {
  it('renders children when data is ready', () => {
    renderShipTree(
      <ShipTree>
        <span>ship tree child</span>
      </ShipTree>,
    )

    expect(screen.getByText('ship tree child')).toBeInTheDocument()
  })

  it('hides children while loading', async () => {
    const fetchImpl = vi.fn(
      () =>
        new Promise<Response>(() => {
          /* never resolves */
        }),
    )

    renderShipTree(
      <ShipTree>
        <span>ship tree child</span>
      </ShipTree>,
      { baseUrl: '/ship-tree-data', fetch: fetchImpl as typeof fetch },
    )

    expect(screen.queryByText('ship tree child')).not.toBeInTheDocument()
    expect(document.querySelector('.mantine-LoadingOverlay-root')).toBeTruthy()
  })

  it('shows error on fetch failure', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const fetchImpl = vi.fn(async () => new Response(null, { status: 500, statusText: 'Server Error' }))

    renderShipTree(
      <ShipTree>
        <span>ship tree child</span>
      </ShipTree>,
      { baseUrl: '/ship-tree-data', fetch: fetchImpl as typeof fetch },
    )

    await waitFor(() => {
      expect(screen.getByText(LOAD_DATA_GENERIC_ERROR)).toBeInTheDocument()
    })

    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
    expect(screen.queryByText('ship tree child')).not.toBeInTheDocument()
  })

  it('applies default background color', () => {
    const { container } = renderShipTree(
      <ShipTree data-testid="ship-tree-root">
        <span>child</span>
      </ShipTree>,
    )

    const root = container.querySelector('[data-testid="ship-tree-root"]')

    expect(root).toBeTruthy()
    expect(root).toHaveStyle({ '--ship-tree-background-color': '#070d13' })
  })

  it('applies custom backgroundColor prop', () => {
    const { container } = renderShipTree(
      <ShipTree
        backgroundColor="#112233"
        data-testid="ship-tree-root"
      >
        <span>child</span>
      </ShipTree>,
    )

    const root = container.querySelector('[data-testid="ship-tree-root"]')

    expect(root).toBeTruthy()
    expect(root).toHaveStyle({ '--ship-tree-background-color': '#112233' })
  })

  it('sets data-faction on root', () => {
    const { container, rerender } = renderShipTree(
      <ShipTree
        faction={500001}
        data-testid="ship-tree-root"
      >
        <span>child</span>
      </ShipTree>,
    )

    const root = container.querySelector('[data-testid="ship-tree-root"]')

    expect(root).toHaveAttribute('data-faction', '500001')

    rerender(
      <MantineProvider>
        <SkillsProvider skills={{}}>
          <DataProvider data={emptyData()}>
            <ShipTree
              faction={500004}
              data-testid="ship-tree-root"
            >
              <span>child</span>
            </ShipTree>
          </DataProvider>
        </SkillsProvider>
      </MantineProvider>,
    )

    expect(container.querySelector('[data-testid="ship-tree-root"]')).toHaveAttribute('data-faction', '500004')
  })

  it('provides faction via theme', () => {
    renderShipTree(
      <ShipTree faction={500003}>
        <ThemeConsumer />
      </ShipTree>,
    )

    expect(screen.getByTestId('theme-faction')).toHaveTextContent('500003')
  })

  it('throws when SkillProvider is missing', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() =>
      render(
        <MantineProvider>
          <DataProvider data={emptyData()}>
            <ShipTree>
              <span>child</span>
            </ShipTree>
          </DataProvider>
        </MantineProvider>,
      ),
    ).toThrow('useSkills must be used within a SkillProvider')

    consoleError.mockRestore()
  })

  it('renders children inside a pan-zoom viewport by default', () => {
    renderShipTree(
      <ShipTree>
        <span>ship tree child</span>
      </ShipTree>,
    )

    expect(screen.getByTestId('pan-zoom-viewport')).toBeInTheDocument()
  })

  it('renders without the pan-zoom viewport when panZoom is disabled', () => {
    renderShipTree(
      <ShipTree panZoom={false}>
        <span>ship tree child</span>
      </ShipTree>,
    )

    expect(screen.queryByTestId('pan-zoom-viewport')).not.toBeInTheDocument()
    expect(screen.getByText('ship tree child')).toBeInTheDocument()
  })
})
