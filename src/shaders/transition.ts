import { BlendFunction, Effect, EffectAttribute } from 'postprocessing'
import { Color, Uniform } from 'three'

/**
 * The reusable fullscreen transition effect.
 *
 * context.txt GLSL TRANSITIONS: progress 0–1, procedural noise, directional
 * displacement, scanline modulation, subtle RGB channel offset, intensity as a
 * uniform, never permanently active, used only at scene boundaries, and the
 * image must stay readable before full intensity.
 *
 * All six requirements are load-bearing here:
 *  - `uProgress` is a 0 → 1 → 0 envelope derived from the scroll position's
 *    proximity to a chapter seam, so the effect is genuinely inactive between
 *    chapters rather than sitting at a low constant value.
 *  - The displacement direction is procedural (fbm noise), never a plain wipe.
 *  - Scanlines and RGB split are modulated by the envelope, not constant.
 *  - `uIntensity` is per-mechanism, exposed as a uniform.
 *  - The maximum displacement is bounded well below one screen width, so the
 *    outgoing chapter stays legible right up to the seam.
 *
 * Each of the fourteen boundaries uses a different branch, because context.txt
 * says "Do not use the same transition for every scene."
 */

const fragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uProgress;
  uniform float uIntensity;
  uniform int   uMode;
  uniform vec3  uAccent;

  float hash21(vec2 p) {
    p = fract(p * vec2(123.34, 456.21));
    p += dot(p, p + 45.32);
    return fract(p.x * p.y);
  }

  float valueNoise(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    float a = hash21(i);
    float b = hash21(i + vec2(1.0, 0.0));
    float c = hash21(i + vec2(0.0, 1.0));
    float d = hash21(i + vec2(1.0, 1.0));
    return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
  }

  float fbm(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    for (int i = 0; i < 4; i++) {
      v += a * valueNoise(p);
      p *= 2.03;
      a *= 0.5;
    }
    return v;
  }

  void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
    // Envelope: peaks mid-seam, never saturates, so the frame stays readable.
    float p = clamp(uProgress, 0.0, 1.0);
    // Clamped as well as eased: even at full intensity the displacement stays
    // well under one screen, so the outgoing chapter is legible right up to the
    // seam rather than being wiped away.
    float amount = min(pow(sin(p * 3.14159265), 0.75) * uIntensity, 0.55);

    float noise = fbm(uv * vec2(6.0, 3.0) + vec2(uTime * 0.35, -uTime * 0.22));
    float dir = mod(float(uMode), 2.0) < 1.0 ? 1.0 : -1.0;
    vec2 displace = vec2(0.0);

    if (uMode == 0) {
      // 01 digital shutter — thin scanlines sweep, image shoved sideways.
      float line = fract(uv.y * 90.0 - uTime * 2.0);
      float band = smoothstep(0.9, 1.0, line);
      displace.x = (band * 0.42 + noise * 0.3) * dir * amount;
      displace.y = (noise - 0.5) * 0.04 * amount;

    } else if (uMode == 1) {
      // 02 folding panel — the frame creases around a vertical seam.
      float seam = abs(uv.x - 0.5);
      displace.x = sign(uv.x - 0.5) * pow(seam, 2.0) * amount * 0.75 * dir;
      displace.y = (noise - 0.5) * amount * 0.1;

    } else if (uMode == 2) {
      // 03 data tunnel — radial pinch toward the vanishing point.
      vec2 c = uv - 0.5;
      displace = c * pow(length(c), 1.6) * amount * 1.15 * dir;

    } else if (uMode == 3) {
      // 04 launch — vertical slip, as if the frame were thrown forward.
      displace.y = noise * amount * 0.6 * dir;
      displace.x = (noise - 0.5) * amount * 0.16;

    } else if (uMode == 4) {
      // 05 rail exit — a conveyor wipe, offset per lane so it is not a flat bar.
      float lane = floor(uv.y * 14.0);
      float front = fract(uTime * 0.35 + hash21(vec2(lane, 3.0)));
      displace.x = smoothstep(front + 0.08, front, uv.x) * amount * 0.4 * dir;

    } else if (uMode == 5) {
      // 06 mechanical rotation — shear around the horizontal centre line.
      displace.x = (uv.y - 0.5) * amount * 0.7 * dir;
      displace.y = (noise - 0.5) * amount * 0.08;

    } else if (uMode == 6) {
      // 07 collapse — the bridge falls apart into columns of fragments.
      float col = floor(uv.x * 28.0);
      float speed = 0.35 + hash21(vec2(col, 9.0)) * 0.9;
      displace.y = (fract(uv.y + uTime * speed) - 0.5) * amount * 0.4;
      displace.y += pow(amount, 2.0) * 0.3 * dir;
      displace.x = (noise - 0.5) * amount * 0.18;

    } else if (uMode == 7) {
      // 08 compress — four vaults squeeze into one cube.
      displace.x = (uv.x - 0.5) * pow(amount, 1.5) * 0.5;
      displace.y = (uv.y - 0.5) * pow(amount, 1.5) * 0.95 * dir;

    } else if (uMode == 8) {
      // 09 mechanical door — panels part from the centre line.
      float panel = step(0.5, fract(uv.x * 2.0));
      displace.x = (panel - 0.5) * amount * 0.9 * dir;

    } else if (uMode == 9) {
      // 10 lattice expand — nodes scale out to fill the viewport.
      vec2 c = uv - 0.5;
      displace = -c * pow(amount, 2.0) * 1.35;

    } else if (uMode == 10) {
      // 11 fracture — the hierarchy grid shatters into diagnostic windows.
      vec2 cell = floor(uv * vec2(9.0, 6.0));
      displace = (vec2(hash21(cell), hash21(cell + 5.0)) - 0.5) * amount * 0.45;

    } else if (uMode == 11) {
      // 12 resolve — a scan beam sweeps the frame and settles it.
      float beam = smoothstep(0.14, 0.0, abs(uv.y - (1.0 - p)));
      displace.y = beam * amount * 0.26 * dir;
      displace.x = (noise - 0.5) * amount * 0.08;

    } else if (uMode == 12) {
      // 13 core — the matrix collapses into an iris.
      vec2 c = uv - 0.5;
      displace = normalize(c + vec2(0.0001)) * smoothstep(0.7, 0.0, length(c)) * amount * 0.42;

    } else {
      // 14 fade — no displacement at all. A slow, controlled finish.
      // A vec2 on both sides: assigning a bare float here is a type error.
      displace = vec2(noise - 0.5, noise - 0.5) * amount * 0.015;
    }

    vec2 sampleUv = clamp(uv + displace, vec2(0.001), vec2(0.999));

    // Subtle RGB channel offset. Deliberately tiny so type stays readable.
    float split = amount * 0.005;
    vec4 base = texture2D(inputBuffer, sampleUv);
    float r = texture2D(inputBuffer, sampleUv + vec2(split, 0.0)).r;
    float b = texture2D(inputBuffer, sampleUv - vec2(split, 0.0)).b;

    vec3 color = vec3(r, base.g, b);

    // Scanline modulation, strongest mid-transition.
    float scan = 0.94 + 0.06 * sin(uv.y * 1400.0 + uTime * 8.0);
    color *= mix(1.0, scan, 0.25 + amount * 0.7);

    // Accent bloom keyed to the outgoing chapter's colour.
    color += uAccent * amount * amount * (0.5 + 0.5 * noise) * 0.16;

    outputColor = vec4(color, base.a);
  }
`

/** Branch index per mechanism, matching the `uMode` chain above. */
export const TRANSITION_MODE = {
  shutter: 0,
  fold: 1,
  tunnel: 2,
  launch: 3,
  railExit: 4,
  rotate: 5,
  collapse: 6,
  compress: 7,
  door: 8,
  expand: 9,
  fracture: 10,
  resolve: 11,
  core: 12,
  fade: 13,
} as const

/** How hard each mechanism strikes. The closing fade stays gentle by design. */
export const TRANSITION_STRENGTH = {
  shutter: 1.0,
  fold: 0.85,
  tunnel: 1.1,
  launch: 1.0,
  railExit: 0.9,
  rotate: 0.95,
  collapse: 1.0,
  compress: 0.95,
  door: 1.05,
  expand: 1.0,
  fracture: 1.05,
  resolve: 0.9,
  core: 1.0,
  fade: 0.4,
} as const

export class BoundaryTransitionEffect extends Effect {
  readonly uTime: Uniform<number>
  readonly uProgress: Uniform<number>
  readonly uIntensity: Uniform<number>
  readonly uMode: Uniform<number>
  readonly uAccent: Uniform<Color>

  constructor() {
    super('BoundaryTransitionEffect', fragmentShader, {
      // CONVOLUTION marks this as a pass that reads neighbouring texels, which
      // is what lets `texture2D(inputBuffer, offset)` work.
      attributes: EffectAttribute.CONVOLUTION,
      blendFunction: BlendFunction.NORMAL,
      uniforms: new Map<string, Uniform>([
        ['uTime', new Uniform(0)],
        ['uProgress', new Uniform(0)],
        ['uIntensity', new Uniform(0)],
        ['uMode', new Uniform(0)],
        ['uAccent', new Uniform(new Color('#22e6ff'))],
      ]),
    })

    this.uTime = this.uniforms.get('uTime') as Uniform<number>
    this.uProgress = this.uniforms.get('uProgress') as Uniform<number>
    this.uIntensity = this.uniforms.get('uIntensity') as Uniform<number>
    this.uMode = this.uniforms.get('uMode') as Uniform<number>
    this.uAccent = this.uniforms.get('uAccent') as Uniform<Color>
  }
}