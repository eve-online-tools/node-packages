import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { Grid } from './grid'

const renderGrid = (ui: ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

describe('Grid', () => {
  it('renders children inside the content slot', () => {
    renderGrid(
      <Grid>
        <span>grid child content</span>
      </Grid>,
    )

    const content = screen.getByTestId('grid-content')

    expect(content).toContainElement(screen.getByText('grid child content'))
  })

  it('renders top label from topLabel prop', () => {
    renderGrid(<Grid topLabel="Custom Tree Label" />)

    expect(screen.getByText('Custom Tree Label')).toBeInTheDocument()
  })

  it('renders default top label', () => {
    renderGrid(<Grid />)

    expect(screen.getByText('Ship Tree')).toBeInTheDocument()
  })

  it('renders header and footer frame regions', () => {
    renderGrid(
      <Grid
        versionLabel="V9.9.9"
        disclaimer="Test disclaimer"
      >
        <span>content</span>
      </Grid>,
    )

    expect(screen.getByText('V9.9.9')).toBeInTheDocument()
    expect(screen.getByText('Test disclaimer')).toBeInTheDocument()
    expect(screen.getByTestId('grid-content')).toBeInTheDocument()
  })
})
