// GLSL 3 (WebGL2). three injects `position` and the matrices; fragment outputs are declared here.

const OUTPUT = 'out vec4 fragColor;'

const MORPH = /* glsl */ `
uniform float uMorph;
vec3 morphed(vec3 p3, vec2 p2) {
  return mix(vec3(p2.x, 0.0, p2.y), p3, uMorph);
}
`

const HIDDEN_POSITION = 'vec4(2.0, 2.0, 2.0, 1.0)'

export const systemsVertex = /* glsl */ `
${MORPH}
in vec2 position2d;
in vec3 aColor;
in float aSize;
in float aFlags;
uniform float uPixelRatio;
uniform float uSizeScale;
uniform int uHover;
out vec3 vColor;
out float vRing;
out float vCore;
out float vHover;

void main() {
  int flags = int(aFlags + 0.5);
  if ((flags & 1) != 0) {
    gl_Position = ${HIDDEN_POSITION};
    gl_PointSize = 0.0;
    return;
  }
  gl_Position = projectionMatrix * modelViewMatrix * vec4(morphed(position, position2d), 1.0);
  bool highlighted = (flags & 2) != 0;
  bool hovered = gl_VertexID == uHover;
  float core = aSize * uSizeScale;
  float size = (highlighted || hovered) ? core + 10.0 : core;
  vRing = (highlighted || hovered) ? 1.0 : 0.0;
  vHover = hovered && !highlighted ? 1.0 : 0.0;
  vCore = core / size;
  vColor = aColor;
  gl_PointSize = size * uPixelRatio;
}
`

export const systemsFragment = /* glsl */ `
${OUTPUT}
uniform vec3 uHighlight;
in vec3 vColor;
in float vRing;
in float vCore;
in float vHover;

void main() {
  float r = length(gl_PointCoord * 2.0 - 1.0);
  if (r > 1.0) discard;
  float aa = max(fwidth(r), 1e-4);
  vec3 color = vColor;
  float alpha = 1.0 - smoothstep(1.0 - aa * 1.5, 1.0, r);
  if (vRing > 0.5) {
    float core = 1.0 - smoothstep(vCore - aa, vCore, r);
    float inner = vCore + (1.0 - vCore) * 0.5;
    float ring = smoothstep(inner - aa, inner, r) * (1.0 - smoothstep(1.0 - aa, 1.0, r));
    ring *= vHover > 0.5 ? 0.6 : 1.0;
    color = mix(vColor, uHighlight, step(core, ring));
    alpha = max(core, ring);
  }
  if (alpha < 0.02) discard;
  fragColor = vec4(color, alpha);
}
`

export const gatesVertex = /* glsl */ `
${MORPH}
in vec2 position2d;
in float aKind;
uniform vec3 uGate;
uniform vec3 uGateRegional;
out vec3 vColor;
out float vHidden;

void main() {
  vHidden = aKind > 1.5 ? 1.0 : 0.0;
  vColor = aKind > 0.5 ? uGateRegional : uGate;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(morphed(position, position2d), 1.0);
}
`

export const gatesFragment = /* glsl */ `
${OUTPUT}
uniform float uOpacity;
in vec3 vColor;
in float vHidden;

void main() {
  if (vHidden > 0.5) discard;
  fragColor = vec4(vColor, uOpacity);
}
`

export const markersVertex = /* glsl */ `
${MORPH}
in vec2 position2d;
in vec3 aColor;
in float aSize;
in float aShape;
uniform float uPixelRatio;
out vec3 vColor;
flat out int vShape;

void main() {
  gl_Position = projectionMatrix * modelViewMatrix * vec4(morphed(position, position2d), 1.0);
  gl_PointSize = aSize * uPixelRatio;
  vColor = aColor;
  vShape = int(aShape + 0.5);
}
`

export const markersFragment = /* glsl */ `
${OUTPUT}
in vec3 vColor;
flat in int vShape;

void main() {
  vec2 p = gl_PointCoord * 2.0 - 1.0;
  float d;
  if (vShape == 1) {
    d = abs(length(p) - 0.75) - 0.2;
  } else if (vShape == 2) {
    d = max(abs(p.x), abs(p.y)) - 0.8;
  } else if (vShape == 3) {
    d = (abs(p.x) + abs(p.y)) - 0.95;
  } else if (vShape == 4) {
    // Upward triangle
    d = max(abs(p.x) * 0.866 + p.y * 0.5, -p.y) - 0.45;
  } else {
    d = length(p) - 0.9;
  }
  float aa = max(fwidth(d), 1e-4);
  float alpha = 1.0 - smoothstep(-aa, aa, d);
  if (alpha < 0.02) discard;
  fragColor = vec4(vColor, alpha);
}
`

export const pathVertex = /* glsl */ `
${MORPH}
in vec3 aStart;
in vec2 aStart2d;
in vec3 aEnd;
in vec2 aEnd2d;
uniform vec2 uViewport;
uniform float uWidth;

void main() {
  mat4 viewProjection = projectionMatrix * modelViewMatrix;
  vec4 a = viewProjection * vec4(morphed(aStart, aStart2d), 1.0);
  vec4 b = viewProjection * vec4(morphed(aEnd, aEnd2d), 1.0);
  if (a.w <= 0.0 || b.w <= 0.0) {
    gl_Position = ${HIDDEN_POSITION};
    return;
  }
  vec2 sa = a.xy / a.w * uViewport * 0.5;
  vec2 sb = b.xy / b.w * uViewport * 0.5;
  vec2 dir = sb - sa;
  float len = length(dir);
  dir = len > 1e-5 ? dir / len : vec2(1.0, 0.0);
  vec2 normal = vec2(-dir.y, dir.x);
  // position.x: 0 at start, 1 at end. position.y: side. Extend by half width for square caps.
  vec4 clip = mix(a, b, position.x);
  vec2 offset = normal * position.y * uWidth * 0.5 + dir * (position.x * 2.0 - 1.0) * uWidth * 0.5;
  clip.xy += offset / (uViewport * 0.5) * clip.w;
  gl_Position = clip;
}
`

export const pathFragment = /* glsl */ `
${OUTPUT}
uniform vec3 uColor;
uniform float uOpacity;

void main() {
  fragColor = vec4(uColor, uOpacity);
}
`

export const labelsVertex = /* glsl */ `
${MORPH}
in vec3 aAnchor;
in vec2 aAnchor2d;
in vec4 aRect;
in vec4 aUv;
in vec3 aColor;
in float aAlpha;
uniform vec2 uViewport;
out vec2 vUv;
out vec3 vColor;
out float vAlpha;

void main() {
  vec4 clip = projectionMatrix * modelViewMatrix * vec4(morphed(aAnchor, aAnchor2d), 1.0);
  // aRect: x, y offset from the anchor and w, h, CSS px, y down.
  vec2 offset = aRect.xy + position.xy * aRect.zw;
  clip.xy += vec2(offset.x, -offset.y) / (uViewport * 0.5) * clip.w;
  gl_Position = clip;
  vUv = mix(aUv.xy, aUv.zw, position.xy);
  vColor = aColor;
  vAlpha = aAlpha;
}
`

export const labelsFragment = /* glsl */ `
${OUTPUT}
uniform sampler2D uAtlas;
uniform vec3 uHalo;
in vec2 vUv;
in vec3 vColor;
in float vAlpha;

void main() {
  vec4 texel = texture(uAtlas, vUv);
  float alpha = texel.a * vAlpha;
  if (alpha < 0.02) discard;
  // Atlas glyphs are white fill over a black halo stroke.
  fragColor = vec4(mix(uHalo, vColor, texel.r), alpha);
}
`
