/* ============================================================================
 * Particle field shaders.
 *
 * Ported from the Awwwards Pack "Interactive Particles" component
 * (+17 Webgl _ ThreeJS Effects/9, orig. Bruno Imbrizi). Two changes:
 *   1. The `#pragma glslify: snoise2` dependency is inlined below as
 *      Ashima/Gustavson simplex noise — no build-time GLSL transform needed.
 *   2. The original rendered greyscale; we grade every particle across the
 *      amber/teal axis and flare it amber under the cursor.
 *
 * Written for THREE.ShaderMaterial, which injects `position`, `uv`,
 * `modelViewMatrix` and `projectionMatrix` for us.
 * ========================================================================== */

const SIMPLEX_2D = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

float snoise(vec2 v) {
  const vec4 C = vec4(
    0.211324865405187, 0.366025403784439,
   -0.577350269189626, 0.024390243902439
  );
  vec2 i  = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod289(i);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0))
                        + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(
    dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)
  ), 0.0);
  m = m * m; m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x  = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

export const particleVertex = /* glsl */ `
precision highp float;

attribute float pindex;
attribute vec3 offset;
attribute float angle;

uniform float uTime;
uniform float uRandom;
uniform float uDepth;
uniform float uSize;
uniform float uProgress;   // 0 = dispersed noise, 1 = fully formed
uniform vec2  uTextureSize;
uniform sampler2D uTexture;
uniform sampler2D uTouch;

varying vec2  vPUv;
varying vec2  vUv;
varying float vTouch;
varying float vGrey;
varying float vRand;

${SIMPLEX_2D}

float random(float n) {
  return fract(sin(n) * 43758.5453123);
}

void main() {
  vUv = uv;
  vRand = random(pindex);

  // Where this particle samples the source texture.
  vec2 puv = offset.xy / uTextureSize;
  vPUv = puv;

  vec4 colA = texture2D(uTexture, puv);
  float grey = colA.r * 0.21 + colA.g * 0.71 + colA.b * 0.07;
  vGrey = grey;

  // The offset attribute is in TEXTURE space: x is the column, y is the row
  // counted from the top of the canvas. World +Y is up, so the row must be
  // inverted or the whole field renders upside-down, which mirrors the
  // letterforms (an S becomes a backwards S). Both textures are uploaded
  // with flipY = false so the UV lookup above stays in top-down space.
  vec3 displaced = vec3(offset.x, uTextureSize.y - offset.y, offset.z);

  // uProgress drives the hero's "noise resolves into signal" entrance:
  // at 0 every particle is flung far from its target, at 1 it sits home.
  float scatter = mix(28.0, 1.0, uProgress);

  displaced.xy += vec2(
    random(pindex) - 0.5,
    random(offset.x + pindex) - 0.5
  ) * uRandom * scatter;

  float rndz = random(pindex) + snoise(vec2(pindex * 0.1, uTime * 0.1));
  displaced.z += rndz * (random(pindex) * 2.0 * uDepth) * scatter;

  // Re-centre the field on the origin.
  displaced.xy -= uTextureSize * 0.5;

  // Cursor push — read from the trail texture painted on the CPU side.
  float t = texture2D(uTouch, puv).r;
  vTouch = t;
  displaced.z += t * 20.0 * rndz;
  displaced.x += cos(angle) * t * 20.0 * rndz;
  displaced.y += sin(angle) * t * 20.0 * rndz;

  float psize = snoise(vec2(uTime, pindex) * 0.5) + 2.0;
  psize *= max(grey, 0.2);
  psize *= uSize;

  vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
  mvPosition.xyz += position * psize;
  gl_Position = projectionMatrix * mvPosition;
}
`;

export const particleFragment = /* glsl */ `
precision highp float;

uniform vec3  uColorA;   // amber — the warm key
uniform vec3  uColorB;   // teal  — the cool fill
uniform float uOpacity;

varying vec2  vPUv;
varying vec2  vUv;
varying float vTouch;
varying float vGrey;
varying float vRand;

void main() {
  // Soft round sprite, antialiased by smoothstep rather than a texture.
  float dist = 0.5 - distance(vUv, vec2(0.5));
  float alpha = smoothstep(0.0, 0.3, dist);
  if (alpha < 0.01) discard;

  // Grade across the amber/teal axis. Luminance alone is not enough here:
  // the source is pure white text, so vGrey is 1 for every particle and the
  // whole field collapses to flat amber. Dithering the mix per particle
  // keeps the cinema grade — mostly amber, with cooler sparks through it.
  float tone = clamp(vGrey * 1.4 - vRand * 0.5, 0.0, 1.0);
  vec3 color = mix(uColorB, uColorA, tone);
  color = mix(color, uColorA, clamp(vTouch * 1.5, 0.0, 1.0));
  color += vTouch * 0.35;

  // 0.62 keeps additive blending from saturating to flat white where the
  // letterforms are dense. At full alpha the glyph reads as a solid slab
  // instead of a particle field; this preserves a hot core with grain at
  // the edges, which is the whole point of the effect.
  gl_FragColor = vec4(color, alpha * uOpacity * max(vGrey, 0.35) * 0.62);
}
`;
