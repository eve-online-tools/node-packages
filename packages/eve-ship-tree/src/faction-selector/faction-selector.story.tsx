import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import { identifiers, type Identifier } from '../data/identifiers/shipTreeFactions'
import { loadShipTreeData } from '../data-provider'
import { FactionSelector } from './faction-selector'
import { FactionSummary, type FactionSummaryData } from './faction-summary'

// Registered in the Storybook eve-sde config.
import shipTreeDataset from 'eve-sde:dataset/eve-ship-tree:data'

const meta = {
  title: 'eve-ship-tree/FactionSelector',
  component: FactionSelector,
  parameters: {
    layout: 'padded',
    backgrounds: { default: 'dark' },
  },
  args: {
    value: identifiers.minmatarRepublic,
    onChange: () => {},
    variant: 'grid',
  },
  argTypes: {
    variant: { control: 'inline-radio', options: ['grid', 'compact'] },
  },
} satisfies Meta<typeof FactionSelector>

export default meta

type Story = StoryObj<typeof meta>

const WithSummary = ({ variant, data }: { variant?: 'grid' | 'compact'; data: FactionSummaryData }) => {
  const [faction, setFaction] = useState<Identifier>(identifiers.minmatarRepublic)
  const [hovered, setHovered] = useState<Identifier | null>(null)

  return (
    <div style={{ width: 'fit-content', padding: 16, backgroundColor: '#070d13' }}>
      <FactionSelector
        value={faction}
        onChange={setFaction}
        onHoverChange={setHovered}
        variant={variant}
      />
      <FactionSummary
        faction={hovered ?? faction}
        data={data}
      />
    </div>
  )
}

export const Default: Story = {
  loaders: [async () => ({ data: await loadShipTreeData(shipTreeDataset) })],
  render: ({ variant }, { loaded }) => (
    <WithSummary
      variant={variant}
      data={loaded.data as FactionSummaryData}
    />
  ),
}
