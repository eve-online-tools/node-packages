import { act, render } from '@testing-library/react'
import { StrictMode, useEffect, useState } from 'react'

import { fixtureMapData } from '../test/fixture'
import { installFrameQueue } from '../test/frames'
import { installWebGLMock } from '../test/webgl-mock'
import { EveMap, useEveMap, type EveMapApi } from './EveMap'

describe('<EveMap>', () => {
  let gl: ReturnType<typeof installWebGLMock>
  let frames: ReturnType<typeof installFrameQueue>
  const data = fixtureMapData()

  beforeEach(() => {
    gl = installWebGLMock()
    frames = installFrameQueue()
  })

  afterEach(() => {
    gl.restore()
    frames.restore()
  })

  const liveBuffers = () =>
    gl.mocks.flatMap((mock) => [...mock.live]).filter((o) => (o as { kind: string }).kind === 'buffer').length

  it('survives StrictMode double mount without leaking contexts', () => {
    let api: EveMapApi | null = null
    const { container, unmount } = render(
      <StrictMode>
        <EveMap
          data={data}
          onReady={(map) => {
            api = map
          }}
        />
      </StrictMode>,
    )
    act(() => {
      frames.flush()
    })

    expect(container.querySelectorAll('canvas')).toHaveLength(1)
    expect(gl.mocks).toHaveLength(2)
    expect(gl.mocks[0].isLost()).toBe(true)
    expect(gl.mocks[1].isLost()).toBe(false)
    expect(api).not.toBeNull()

    unmount()
    expect(liveBuffers()).toBe(0)
    expect(frames.pending).toBe(0)
  })

  it('renders the fallback without WebGL 2', () => {
    gl.restore()
    HTMLCanvasElement.prototype.getContext = (() => null) as typeof HTMLCanvasElement.prototype.getContext
    const { getByText, container } = render(
      <EveMap
        data={data}
        fallback={<p>No WebGL</p>}
      />,
    )
    expect(getByText('No WebGL')).toBeInTheDocument()
    expect(container.querySelector('canvas')).toBeNull()
  })

  it('syncs props to the map without redundant frames', () => {
    let api: EveMapApi | null = null
    const { rerender } = render(
      <EveMap
        data={data}
        highlight={[30000001]}
        onReady={(map) => (api = map)}
      />,
    )
    act(() => {
      frames.flush()
    })
    const map = api as unknown as EveMapApi
    const framesAfterMount = map.getStats().frames

    rerender(
      <EveMap
        data={data}
        highlight={[30000001]}
        onReady={(m) => (api = m)}
      />,
    )
    act(() => {
      frames.flush()
    })
    expect(map.getStats().frames).toBe(framesAfterMount)

    rerender(
      <EveMap
        data={data}
        highlight={[30000002]}
        markers={[{ systemId: 30000003 }]}
        onReady={(m) => (api = m)}
      />,
    )
    act(() => {
      frames.flush()
    })
    expect(map.getStats().frames).toBe(framesAfterMount + 1)
    expect(map.getStats().drawCalls).toBe(3)
  })

  it('supports a controlled view', async () => {
    const changes: string[] = []
    let child: EveMapApi | null = null

    function Child() {
      const api = useEveMap()
      useEffect(() => {
        child = api
      }, [api])
      return null
    }

    function Controlled() {
      const [view, setView] = useState<'2d' | '3d'>('2d')
      return (
        <EveMap
          data={data}
          view={view}
          reducedMotion
          onViewChange={(next) => {
            changes.push(next)
            setView(next)
          }}
        >
          <Child />
        </EveMap>
      )
    }

    render(<Controlled />)
    act(() => {
      frames.flush()
    })
    const api = child as unknown as EveMapApi
    await act(async () => {
      await api.setView('3d')
    })
    expect(changes).toEqual(['3d'])
    expect(api.view).toBe('3d')
  })

  it('follows the focus prop and toggles controls', () => {
    let api: EveMapApi | null = null
    const { rerender, container } = render(
      <EveMap
        data={data}
        focus={[30000001]}
        controls={false}
        reducedMotion
        onReady={(m) => (api = m)}
      />,
    )
    act(() => {
      frames.flush()
    })
    const map = api as unknown as EveMapApi
    const first = map.getCamera()
    const canvas = container.querySelector('canvas')!
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }))
    expect(map.getCamera()).toEqual(first)

    rerender(
      <EveMap
        data={data}
        focus={[30000006]}
        reducedMotion
        onReady={(m) => (api = m)}
      />,
    )
    expect(map.getCamera().target).not.toEqual(first.target)
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, cancelable: true }))
    expect(map.getCamera().zoom).toBeGreaterThan(first.zoom)
  })

  it('passes the instance to render-prop children', () => {
    const seen: Array<{ x: number; y: number } | null> = []
    render(
      <EveMap data={data}>
        {(api) => {
          seen.push(api.project(30000001))
          return null
        }}
      </EveMap>,
    )
    act(() => {
      frames.flush()
    })
    expect(seen.at(-1)).toMatchObject({ visible: true })
  })
})
