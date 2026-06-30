import { MantineProvider } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react'

import { Grid } from './grid'

const meta = {
  title: 'eve-ship-tree/Grid',
  component: Grid,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    topLabel: { control: 'text' },
    versionLabel: { control: 'text' },
    disclaimer: { control: 'text' },
  },
  args: {
    topLabel: 'Ship Tree',
    versionLabel: 'V1.569.496',
    bottomLabel: ['Showing', 'Military and industrial vessels'] as const,
    disclaimer: 'Courtesy of Kaalakiota Corporation',
  },
  decorators: [
    (Story) => (
      <MantineProvider>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 2rem)',
            width: 'calc(100vw - 2rem)',
            backgroundColor: '#070d13',
          }}
        >
          <Story />
        </div>
      </MantineProvider>
    ),
  ],
} satisfies Meta<typeof Grid>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: (args) => (
    <Grid {...args}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'white',
          fontFamily: 'monospace',
        }}
      >
        Grid content area
      </div>
    </Grid>
  ),
}

export const MinimalLabels: Story = {
  args: {
    topLabel: 'Ship Tree',
    versionLabel: undefined,
    bottomLabel: null,
    disclaimer: null,
  },
  render: (args) => (
    <Grid {...args}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          color: 'white',
          fontFamily: 'monospace',
        }}
      >
        Minimal frame labels
      </div>
    </Grid>
  ),
}
