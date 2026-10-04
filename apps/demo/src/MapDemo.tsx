import { decodeMapData, regionColor, type MapData, type MapView, type SystemEvent } from '@eve-online-tools/eve-map'
import { EveMap } from '@eve-online-tools/eve-map/react'
import { useEffect, useMemo, useState } from 'react'
import mapDataUrl from './generated/sde/map-data.bin?url'

type ColorMode = 'security' | 'region'

const button = { padding: '4px 10px', cursor: 'pointer' }

export function MapDemo() {
  const [data, setData] = useState<MapData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [view, setView] = useState<MapView>('2d')
  const [colorMode, setColorMode] = useState<ColorMode>('security')
  const [hovered, setHovered] = useState<SystemEvent | null>(null)
  const [route, setRoute] = useState<number[]>([])

  useEffect(() => {
    fetch(mapDataUrl)
      .then((response) => response.arrayBuffer())
      .then((buffer) => setData(decodeMapData(buffer)))
      .catch((reason: unknown) => setError(String(reason)))
  }, [])

  const systemStyle = useMemo(
    () =>
      data && colorMode === 'region'
        ? { color: (i: number) => regionColor(data.constellations[data.systems[i].constellationId].regionId) }
        : {},
    [data, colorMode],
  )

  const names = useMemo(() => new Map(data?.systems.map((s) => [s.id, s.name])), [data])

  if (error) {
    return <p>Failed to load map data: {error}</p>
  }
  if (!data) {
    return <p>Loading map data...</p>
  }

  const markers = route.length > 0 ? [{ systemId: route[route.length - 1], shape: 'diamond' as const, size: 14 }] : []

  return (
    <section>
      <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
        <button
          type="button"
          style={button}
          onClick={() => setView(view === '2d' ? '3d' : '2d')}
        >
          Switch to {view === '2d' ? '3D' : '2D'}
        </button>
        <button
          type="button"
          style={button}
          onClick={() => setColorMode(colorMode === 'security' ? 'region' : 'security')}
        >
          Color by {colorMode === 'security' ? 'region' : 'security'}
        </button>
        <button
          type="button"
          style={button}
          onClick={() => setRoute([])}
          disabled={route.length === 0}
        >
          Clear path
        </button>
        <span style={{ fontSize: 13, color: '#868e96', alignSelf: 'center' }}>
          Click systems to build a path. Drag to pan (3D: orbit, right drag pans), wheel to zoom, arrows and +/- with
          keyboard focus.
        </span>
      </div>
      <EveMap
        data={data}
        view={view}
        onViewChange={setView}
        systemStyle={systemStyle}
        path={route}
        highlight={route}
        markers={markers}
        onSystemHover={(event) => setHovered(event.systemId === null ? null : event)}
        onSystemClick={(event) => {
          if (event.systemId !== null) {
            setRoute((previous) => [...previous, event.systemId as number])
          }
        }}
        fallback={<p>WebGL 2 is not available in this browser.</p>}
        style={{ height: '70vh', borderRadius: 8 }}
      >
        {(api) => {
          const position = hovered ? api.project(hovered.systemId) : null
          if (!hovered || !position?.visible) {
            return null
          }
          return (
            <div
              style={{
                position: 'absolute',
                left: position.x + 12,
                top: position.y + 12,
                padding: '4px 8px',
                background: 'rgba(0, 0, 0, 0.8)',
                color: '#fff',
                fontSize: 12,
                borderRadius: 4,
                pointerEvents: 'none',
              }}
            >
              {names.get(hovered.systemId as number)}
            </div>
          )
        }}
      </EveMap>
      <p style={{ fontSize: 13 }}>Path: {route.map((id) => names.get(id)).join(' → ') || 'none'}</p>
    </section>
  )
}
