import type { Meta, StoryObj } from '@storybook/react'
import { useState } from 'react'

import shipTreeFactions from '../data/generated/shipTreeFactions.jsonl?raw'
import shipTreeElements from '../data/generated/shipTreeElements.jsonl?raw'
import { identifiers, type Identifier } from '../data/identifiers/shipTreeFactions'
import { FactionSelector } from './faction-selector'
import { FactionSummary, type FactionSummaryData } from './faction-summary'

const parseTable = (content: string) =>
  Object.fromEntries(
    content
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const { _key, ...record } = JSON.parse(line) as { _key: number }
        return [_key, record]
      }),
  )

const data: FactionSummaryData = {
  shipTreeFactions: parseTable(shipTreeFactions),
  shipTreeElements: parseTable(shipTreeElements),
}

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

const WithSummary = ({ variant }: { variant?: 'grid' | 'compact' }) => {
  const [faction, setFaction] = useState<Identifier>(identifiers.minmatarRepublic)

  return (
    <div style={{ width: 'fit-content', maxWidth: 300, padding: 16, backgroundColor: '#070d13' }}>
      <FactionSelector
        value={faction}
        onChange={setFaction}
        variant={variant}
      />
      <FactionSummary
        faction={faction}
        data={data}
      />
    </div>
  )
}

export const Default: Story = {
  render: ({ variant }) => <WithSummary variant={variant} />,
}
