'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Bloom, ChromaticAberration, EffectComposer, Noise, Scanline, Vignette } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import { Vector2 } from 'three'

import { ACCENT, SCENES } from '@/config/scenes'
import { damp } from '@/lib/math'
import { frame } from '@/lib/store'
import { TRANSITION_MODE, TRANSITION_STRENGTH, BoundaryTransitionEffect } from '@/shaders/transition'
import { useBloom, type Tier } from '@/lib/device'

/**
 * The postprocessing stack.
 *
 * Two layers, deliberately separated:
 *
 *  1. A permanent, very restrained grade — bloom on active data, a whisper of
 *     chromatic aberration, film grain, scanlines and a vignette. This is the
 *     "subtle scanlines and grain over the final composition" from the brief,
 *     and it is what stops the render looking like a clean CG viewport.
 *  2. The boundary transition, which is inactive the vast majority of the
 *     session and only wakes up near a chapter seam.
 *
 * context.txt also asks to "map postprocessing intensity to progress" — the
 * transition's strength and the aberration offset both scale with the chapter's
 * own progress, so a scene's energy is expressed in the grade as well as in the
 * geometry.
 */

interface PostProps {
  tier: Tier
}

export function Post({ tier }: PostProps) {
  const effect = useMemo(() => new BoundaryTransitionEffect(), [])
  const aberration = useMemo(() => new Vector2(0.00035, 0.0005), [])
  const smoothedBoundary = useRef(0)

  // The effect is owned by this component and disposed with it, so unmounting
  // the canvas cannot leak a shader program.
  useEffect(() => {
    return () => {
      effect.dispose()
    }
  }, [effect])

  useFrame((_, dt) => {
    const d = Math.min(0.05, dt)

    // Damped rather than snapped, so a fast scroll cannot produce a strobe.
    smoothedBoundary.current = damp(smoothedBoundary.current, frame.boundary, 14, d)

    // The mechanism belongs to the chapter being left, so the transition reads
    // as a consequence of the scene you just finished.
    const scene = SCENES[frame.chapter]

    effect.uTime.value = frame.time
    effect.uProgress.value = smoothedBoundary.current
    effect.uMode.value = TRANSITION_MODE[scene.transition] ?? 0
    effect.uAccent.value.set(ACCENT[scene.accent])

    const energy = frame.reducedMotion ? 0.4 : 0.55 + frame.local * 0.45
    // `uIntensity` carries both how hard this mechanism strikes and how close we
    // are to the seam, so the two cannot compound into a screen-wide tear.
    effect.uIntensity.value =
      (TRANSITION_STRENGTH[scene.transition] ?? 1) * (0.6 + energy * 0.4) * smoothedBoundary.current

    aberration.set(
      0.0003 + frame.local * 0.00035 + smoothedBoundary.current * 0.0018,
      0.00045 + frame.local * 0.0004 + smoothedBoundary.current * 0.0022,
    )
  })

  const bloomOn = useBloom(tier)

  // EffectComposer collects effects from its direct children, so the children
  // have to be real elements — no conditional nulls.
  const effects = [
    // Raw primitive rather than wrapEffect: the instance is driven directly
    // from the shared frame store, so it needs no React re-render.
    <primitive key="transition" object={effect} dispose={null} />,
    ...(bloomOn
      ? [
          <Bloom
            key="bloom"
            intensity={0.7}
            // High enough that only genuinely emissive surfaces bloom. At a low
            // threshold every lit surface does, which turns the whole frame into
            // a soft glow and destroys the "glow is reserved" rule.
            luminanceThreshold={0.62}
            luminanceSmoothing={0.28}
            mipmapBlur
            radius={0.7}
          />,
        ]
      : []),
    <ChromaticAberration
      key="aberration"
      blendFunction={BlendFunction.NORMAL}
      offset={aberration}
      radialModulation
      modulationOffset={0.35}
    />,
    <Scanline key="scanline" blendFunction={BlendFunction.OVERLAY} density={1.15} opacity={0.16} />,
    <Noise key="noise" premultiply blendFunction={BlendFunction.OVERLAY} opacity={0.13} />,
    <Vignette key="vignette" offset={0.24} darkness={0.78} />,
  ]

  return (
    <EffectComposer enableNormalPass={false} multisampling={0}>
      {effects}
    </EffectComposer>
  )
}