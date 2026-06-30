import { MantineProvider } from '@mantine/core'
import { render, screen } from '@testing-library/react'
import type { ReactElement } from 'react'

import { TopFrame } from './top-frame'

const renderTopFrame = (ui: ReactElement) => render(<MantineProvider>{ui}</MantineProvider>)

describe('TopFrame', () => {
  it('renders default label', () => {
    renderTopFrame(<TopFrame />)

    expect(screen.getByText('Ship Tree')).toBeInTheDocument()
  })

  it('renders custom label', () => {
    renderTopFrame(<TopFrame label="Amarr Ship Tree" />)

    expect(screen.getByText('Amarr Ship Tree')).toBeInTheDocument()
  })

  it('renders horizontal sprite strip with three segments', () => {
    renderTopFrame(<TopFrame />)

    const strip = screen.getByTestId('horizontal-sprite-strip')

    expect(strip).toBeInTheDocument()
    expect(screen.getByTestId('sprite-strip-cap-left')).toBeInTheDocument()
    expect(screen.getByTestId('sprite-strip-stretch')).toBeInTheDocument()
    expect(screen.getByTestId('sprite-strip-cap-right')).toBeInTheDocument()
  })
})
