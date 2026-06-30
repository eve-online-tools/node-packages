import { MantineProvider } from '@mantine/core'
import type { Meta, StoryObj } from '@storybook/react'
import type { CSSProperties } from 'react'

import { names, type Identifier } from '../data/identifiers/shipTreeFactions'
import { Grid } from './grid'
import { ShipTree } from './ship-tree'
import shipTreeData from './ship-tree.story-data.json'
import { TreeDisplay } from './tree-display'

const storySkills = shipTreeData.skills

const factionOptions = Object.entries(names).map(([, name]) => name)
const factionMapping = Object.fromEntries(
  Object.entries(names).map(([id, name]) => [name, Number(id) as Identifier]),
) as Record<string, Identifier>

const defaultViewportShellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  height: 'calc(100vh - 2rem)',
  width: 'calc(100vw - 2rem)',
}

const constrainedViewportShellStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: 400,
  height: 300,
  margin: '0 auto',
  border: '1px solid rgba(255, 255, 255, 0.2)',
}

const meta = {
  title: 'eve-ship-tree/ShipTree',
  component: ShipTree,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {
    faction: {
      control: 'select',
      options: factionOptions,
      mapping: factionMapping,
    },
    backgroundColor: {
      control: 'color',
    },
    goldenCapsule: {
      control: 'boolean',
    },
    isOmega: {
      control: 'boolean',
    },
    strictMode: {
      control: 'boolean',
    },
  },
  args: {
    faction: 500001,
    backgroundColor: '#070d13',
    goldenCapsule: false,
    isOmega: false,
    strictMode: false,
  },
  decorators: [
    (Story, context) => (
      <MantineProvider>
        <div style={context.parameters.viewportShellStyle ?? defaultViewportShellStyle}>
          <ShipTree.Root
            skills={storySkills}
            baseUrl="/ship-tree-data"
            faction={context.args.faction ?? 500001}
            backgroundColor={context.args.backgroundColor}
            goldenCapsule={context.args.goldenCapsule}
            isOmega={context.args.isOmega}
            strictMode={context.args.strictMode}
            panZoom={context.args.panZoom}
            style={{ flex: 1, minHeight: 0, width: '100%' }}
          >
            <Story />
          </ShipTree.Root>
        </div>
      </MantineProvider>
    ),
  ],
} satisfies Meta<typeof ShipTree>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Grid topLabel="Ship Tree">
      <TreeDisplay />
    </Grid>
  ),
}

export const CustomBackground: Story = {
  args: {
    backgroundColor: '#112233',
    faction: 500003,
  },
  render: () => (
    <Grid topLabel="Ship Tree">
      <TreeDisplay />
    </Grid>
  ),
}

export const ConstrainedViewport: Story = {
  args: {
    faction: 500001,
  },
  parameters: {
    viewportShellStyle: constrainedViewportShellStyle,
  },
  render: () => (
    <Grid topLabel="Ship Tree">
      <TreeDisplay />
    </Grid>
  ),
}

export const PanZoomDisabled: Story = {
  args: {
    panZoom: false,
    faction: 500001,
  },
  render: () => (
    <Grid topLabel="Ship Tree">
      <TreeDisplay />
    </Grid>
  ),
}

export const Loading: Story = {
  decorators: [
    (Story, context) => (
      <MantineProvider>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 2rem)',
            width: 'calc(100vw - 2rem)',
          }}
        >
          <ShipTree.Root
            skills={storySkills}
            baseUrl="/ship-tree-data"
            faction={context.args.faction ?? 500001}
            style={{ flex: 1, minHeight: 0, width: '100%' }}
            fetch={
              (() =>
                new Promise<Response>(() => {
                  /* never resolves */
                })) as typeof fetch
            }
          >
            <Story />
          </ShipTree.Root>
        </div>
      </MantineProvider>
    ),
  ],
  render: () => (
    <Grid topLabel="Ship Tree">
      <TreeDisplay />
    </Grid>
  ),
}

export const ErrorState: Story = {
  decorators: [
    (Story, context) => (
      <MantineProvider>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            height: 'calc(100vh - 2rem)',
            width: 'calc(100vw - 2rem)',
          }}
        >
          <ShipTree.Root
            skills={storySkills}
            baseUrl="/ship-tree-data"
            faction={context.args.faction ?? 500001}
            style={{ flex: 1, minHeight: 0, width: '100%' }}
            fetch={
              (async () =>
                new Response(null, {
                  status: 500,
                  statusText: 'Server Error',
                })) as typeof fetch
            }
          >
            <Story />
          </ShipTree.Root>
        </div>
      </MantineProvider>
    ),
  ],
  render: () => (
    <Grid topLabel="Ship Tree">
      <TreeDisplay />
    </Grid>
  ),
}
