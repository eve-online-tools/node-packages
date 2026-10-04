/**
 * Minimal WebGL2 stand-in for jsdom, enough for three's WebGLRenderer to initialize, upload and "draw".
 * Records draw calls and live GPU objects so tests can assert on-demand rendering and cleanup.
 */
export interface WebGLMock {
  context: WebGL2RenderingContext
  drawCalls: number
  /** Buffers, textures, programs, etc. created and not yet deleted */
  live: Set<object>
  /** Partial range uploads (`bufferSubData`) */
  subDataUploads: number
  isLost: () => boolean
  loseContext: () => void
  restoreContext: () => void
}

const PARAMETERS: Record<string, unknown> = {
  VERSION: 'WebGL 2.0 (mock)',
  SHADING_LANGUAGE_VERSION: 'WebGL GLSL ES 3.00 (mock)',
  MAX_TEXTURE_IMAGE_UNITS: 16,
  MAX_VERTEX_TEXTURE_IMAGE_UNITS: 16,
  MAX_COMBINED_TEXTURE_IMAGE_UNITS: 32,
  MAX_TEXTURE_SIZE: 4096,
  MAX_CUBE_MAP_TEXTURE_SIZE: 4096,
  MAX_VERTEX_ATTRIBS: 16,
  MAX_VERTEX_UNIFORM_VECTORS: 1024,
  MAX_VARYING_VECTORS: 30,
  MAX_FRAGMENT_UNIFORM_VECTORS: 1024,
  MAX_SAMPLES: 4,
  MAX_3D_TEXTURE_SIZE: 2048,
  MAX_ARRAY_TEXTURE_LAYERS: 256,
  MAX_RENDERBUFFER_SIZE: 4096,
  MAX_UNIFORM_BUFFER_BINDINGS: 24,
  UNIFORM_BUFFER_OFFSET_ALIGNMENT: 256,
  MAX_COLOR_ATTACHMENTS: 4,
  MAX_DRAW_BUFFERS: 4,
}

export const createWebGLMock = (canvas: HTMLCanvasElement): WebGLMock => {
  const ids = new Map<string, number>()
  const names = new Map<number, string>()
  const constant = (name: string): number => {
    let id = ids.get(name)
    if (id === undefined) {
      id = 0x8000 + ids.size
      ids.set(name, id)
      names.set(id, name)
    }
    return id
  }

  let lost = false
  const mock: WebGLMock = {
    context: null as unknown as WebGL2RenderingContext,
    drawCalls: 0,
    live: new Set(),
    subDataUploads: 0,
    isLost: () => lost,
    loseContext: () => {
      lost = true
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
    },
    restoreContext: () => {
      lost = false
      canvas.dispatchEvent(new Event('webglcontextrestored'))
    },
  }

  const create = (kind: string) => () => {
    const handle = { kind }
    mock.live.add(handle)
    return handle
  }
  const remove = (handle: object | null) => {
    if (handle) {
      mock.live.delete(handle)
    }
  }

  const loseExtension = { loseContext: () => mock.loseContext(), restoreContext: () => mock.restoreContext() }

  const functions: Record<string, (...args: any[]) => unknown> = {
    getParameter: (pname: number) => {
      const name = names.get(pname) ?? ''
      if (name === 'VIEWPORT' || name === 'SCISSOR_BOX') {
        return new Int32Array([0, 0, canvas.width, canvas.height])
      }
      if (name === 'ALIASED_POINT_SIZE_RANGE' || name === 'ALIASED_LINE_WIDTH_RANGE') {
        return new Float32Array([1, 1024])
      }
      return PARAMETERS[name] ?? 0
    },
    getExtension: (name: string) =>
      name === 'WEBGL_lose_context' ? loseExtension : name.startsWith('EXT_') || name.startsWith('OES_') ? {} : null,
    getSupportedExtensions: () => [],
    getContextAttributes: () => ({
      alpha: false,
      antialias: true,
      depth: true,
      stencil: false,
      premultipliedAlpha: true,
      preserveDrawingBuffer: false,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
    }),
    isContextLost: () => lost,
    getShaderPrecisionFormat: () => ({ rangeMin: 127, rangeMax: 127, precision: 23 }),
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    getProgramParameter: (_program: object, pname: number) => {
      const name = names.get(pname)
      return name === 'ACTIVE_UNIFORMS' || name === 'ACTIVE_ATTRIBUTES' ? 0 : true
    },
    getProgramInfoLog: () => '',
    getAttribLocation: () => -1,
    getUniformLocation: () => null,
    getError: () => 0,
    checkFramebufferStatus: () => constant('FRAMEBUFFER_COMPLETE'),
    createBuffer: create('buffer'),
    createTexture: create('texture'),
    createProgram: create('program'),
    createShader: create('shader'),
    createFramebuffer: create('framebuffer'),
    createRenderbuffer: create('renderbuffer'),
    createVertexArray: create('vertexArray'),
    deleteBuffer: remove,
    deleteTexture: remove,
    deleteProgram: remove,
    deleteShader: remove,
    deleteFramebuffer: remove,
    deleteRenderbuffer: remove,
    deleteVertexArray: remove,
    bufferSubData: () => {
      mock.subDataUploads++
    },
    drawArrays: () => {
      mock.drawCalls++
    },
    drawElements: () => {
      mock.drawCalls++
    },
    drawArraysInstanced: () => {
      mock.drawCalls++
    },
    drawElementsInstanced: () => {
      mock.drawCalls++
    },
  }

  const noop = () => undefined
  mock.context = new Proxy(
    { canvas, drawingBufferWidth: 300, drawingBufferHeight: 150 } as Record<string | symbol, unknown>,
    {
      get(target, key) {
        if (key in target) {
          return target[key]
        }
        if (typeof key !== 'string') {
          return undefined
        }
        if (/^[A-Z0-9_]+$/.test(key)) {
          return constant(key)
        }
        return functions[key] ?? noop
      },
    },
  ) as unknown as WebGL2RenderingContext

  return mock
}

/** Makes `canvas.getContext('webgl2')` return a mock for every canvas created after the call. */
export const installWebGLMock = (): { mocks: WebGLMock[]; restore: () => void } => {
  const original = HTMLCanvasElement.prototype.getContext
  const mocks: WebGLMock[] = []
  const contexts = new WeakMap<HTMLCanvasElement, WebGLMock>()
  HTMLCanvasElement.prototype.getContext = function getContext(this: HTMLCanvasElement, type: string) {
    if (type !== 'webgl2') {
      return null
    }
    let mock = contexts.get(this)
    if (!mock) {
      mock = createWebGLMock(this)
      contexts.set(this, mock)
      mocks.push(mock)
    }
    return mock.context
  } as typeof original
  return {
    mocks,
    restore: () => {
      HTMLCanvasElement.prototype.getContext = original
    },
  }
}
