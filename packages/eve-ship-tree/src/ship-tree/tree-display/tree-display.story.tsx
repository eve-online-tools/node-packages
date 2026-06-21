import { MantineProvider } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react'

import { filenames } from '../../data/generated'
import { names, identifiers, type Identifier } from '../../data/identifiers/shipTreeFactions'
import { DataProvider, type Data } from '../../data-provider'
import { SkillsProvider } from '../../skills-provider'
import { hasFactionLayout } from '../../layouts'
import { TreeDisplay } from './tree-display'

const emptyData = (): Data =>
  Object.fromEntries(filenames.map((fileName) => [fileName.replace(/\.jsonl$/, ''), {}])) as Data

const implementedFactionEntries = Object.values(identifiers)
  .filter(hasFactionLayout)
  .map((id) => [id, names[id]] as const)

const factionOptions = implementedFactionEntries.map(([, name]) => name)
const factionMapping = Object.fromEntries(implementedFactionEntries.map(([id, name]) => [name, id])) as Record<
  string,
  Identifier
>

const meta = {
  title: 'eve-ship-tree/TreeDisplay',
  component: TreeDisplay,
  parameters: {
    layout: 'padded',
  },
  argTypes: {
    faction: {
      control: 'select',
      options: factionOptions,
      mapping: factionMapping,
    },
  },
  args: {
    faction: 500001,
  },
  decorators: [
    (Story) => (
      <MantineProvider>
        <SkillsProvider skills={{}}>
          <DataProvider data={emptyData()}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                height: 480,
                width: 640,
                backgroundColor: '#070d13',
              }}
            >
              <Story />
            </div>
          </DataProvider>
        </SkillsProvider>
      </MantineProvider>
    ),
  ],
} satisfies Meta<typeof TreeDisplay>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {}
