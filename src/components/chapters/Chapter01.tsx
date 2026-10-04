'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { SCENES } from '@/config/scenes'
import { Capsule } from '@/components/three/parts'
import { HoloLabel } from '@/components/three/HoloLabel'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, makeRng, smoothstep, smoothWindow } from '@/lib/math'
import { frame } from '@/lib/store'
import { engineer } from '@/config/content'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 01 — THE NEON CORE — HERO / IDENTITY
 *
 * "A large suspended cybernetic core made from a transparent glass-metal torus,
 * six rotating mechanical rings, inner luminous circuitry, and a small floating
 * identity glyph."
 *
 * Scroll behaviour, per the brief: the first movement rotates the core 25° on Y,
 * then 18° on X; continued scrolling brings it toward the camera, scales it
 * 1.0 → 1.45 and pushes it partially through the camera plane before it
 * dissolves.
 *
 * Cursor behaviour: pointer proximity rotates the nearest ring toward the
 * pointer, raises emissive intensity, and unlocks small mechanical components.
 * All of it is damped so the core feels like a machine with inertia rather than
 * a model snapping to the mouse.
 */

const RING_COUNT = 6

export function Chapter01({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const torusRef = useRef<THREE.Mesh>(null)
  const circuitryRef = useRef<THREE.Mesh>(null)
  const glyphRef = useRef<THREE.Group>(null)
  const ringsRef = useRef<THREE.Group>(null)
  const locksRef = useRef<THREE.InstancedMesh>(null)

  const scene = SCENES[index]

  /* ---------------- geometry and materials ---------------- */

  const torusGeometry = useMemo(() => new THREE.TorusGeometry(2.1, 0.26, 18, 96), [])
  const torusMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0.126, 0.21, 0.336),
        metalness: 1,
        roughness: 0.12,
        transmission: 0.42,
        thickness: 1.1,
        ior: 1.5,
        transparent: true,
        clearcoat: 1,
        clearcoatRoughness: 0.1,
      }),
    [],
  )

  // Inner luminous circuitry: a faceted core plus a set of radial filaments.
  const coreGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.78, 1), [])
  const coreMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('cyan').multiplyScalar(1.4),
        toneMapped: false,
        transparent: true,
        opacity: 0.55,
        wireframe: true,
      }),
    [],
  )
  const filamentGeometry = useMemo(() => new THREE.CylinderGeometry(0.014, 0.014, 1.5, 4), [])
  const filamentMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('cyan'),
        toneMapped: false,
        transparent: true,
        opacity: 0.4,
      }),
    [],
  )

  // Six mechanical rings. Geometry and material are shared instances; only the
  // transforms differ, so six rings cost one geometry upload.
  const ringGeometry = useMemo(() => new THREE.TorusGeometry(1, 0.03, 6, 72), [])
  const ringMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('cyan'), toneMapped: false, transparent: true, opacity: 0.5 }),
    [],
  )

  // The identity glyph: a small floating assembly, deliberately not text.
  const glyphGeometry = useMemo(() => new THREE.OctahedronGeometry(0.34, 0), [])
  const glyphMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('white'), toneMapped: false, transparent: true, opacity: 0.9 }),
    [],
  )

  // Mechanical locks that unlock and relock on pointer proximity.
  const lockGeometry = useMemo(() => new THREE.BoxGeometry(0.12, 0.3, 0.12), [])
  const lockMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: new THREE.Color(0.08, 0.1, 0.14), metalness: 0.95, roughness: 0.3 }),
    [],
  )

  const lockSeeds = useMemo(() => {
    const rng = makeRng(4242)
    return Array.from({ length: 16 }, () => ({
      angle: rng() * Math.PI * 2,
      y: (rng() - 0.5) * 3.2,
      radius: 2.1 + rng() * 0.35,
      phase: rng() * Math.PI * 2,
    }))
  }, [])

  useEffect(() => {
    return () => {
      torusGeometry.dispose()
      torusMaterial.dispose()
      coreGeometry.dispose()
      coreMaterial.dispose()
      filamentGeometry.dispose()
      filamentMaterial.dispose()
      ringGeometry.dispose()
      ringMaterial.dispose()
      glyphGeometry.dispose()
      glyphMaterial.dispose()
      lockGeometry.dispose()
      lockMaterial.dispose()
    }
  }, [
    torusGeometry,
    torusMaterial,
    coreGeometry,
    coreMaterial,
    filamentGeometry,
    filamentMaterial,
    ringGeometry,
    ringMaterial,
    glyphGeometry,
    glyphMaterial,
    lockGeometry,
    lockMaterial,
  ])

  /* ---------------- persistent scratch ---------------- */

  const scratch = useMemo(() => ({ dummy: new THREE.Object3D() }), [])

  /* ---------------- frame ---------------- */

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta)
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return

    // --- entrance: a deliberately composed start, not a fade from nothing.
    const enter = smoothstep(0, 0.35, local)
    const exit = 1 - smoothWindow(local, 0.72, 1)
    const alive = enter * exit

    // --- scroll-owned rotation. 25° on Y first, then 18° on X.
    const yRotation = ease.out(local / 0.42) * (Math.PI / 180) * 25
    const xRotation = ease.out(smoothWindow(local, 0.24, 0.72)) * (Math.PI / 180) * 18

    // --- approach and scale.
    //
    // The brief says the core moves toward the camera and "passes partially
    // through the camera plane" — but that is the EXIT, not the first half.
    // Ramp the approach over the last 45% only: an earlier ramp made the core
    // reach full travel by local 0.5, at which point it sits behind the camera
    // and the hero object vanishes before the visitor has finished reading it.
    const approach = ease.inOut(smoothWindow(local, 0.55, 1))
    const scale = lerp(1, 1.45, ease.out(approach))

    group.scale.setScalar(scale)
    group.position.set(
      scene.anchor[0],
      scene.anchor[1] + approach * 0.15,
      // Moving toward the camera means moving toward +Z relative to the anchor,
      // where the rig starts at z +9.5.
      scene.anchor[2] + approach * 6.2,
    )

    // --- idle rotation blends with scroll rotation rather than replacing it.
    const idleY = Math.sin(frame.time * 0.22) * 0.16
    const idleX = Math.cos(frame.time * 0.17) * 0.07
    // While scrolling, scroll owns the rotation and idle is suppressed; when the
    // visitor stops, idle eases back in.
    const idleWeight = smoothstep(0.35, 1.2, frame.sinceScroll) * (frame.reducedMotion ? 0.2 : 1)
    group.rotation.y = yRotation + idleY * idleWeight
    group.rotation.x = xRotation + idleX * idleWeight

    // --- dissolve: the core opens up and fades as it leaves.
    if (torusRef.current) {
      const material = torusRef.current.material as THREE.MeshPhysicalMaterial
      material.opacity = alive
      material.transmission = lerp(0.42, 0.85, approach)
    }
    if (coreMaterial) coreMaterial.opacity = 0.2 + alive * 0.5 * (0.6 + 0.4 * Math.sin(frame.time * 2.1))
    if (filamentMaterial) filamentMaterial.opacity = alive * 0.45

    // --- pointer reaction. Proximity, not a hover test, so it works on touch.
    const px = frame.pointer.dx
    const py = frame.pointer.dy
    const presence = frame.pointer.active && !frame.pointer.coarse ? 1 : 0

    // --- six mechanical rings. Each counter-rotates; the one nearest the
    // pointer's angular position turns toward it.
    const rings = ringsRef.current
    if (rings) {
      const pointerAngle = Math.atan2(py, px)
      rings.children.forEach((child, i) => {
        const ring = child as THREE.Mesh
        const baseAngle = (i / RING_COUNT) * Math.PI * 2
        // Angle of this ring, in the core's own frame.
        const ringAngle = baseAngle + group.rotation.y
        let deltaAngle = pointerAngle - ringAngle
        while (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2
        while (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2
        // Nearness is 1 when the ring points straight at the pointer.
        const nearness = presence * Math.max(0, Math.cos(deltaAngle)) ** 3

        const spin = (i % 2 === 0 ? 1 : -1) * (0.28 + i * 0.09)
        ring.rotation.y = frame.time * spin + group.rotation.y
        ring.rotation.z = i * 0.32 + frame.time * 0.1 * (i % 3 === 0 ? -1 : 1)
        // The nearest ring leans toward the pointer rather than snapping to it.
        ring.rotation.x = lerp(ring.rotation.x, nearness * 0.5, 1 - Math.exp(-5 * dt))
        ring.scale.setScalar(lerp(1, 1.14, nearness))
      })
      ringMaterial.opacity = alive * (0.35 + presence * 0.3)
    }

    // --- emissive intensity lifts with pointer energy.
    const boost = 1 + presence * 0.55
    if (torusRef.current) {
      const material = torusRef.current.material as THREE.MeshPhysicalMaterial
      material.emissive = accentColor('cyan')
      material.emissiveIntensity = 0.08 * boost * alive
    }

    // --- inner circuitry rotates against the core.
    if (coreMaterial) {
      if (circuitryRef.current) {
        circuitryRef.current.rotation.y = -frame.time * 0.35
        circuitryRef.current.rotation.x = Math.sin(frame.time * 0.3) * 0.2
      }
    }

    // --- identity glyph: floats above the core, always slightly alive.
    if (glyphRef.current) {
      glyphRef.current.position.y = 3.15 + Math.sin(frame.time * 0.9) * 0.12
      glyphRef.current.position.x = Math.sin(frame.time * 0.6) * 0.1
      glyphRef.current.rotation.y = frame.time * 0.6
      glyphRef.current.rotation.x = frame.time * 0.35
      glyphMaterial.opacity = alive * (0.6 + 0.4 * Math.sin(frame.time * 2.6))
      const glyphScale = lerp(0.7, 1, smoothWindow(local, 0.1, 0.5))
      glyphRef.current.scale.setScalar(glyphScale)
    }

    // --- mechanical locks unlock near the pointer and relock away from it.
    const locks = locksRef.current
    if (locks) {
      for (let i = 0; i < lockSeeds.length; i++) {
        const l = lockSeeds[i]
        // Convert the lock's angular position into a screen-ish coordinate.
        const lx = Math.cos(l.angle + group.rotation.y)
        const ly = Math.sin(l.angle + group.rotation.y) * 0.5
        const dist = Math.hypot(lx - px, ly - py)
        const unlock = smoothstep(0.95, 0.25, dist) * presence
        const wobble = Math.sin(frame.time * 3 + l.phase) * 0.5 + 0.5

        scratch.dummy.position.set(
          Math.cos(l.angle + group.rotation.y) * l.radius,
          l.y + Math.sin(frame.time * 1.4 + l.phase) * 0.05,
          Math.sin(l.angle + group.rotation.y) * l.radius,
        )
        scratch.dummy.rotation.set(0, l.angle + group.rotation.y, unlock * 0.8 * wobble)
        // Unlocking pushes the component outward along its own axis.
        scratch.dummy.scale.set(1, 1 + unlock * 0.6, 1)
        scratch.dummy.position.multiplyScalar(1 + unlock * 0.5)
        scratch.dummy.updateMatrix()
        locks.setMatrixAt(i, scratch.dummy.matrix)
      }
      locks.instanceMatrix.needsUpdate = true
      lockMaterial.emissive = accentColor('cyan')
      lockMaterial.emissiveIntensity = 0.5 + presence * 1.4
    }

    // Whole core fades toward the seam so the outgoing handoff is the next
    // scene's object, not a dissolve of this one.
    group.visible = alive > 0.01
  })

  /* ---------------- render ---------------- */

  const filamentPositions = useMemo(() => {
    const items: { pos: [number, number, number]; rot: [number, number, number] }[] = []
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2
      items.push({
        pos: [Math.cos(a) * 1.35, 0, Math.sin(a) * 1.35],
        rot: [0, -a, Math.PI / 2],
      })
    }
    return items
  }, [])

  return (
    <group ref={root}>
      <mesh ref={torusRef} geometry={torusGeometry} material={torusMaterial} rotation={[Math.PI / 2, 0, 0]} />

      {/* Inner luminous circuitry. */}
      <group ref={circuitryRef}>
        <mesh geometry={coreGeometry} material={coreMaterial} />
        {filamentPositions.map((f, i) => (
          <mesh key={i} geometry={filamentGeometry} material={filamentMaterial} position={f.pos} rotation={f.rot} />
        ))}
      </group>

      {/* Six rotating mechanical rings. */}
      <group ref={ringsRef}>
        {Array.from({ length: RING_COUNT }, (_, i) => (
          <mesh key={i} geometry={ringGeometry} material={ringMaterial} scale={0.72 + i * 0.11} />
        ))}
      </group>

      {/* Mechanical locks. */}
      <instancedMesh ref={locksRef} args={[lockGeometry, lockMaterial, lockSeeds.length]} frustumCulled={false} />

      {/* Identity glyph + its label. */}
      <group ref={glyphRef}>
        <mesh geometry={glyphGeometry} material={glyphMaterial} />
        <Capsule position={[0, -0.5, 0]} accent="cyan" scale={0.5} intensity={0.5} />
      </group>

      <HoloLabel position={[0, 3.9, 0]} accent="cyan" variant="technical" distanceFactor={12}>
        {engineer.name.toUpperCase()}
      </HoloLabel>
    </group>
  )
}