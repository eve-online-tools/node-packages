export class WebGLUnavailableError extends Error {
  override name = 'WebGLUnavailableError'

  constructor(message = 'WebGL 2 is not available.', options?: { cause?: unknown }) {
    super(message, options)
  }
}

/** Probes for WebGL 2 on a throwaway canvas and releases the context again. Safe to call during SSR. */
export const isWebGL2Available = (): boolean => {
  if (typeof document === 'undefined' || typeof WebGL2RenderingContext === 'undefined') {
    return false
  }
  try {
    const gl = document.createElement('canvas').getContext('webgl2')
    if (!gl) {
      return false
    }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return true
  } catch {
    return false
  }
}
