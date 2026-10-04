import type { Meta, StoryObj } from '@storybook/react'
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from 'react'

import { decodeMapData, regionColor, scaleColor, type MapData, type MapView, type Marker } from '../index'
import { EveMap, type EveMapApi, type EveMapProps } from './EveMap'

// Served by the Storybook config, generated from the SDE by `mapDataProcessor`.
const MAP_DATA_URL = '/eve-map/map-data.bin'

const shell: CSSProperties = { height: 'calc(100vh - 2rem)', width: 'calc(100vw - 2rem)', margin: '1rem' }
const toolbar: CSSProperties = { position: 'absolute', top: 8, left: 8, display: 'flex', gap: 8, zIndex: 1 }

const useMapData = () => {
  const [data, setData] = useState<MapData | null>(null)
  const [error, setError] = useState<string | null>(null)
  useEffect(() => {
    fetch(MAP_DATA_URL)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`)
        }
        return response.arrayBuffer()
      })
      .then((buffer) => setData(decodeMapData(buffer)))
      .catch((reason: unknown) => setError(String(reason)))
  }, [])
  return { data, error }
}

const idsByName = (data: MapData, names: string[]) =>
  names.map((name) => data.systems.id[data.systems.name.indexOf(name)]).filter((id) => id !== undefined)

function WithData({ children }: { children: (data: MapData) => ReactNode }) {
  const { data, error } = useMapData()
  if (error) {
    return <p>Map data unavailable ({error}). Storybook generates it from the SDE on startup.</p>
  }
  return data ? <div style={shell}>{children(data)}</div> : <p>Loading map data...</p>
}

type Args = Pick<EveMapProps, 'defaultView' | 'labels'>

const meta = {
  title: 'eve-map/EveMap',
  parameters: { layout: 'fullscreen' },
  args: { defaultView: '2d', labels: { mode: 'auto', max: 150 } },
  argTypes: { defaultView: { control: 'inline-radio', options: ['2d', '3d'] } },
} satisfies Meta<Args>

export default meta

type Story = StoryObj<Args>

const fill: CSSProperties = { height: '100%' }

export const TwoD: Story = {
  name: '2D',
  render: (args) => (
    <WithData>
      {(data) => (
        <EveMap
          data={data}
          {...args}
          style={fill}
        />
      )}
    </WithData>
  ),
}

export const ThreeD: Story = {
  name: '3D',
  args: { defaultView: '3d' },
  render: (args) => (
    <WithData>
      {(data) => (
        <EveMap
          data={data}
          {...args}
          style={fill}
        />
      )}
    </WithData>
  ),
}

function TransitionDemo({ data }: { data: MapData }) {
  const [view, setView] = useState<MapView>('2d')
  return (
    <EveMap
      data={data}
      view={view}
      onViewChange={setView}
      transition={{ duration: 1200 }}
      style={fill}
    >
      <div style={toolbar}>
        <button
          type="button"
          onClick={() => setView(view === '2d' ? '3d' : '2d')}
        >
          Toggle view (click again mid transition to interrupt)
        </button>
      </div>
    </EveMap>
  )
}

export const Transition: Story = {
  render: () => <WithData>{(data) => <TransitionDemo data={data} />}</WithData>,
}

function ColorsDemo({ data }: { data: MapData }) {
  const [mode, setMode] = useState<'security' | 'region' | 'scale'>('security')
  const systemStyle = useMemo(() => {
    if (mode === 'region') {
      return { color: (i: number) => regionColor(data.systems.region[i]) }
    }
    if (mode === 'scale') {
      // Stand-in for consumer data, e.g. jumps or kills per system.
      const values = Array.from(data.systems.id, (_, i) => Math.abs(Math.sin(i * 12.9898)))
      return { color: scaleColor(values, ['#1b2a49', '#f2c14e', '#e4572e']), size: values.map((v) => 3 + v * 5) }
    }
    return {}
  }, [data, mode])
  return (
    <EveMap
      data={data}
      systemStyle={systemStyle}
      style={fill}
    >
      <div style={toolbar}>
        {(['security', 'region', 'scale'] as const).map((m) => (
          <button
            key={m}
            type="button"
            disabled={m === mode}
            onClick={() => setMode(m)}
          >
            {m}
          </button>
        ))}
      </div>
    </EveMap>
  )
}

export const SecurityColors: Story = {
  render: () => <WithData>{(data) => <ColorsDemo data={data} />}</WithData>,
}

export const Markers: Story = {
  render: (args) => (
    <WithData>
      {(data) => {
        const shapes: Marker['shape'][] = ['ring', 'circle', 'square', 'diamond', 'triangle']
        const markers = idsByName(data, ['Jita', 'Amarr', 'Dodixie', 'Rens', 'Hek']).map((systemId, i) => ({
          systemId,
          shape: shapes[i],
          color: ['#ffcc33', '#4dabf7', '#69db7c', '#ff6b6b', '#da77f2'][i],
          size: 16,
        }))
        return (
          <EveMap
            data={data}
            {...args}
            markers={markers}
            style={fill}
          />
        )
      }}
    </WithData>
  ),
}

export const Path: Story = {
  render: (args) => (
    <WithData>
      {(data) => {
        const route = idsByName(data, ['Jita', 'Perimeter', 'Urlen', 'Sirppala', 'Inaro', 'Kaaputenen', 'Nourvukaiken'])
        return (
          <EveMap
            data={data}
            {...args}
            path={route}
            highlight={[route[0], route[route.length - 1]]}
            style={fill}
          />
        )
      }}
    </WithData>
  ),
}

function FocusDemo({ data }: { data: MapData }) {
  const [api, setApi] = useState<EveMapApi | null>(null)
  const targets: Array<[string, number]> = [
    ['Jita', idsByName(data, ['Jita'])[0]],
    ['The Forge', 10000002],
    ['Delve', 10000060],
    ['Kimotoro', 20000020],
  ]
  return (
    <EveMap
      data={data}
      onReady={setApi}
      style={fill}
    >
      <div style={toolbar}>
        {targets.map(([label, id]) => (
          <button
            key={label}
            type="button"
            onClick={() => api?.focus(id)}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => api?.setView(api.view === '2d' ? '3d' : '2d')}
        >
          Toggle view
        </button>
      </div>
    </EveMap>
  )
}

export const Focus: Story = {
  render: () => <WithData>{(data) => <FocusDemo data={data} />}</WithData>,
}

export const LargeLabelCounts: Story = {
  args: { labels: { mode: 'auto', max: 1000 } },
  render: (args) => (
    <WithData>
      {(data) => (
        <EveMap
          data={data}
          {...args}
          defaultCamera={{ viewHeight: 0.6 }}
          style={fill}
        />
      )}
    </WithData>
  ),
}

function ContextLossDemo({ data }: { data: MapData }) {
  const [api, setApi] = useState<EveMapApi | null>(null)
  const [log, setLog] = useState<string[]>([])
  const lose = () => {
    const extension = api?.renderer.getContext().getExtension('WEBGL_lose_context')
    extension?.loseContext()
    setTimeout(() => {
      extension?.restoreContext()
      setLog((l) => [...l, 'restored'])
    }, 1000)
  }
  return (
    <EveMap
      data={data}
      onReady={setApi}
      onContextLost={() => setLog((l) => [...l, 'lost'])}
      style={fill}
    >
      <div style={toolbar}>
        <button
          type="button"
          onClick={lose}
        >
          Lose context for 1s
        </button>
        <span style={{ color: '#fff' }}>{log.join(', ')}</span>
      </div>
    </EveMap>
  )
}

export const ContextLoss: Story = {
  render: () => <WithData>{(data) => <ContextLossDemo data={data} />}</WithData>,
}
