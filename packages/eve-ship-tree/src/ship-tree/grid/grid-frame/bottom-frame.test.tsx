import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { BottomFrame } from './bottom-frame'

const renderBottomFrame = (ui: ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

describe('BottomFrame', () => {
  it('renders version label when provided', () => {
    renderBottomFrame(<BottomFrame versionLabel="V1.2.3" />)

    expect(screen.getByText('V1.2.3')).toBeInTheDocument()
  })

  it('renders both tuple label lines when label is set', () => {
    renderBottomFrame(
      <BottomFrame
        label={['Showing', 'Capsuleer vessels']}
        disclaimer={null}
      />,
    )

    expect(screen.getByText('Showing')).toBeInTheDocument()
    expect(screen.getByText('Capsuleer vessels')).toBeInTheDocument()
  })

  it('omits label block when label is null', () => {
    renderBottomFrame(
      <BottomFrame
        label={null}
        versionLabel="V1.0"
        disclaimer={null}
      />,
    )

    expect(screen.getByText('V1.0')).toBeInTheDocument()
    expect(screen.queryByText('Showing')).not.toBeInTheDocument()
    expect(screen.queryByText('Military and industrial vessels')).not.toBeInTheDocument()
  })

  it('renders disclaimer when provided', () => {
    renderBottomFrame(
      <BottomFrame
        label={null}
        disclaimer="Test Corp"
      />,
    )

    expect(screen.getByText('Test Corp')).toBeInTheDocument()
  })

  it('omits disclaimer when null', () => {
    renderBottomFrame(
      <BottomFrame
        label={null}
        disclaimer={null}
      />,
    )

    expect(screen.queryByText('Courtesy of Kaalakiota Corporation')).not.toBeInTheDocument()
  })
})
