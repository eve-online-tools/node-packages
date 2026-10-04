import { fixtureMapData } from '../test/fixture'
import { installFrameQueue } from '../test/frames'
import { installWebGLMock, type WebGLMock } from '../test/webgl-mock'
import { prepareMap } from './prepare'
import { createMap, type CreateMapOptions, type EveMap } from './create-map'
import { isWebGL2Available, WebGLUnavailableError } from './webgl'

describe('createMap', () => {
  let gl: ReturnType<typeof installWebGLMock>
  let frames: ReturnType<typeof installFrameQueue>
  let maps: EveMap[]

  const setup = (options: Partial<CreateMapOptions> = {}) => {
    const canvas = document.createElement('canvas')
    Object.defineProperty(canvas, 'clientWidth', { value: 400 })
    Object.defineProperty(canvas, 'clientHeight', { value: 300 })
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300 }) as DOMRect
    document.body.append(canvas)
    const map = createMap(canvas, { data: fixtureMapData(), ...options })
    maps.push(map)
    frames.flush()
    const mock = gl.mocks[gl.mocks.length - 1] as WebGLMock
    return { map, canvas, mock }
  }

  beforeEach(() => {
    gl = installWebGLMock()
    frames = installFrameQueue()
    maps = []
  })

  afterEach(() => {
    maps.forEach((map) => map.dispose())
    gl.restore()
    frames.restore()
    document.body.innerHTML = ''
  })

  it('throws WebGLUnavailableError without WebGL 2', () => {
    gl.restore()
    const canvas = document.createElement('canvas')
    canvas.getContext = (() => null) as typeof canvas.getContext
    expect(() => createMap(canvas, { data: fixtureMapData() })).toThrow(WebGLUnavailableError)
  })

  it('reports WebGL 2 availability', () => {
    expect(isWebGL2Available()).toBe(false)
  })

  it('renders once, then stays idle', () => {
    const { map } = setup()
    expect(map.getStats().frames).toBe(1)
    expect(frames.pending).toBe(0)
    frames.flush()
    expect(map.getStats().frames).toBe(1)
  })

  it('uses one draw call per visible layer', () => {
    const { map, mock } = setup({ markers: [{ systemId: 30000001 }], path: [30000001, 30000002, 30000003] })
    // gates, path, systems, markers. Labels need Canvas 2D, unavailable in jsdom.
    expect(map.getStats().drawCalls).toBe(4)
    expect(mock.drawCalls).toBe(4)
  })

  it('renders on demand after changes', () => {
    const { map } = setup()
    map.setHighlight([30000002])
    expect(frames.pending).toBe(1)
    frames.flush()
    expect(map.getStats().frames).toBe(2)
  })

  it('skips frames for no-op updates', () => {
    const { map } = setup({ highlight: [30000002] })
    map.setHighlight([30000002])
    map.setPath([])
    map.setMarkers([])
    map.setSystemStyle({ color: undefined })
    frames.flush()
    expect(map.getStats().frames).toBe(1)
  })

  it('uploads only changed attribute ranges for style updates', () => {
    const { map, mock } = setup()
    const flags = map.renderer.info.memory.geometries
    const before = mock.subDataUploads
    map.setSystemStyle({ size: (i: number) => (i === 3 ? 10 : 4) })
    frames.flush()
    expect(mock.subDataUploads - before).toBe(1)
    expect(map.renderer.info.memory.geometries).toBe(flags)
  })

  it('animates the view transition and resolves', async () => {
    const { map } = setup()
    const changes: string[] = []
    map.on('viewchange', ({ view }) => changes.push(view))
    const done = map.setView('3d', { duration: 100 })
    expect(map.view).toBe('3d')
    const ran = frames.flush(16)
    await done
    expect(ran).toBeGreaterThan(5)
    expect(changes).toEqual(['3d'])
    expect(map.getCamera().polar).toBeGreaterThan(0)
    expect(frames.pending).toBe(0)
  })

  it('can be interrupted mid transition', async () => {
    const { map } = setup()
    const first = map.setView('3d', { duration: 200 })
    frames.flush(16, 3)
    const second = map.setView('2d', { duration: 200 })
    await first
    frames.flush(16)
    await second
    expect(map.view).toBe('2d')
    expect(map.getCamera().polar).toBe(0)
  })

  it('makes transitions instant under reduced motion', async () => {
    const { map } = setup({ reducedMotion: true })
    await map.setView('3d')
    expect(frames.flush()).toBe(1)
  })

  it('focuses systems, regions and constellations', async () => {
    const { map } = setup({ reducedMotion: true })
    await map.focus(30000003)
    const { position2d } = prepareMap(map.data)
    expect(map.getCamera().target[0]).toBeCloseTo(position2d[4])
    expect(map.getCamera().target[2]).toBeCloseTo(position2d[5])
    await map.focus(10000002)
    expect(map.getCamera().viewHeight).toBeGreaterThan(0.06)
  })

  it('picks and projects systems', () => {
    const { map } = setup()
    const projected = map.project(30000004)!
    expect(projected.visible).toBe(true)
    expect(map.pick(projected.x + 2, projected.y)).toBe(3)
    expect(map.project(1)).toBeNull()
    expect(map.project(null)).toBeNull()
  })

  it('emits click and hover events with system IDs', () => {
    const { map, canvas } = setup()
    const clicks: Array<number | null> = []
    const hovers: Array<number | null> = []
    map.on('click', (e) => clicks.push(e.systemId))
    map.on('hover', (e) => hovers.push(e.systemId))
    const { x, y } = map.project(30000002)!

    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x, clientY: y, pointerId: 1 }))
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: x + 1, clientY: y, pointerId: 1 }))
    frames.flush()
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: x, clientY: y, pointerId: 1, button: 0 }))
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: x, clientY: y, pointerId: 1, button: 0 }))

    expect(hovers).toEqual([30000002])
    expect(clicks).toEqual([30000002])
  })

  it('pans on drag without clicking', () => {
    const { map, canvas } = setup()
    const clicks: unknown[] = []
    map.on('click', (e) => clicks.push(e))
    const before = map.getCamera().target[0]
    canvas.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, pointerId: 1, button: 0 }))
    canvas.dispatchEvent(new PointerEvent('pointermove', { clientX: 150, clientY: 100, pointerId: 1, buttons: 1 }))
    canvas.dispatchEvent(new PointerEvent('pointerup', { clientX: 150, clientY: 100, pointerId: 1, button: 0 }))
    expect(map.getCamera().target[0]).toBeLessThan(before)
    expect(clicks).toEqual([])
  })

  it('zooms with the wheel and keyboard', () => {
    const { map, canvas } = setup()
    const before = map.getCamera().viewHeight
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 150, cancelable: true }))
    const afterWheel = map.getCamera().viewHeight
    expect(afterWheel).toBeLessThan(before)
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: '-' }))
    expect(map.getCamera().viewHeight).toBeGreaterThan(afterWheel)
  })

  it('selects the system nearest the view center with Enter', async () => {
    const { map, canvas } = setup({ reducedMotion: true })
    await map.focus(30000005)
    frames.flush()
    const clicks: Array<number | null> = []
    map.on('click', (e) => clicks.push(e.systemId))
    canvas.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }))
    expect(clicks).toEqual([30000005])
  })

  it('locks rotation in 2D', () => {
    const { map } = setup()
    map.setCamera({ azimuth: 1, polar: 1 })
    expect(map.getCamera()).toMatchObject({ azimuth: 0, polar: 0 })
  })

  it('pauses on context loss and resumes on restore', () => {
    const { map, mock } = setup()
    const lost = vi.fn()
    map.on('contextlost', lost)
    mock.loseContext()
    expect(lost).toHaveBeenCalledOnce()
    map.setHighlight([30000001])
    expect(frames.pending).toBe(0)
    mock.restoreContext()
    frames.flush()
    expect(map.getStats().frames).toBe(2)
  })

  it('pauses while the document is hidden', () => {
    const { map } = setup()
    Object.defineProperty(document, 'hidden', { value: true, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    map.setHighlight([30000001])
    expect(frames.pending).toBe(0)
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
    document.dispatchEvent(new Event('visibilitychange'))
    frames.flush()
    expect(map.getStats().frames).toBe(2)
  })

  it('frees all GPU resources on dispose', () => {
    const { map, mock, canvas } = setup({ markers: [{ systemId: 30000001 }], path: [30000001, 30000002] })
    const { memory } = map.renderer.info
    expect(memory.geometries).toBeGreaterThan(0)
    const listeners = vi.spyOn(canvas, 'removeEventListener')

    map.dispose()

    expect(memory.geometries).toBe(0)
    expect(memory.textures).toBe(0)
    expect([...mock.live].filter((o) => (o as { kind: string }).kind === 'buffer')).toEqual([])
    expect(listeners).toHaveBeenCalledWith('pointerdown', expect.any(Function))
    expect(frames.pending).toBe(0)
    map.setHighlight([30000001])
    expect(frames.pending).toBe(0)
  })

  it('rebuilds on setData and keeps markers by ID', () => {
    const { map } = setup({ markers: [{ systemId: 30000006 }] })
    map.setData(fixtureMapData())
    frames.flush()
    expect(map.getStats().drawCalls).toBe(3)
  })
})
