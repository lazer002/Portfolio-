/**
 * Capability detection.
 *
 * context.txt RESPONSIVE RULES: "Desktop receives the full cinematic
 * experience. Tablet reduces particle count and depth complexity. Mobile keeps
 * the storytelling but simplifies expensive effects." So this is a tier, not a
 * boolean — and everything expensive in the build reads its budget from here.
 */

export type Tier = 'high' | 'mid' | 'low'

export interface Capabilities {
  tier: Tier
  /** Pointer precision. False means scenes substitute touch behaviour. */
  finePointer: boolean
  /** Respect prefers-reduced-motion for camera and particle motion. */
  reducedMotion: boolean
  /** Hardware concurrency, used only as a weak signal alongside width. */
  cores: number
  /** Device pixel ratio ceiling for the canvas. */
  maxPixelRatio: number
  /** Data-particle budget. */
  particles: number
  /** True when the WebGL layer should be skipped entirely. */
  fallback: boolean
}

const TABLE: Record<Tier, Omit<Capabilities, 'tier' | 'finePointer' | 'reducedMotion' | 'cores'>> = {
  high: { maxPixelRatio: 2, particles: 26000, fallback: false },
  mid: { maxPixelRatio: 1.5, particles: 11000, fallback: false },
  low: { maxPixelRatio: 1, particles: 3600, fallback: true },
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Detect once on the client. Deliberately conservative: the low tier skips
 * WebGL rather than shipping a slideshow, because context.txt asks for the
 * storytelling to survive everywhere.
 */
export function detectCapabilities(): Capabilities {
  if (typeof window === 'undefined') {
    return { tier: 'mid', finePointer: false, reducedMotion: false, cores: 4, ...TABLE.mid }
  }

  const width = window.innerWidth
  const cores = navigator.hardwareConcurrency ?? 4
  const finePointer = window.matchMedia('(pointer: fine)').matches
  const reducedMotion = prefersReducedMotion()

  // WebGL availability decides whether we can attempt the 3D layer at all.
  let hasWebGL = false
  try {
    const canvas = document.createElement('canvas')
    hasWebGL = Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl')),
    )
  } catch {
    hasWebGL = false
  }

  let tier: Tier = 'high'
  if (!hasWebGL || width < 640 || cores <= 4) tier = 'low'
  else if (width < 1024 || cores <= 6) tier = 'mid'

  return { tier, finePointer, reducedMotion, cores, ...TABLE[tier] }
}

/** Multiplier for object counts, so scenes can budget against the tier. */
export function densityScale(tier: Tier): number {
  return tier === 'high' ? 1 : tier === 'mid' ? 0.55 : 0.25
}

/** Whether postprocessing bloom is affordable at all. */
export function useBloom(tier: Tier): boolean {
  return tier !== 'low'
}