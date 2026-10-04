'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { dataParticleFragment, dataParticleVertex } from '@/shaders/dataParticles'
import { makeRng } from '@/lib/math'
import { frame } from '@/lib/store'
import { accentColor, type AccentName } from '@/components/three/materials'
import { densityScale, type Tier } from '@/lib/device'

/**
 * The global data-particle field.
 *
 * A single field spans the whole world rather than one per scene: lanes are
 * generated in world space and the camera travels through them, which is what
 * makes fourteen chapters feel like one continuous space instead of fourteen
 * stages. Positions are uploaded once — the vertex shader animates everything.
 *
 * context.txt: "Do not fill the entire viewport with uncontrolled particles."
 * These are controlled: fixed lanes, fixed speeds, distance-faded, and pointer
 * influence is local.
 */

interface DataParticlesProps {
  tier: Tier
  accent: AccentName
  /** Which accent lane-group to emphasise. */
  bias?: number
  /** World-space extent of the lane network. */
  span?: number
  seed?: number
}

export function DataParticles({ tier, accent, bias = 0, span = 760, seed = 1337 }: DataParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null)

  const count = useMemo(() => {
    // The previous budget put ~16,700 additively-blended, depth-write-off quads
    // in a field the camera flies through. Fill rate, not vertex count, was the
    // cost: every one of them is a full-screen-ish blend at the near end. This
    // is a corridor of data cabling, and it reads better sparser.
    const budget = tier === 'high' ? 9000 : tier === 'mid' ? 5200 : 2400
    return Math.floor(budget * densityScale(tier)) + 1200
  }, [tier])

  const geometry = useMemo(() => {
    const rng = makeRng(seed)
    const positions = new Float32Array(count * 3)
    const lanes = new Float32Array(count * 3)
    const seeds = new Float32Array(count)
    const speeds = new Float32Array(count)
    const scales = new Float32Array(count)

    // Lanes run along -Z in bundles, like cabling routed down a corridor.
    const bundles = 26
    for (let i = 0; i < count; i++) {
      const bundle = i % bundles
      const lane = rng()

      // Bundle lanes are spread across X and Y in a lattice that widens with
      // depth, so the field reads as infrastructure rather than a fog.
      const halfSpan = span * 0.5
      const z = -rng() * span
      const spread = 10 + (1 - -z / span) * 26

      const x = (bundle / (bundles - 1) - 0.5) * halfSpan * 0.8 + (rng() - 0.5) * 5.5
      const y = (lane - 0.5) * spread * 0.55 + (rng() - 0.5) * 1.6

      positions[i * 3] = x
      positions[i * 3 + 1] = y
      positions[i * 3 + 2] = z

      lanes[i * 3] = x
      lanes[i * 3 + 1] = rng()
      lanes[i * 3 + 2] = z

      seeds[i] = rng()
      speeds[i] = 0.08 + rng() * 0.22
      scales[i] = 0.45 + rng() * 1.1
    }

    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('aLane', new THREE.BufferAttribute(lanes, 3))
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1))
    g.setAttribute('aSpeed', new THREE.BufferAttribute(speeds, 1))
    g.setAttribute('aScale', new THREE.BufferAttribute(scales, 1))
    // The camera moves through the field, so a generous bounding sphere keeps
    // three from frustum-culling the whole thing away.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, -span * 0.5), span)
    return g
  }, [count, span, seed])

  const material = useMemo(() => {
    const a = accentColor(accent)
    const b = accentColor(accent === 'green' ? 'cyan' : 'green')
    return new THREE.ShaderMaterial({
      vertexShader: dataParticleVertex,
      fragmentShader: dataParticleFragment,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        // World units, not pixels — the vertex shader projects it properly.
        uSize: { value: 0.05 },
        uProjectionScale: { value: 1000 },
        uMaxPointSize: { value: 6 },
        uEnergy: { value: 1 },
        uSpread: { value: 1 },
        uPointer: { value: new THREE.Vector3(0, 0, 0) },
        uPointerStrength: { value: 0 },
        uColorA: { value: a.clone() },
        uColorB: { value: b.clone() },
        uOpacity: { value: 0.8 },
        uFogNear: { value: 18 },
        uFogFar: { value: 96 },
      },
    })
  }, [accent])

  // Accent transitions are a material property, so tween the colour in place
  // rather than rebuilding the material and dropping the buffer.
  useEffect(() => {
    const uniforms = material.uniforms
    const target = accentColor(accent)
    const from = uniforms.uColorA.value.clone()
    let raf = 0
    const start = performance.now()
    const step = () => {
      const t = Math.min(1, (performance.now() - start) / 900)
      uniforms.uColorA.value.lerpColors(from, target, t * t * (3 - 2 * t))
      if (t < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [accent, material])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  // Reusable objects so the frame loop never allocates.
  const pointerVec = useMemo(() => new THREE.Vector3(), [])
  const drawSize = useMemo(() => new THREE.Vector2(), [])

  useFrame((state, dt) => {
    const u = material.uniforms
    u.uTime.value = frame.time
    u.uEnergy.value = frame.energy
    u.uOpacity.value = 0.42 + frame.presence * 0.5

    // Real projection scale: drawing-buffer height over twice the tangent of the
    // half-FOV. This is what makes `uSize` mean world units and keeps chip size
    // stable when the canvas clamps DPR per tier or the window is resized.
    const camera = state.camera as THREE.PerspectiveCamera
    state.gl.getDrawingBufferSize(drawSize)
    u.uProjectionScale.value =
      drawSize.y / (2 * Math.tan(((camera.fov ?? 50) * Math.PI) / 360))

    // Pointer influence is expressed in world space and falls off fast, so a
    // hovered object bends its own particles and nothing else.
    const strength = frame.pointer.active && !frame.reducedMotion ? 1 : 0
    u.uPointerStrength.value = THREE.MathUtils.lerp(
      u.uPointerStrength.value as number,
      strength,
      1 - Math.exp(-4 * dt),
    )
    pointerVec.set(frame.pointer.dx * 9, frame.pointer.dy * 6, -7)
    ;(u.uPointer.value as THREE.Vector3).lerp(pointerVec, 1 - Math.exp(-6 * dt))

    if (pointsRef.current) {
      pointsRef.current.position.y = Math.sin(frame.time * 0.2) * 0.35 + bias * 0.1
    }
  })

  return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />
}