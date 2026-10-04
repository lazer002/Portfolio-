/**
 * Small maths helpers shared by the scroll timeline and every scene.
 *
 * Everything here is allocation-free and safe to call inside `useFrame`.
 */

export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v

export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v)

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp01((v - a) / (b - a))

/** Maps v from one range to another, clamped. */
export function mapRange(v: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
  return lerp(outMin, outMax, invLerp(inMin, inMax, v))
}

/**
 * Frame-rate independent exponential smoothing. `lambda` is roughly "how many
 * e-folds per second": higher converges faster. This is the damping used for
 * camera position so motion stays cinematic regardless of display refresh rate.
 */
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt))
}

/** Same damping, applied per component to a three-element vector in place. */
export function damp3(
  out: { x: number; y: number; z: number },
  tx: number,
  ty: number,
  tz: number,
  lambda: number,
  dt: number,
): void {
  const t = 1 - Math.exp(-lambda * dt)
  out.x += (tx - out.x) * t
  out.y += (ty - out.y) * t
  out.z += (tz - out.z) * t
}

/** Smoothstep, for entrances that should feel physical rather than linear. */
export function smoothstep(edge0: number, edge1: number, v: number): number {
  const t = clamp01((v - edge0) / (edge1 - edge0 || 1))
  return t * t * (3 - 2 * t)
}

/** Remap with smoothstep easing between two 0–1 window edges. */
export function smoothWindow(v: number, start: number, end: number, fade = 0.18): number {
  return smoothstep(start, start + fade, v) * (1 - smoothstep(end - fade, end, v))
}

/**
 * 0 → 1 → 0 across a scene's local progress. Used for anything that must be
 * strongest at the midpoint of a chapter, per the master timeline rule that
 * "when scene progress is 0.5 the scene is fully readable and interactive".
 */
export function bell(v: number, edge = 0.18): number {
  return smoothWindow(v, 0, 1, edge)
}

/**
 * Non-linear easing curves that read as machinery rather than animation
 * defaults. Named so scene code says what it means.
 */
export const ease = {
  /** Decelerating arrival — the default for camera moves. */
  out: (t: number) => 1 - Math.pow(1 - clamp01(t), 3),
  /** Symmetric heavy ease — GSAP's power3.inOut, for packet paths. */
  inOut: (t: number) => {
    const x = clamp01(t)
    return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2
  },
  /** Accelerating departure. */
  in: (t: number) => Math.pow(clamp01(t), 3),
  /** Slight overshoot, for mechanical components unlocking and relocking. */
  back: (t: number) => {
    const x = clamp01(t) - 1
    return 1 + 2.2 * x * x * x + 1.2 * x * x
  },
  /** Spring-ish settle, for modules returning to rest. */
  elastic: (t: number) => {
    const x = clamp01(t)
    if (x === 0 || x === 1) return x
    return Math.pow(2, -9 * x) * Math.sin((x * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1
  },
}

/** Deterministic hash-based noise. No Math.random anywhere in the render loop. */
export function hash(n: number): number {
  const s = Math.sin(n * 127.1) * 43758.5453123
  return s - Math.floor(s)
}

/** Deterministic 1D value noise, smooth and cheap. */
export function noise1(x: number): number {
  const i = Math.floor(x)
  const f = x - i
  const u = f * f * (3 - 2 * f)
  return lerp(hash(i), hash(i + 1), u) * 2 - 1
}

/** Deterministic 3D-ish pseudo-random in 0–1 from an integer seed. */
export function seeded(seed: number): number {
  return hash(seed * 1.618 + 0.37)
}

/**
 * Seeded generator for building stable geometry. Returns successive values in
 * 0–1 from an integer seed, so every reload produces the identical city.
 */
export function makeRng(seed: number): () => number {
  let s = seed >>> 0 || 1
  return () => {
    // xorshift32
    s ^= s << 13
    s >>>= 0
    s ^= s >> 17
    s ^= s << 5
    s >>>= 0
    return s / 4294967296
  }
}

/** Formats a 0–1 value as a fixed-width technical readout, e.g. "0.847". */
export function readout(v: number, digits = 3): string {
  return clamp01(v).toFixed(digits).padStart(digits + 2, '0')
}