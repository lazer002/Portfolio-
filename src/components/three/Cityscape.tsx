'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { makeRng } from '@/lib/math'
import { frame } from '@/lib/store'
import { accentColor } from '@/components/three/materials'
import type { Tier } from '@/lib/device'

/**
 * The cyberpunk environment.
 *
 * context.txt: "Use architectural geometry rather than outer-space geometry.
 * Add distant buildings, conduits, cables, vents, panels and illuminated
 * signage as background silhouettes. Keep background details low-poly or
 * instanced to protect performance." And: "Do not create a dystopian city that
 * distracts from the portfolio content."
 *
 * So this is deliberately quiet. Everything is instanced, unlit or nearly so,
 * desaturated, and confined to the far edges of the corridor the camera
 * travels down. It gives depth and place without ever becoming the subject.
 *
 * Three draw calls for the entire background layer.
 */

const SPAN_Z = 800
const BEACONS = 26

interface CityscapeProps {
  tier: Tier
}

interface Building {
  x: number
  y: number
  z: number
  w: number
  h: number
  d: number
}

export function Cityscape({ tier }: CityscapeProps) {
  const buildingsRef = useRef<THREE.InstancedMesh>(null)
  const panelsRef = useRef<THREE.InstancedMesh>(null)
  const beaconsRef = useRef<THREE.InstancedMesh>(null)
  const groupRef = useRef<THREE.Group>(null)

  const budget = tier === 'high' ? 1 : tier === 'mid' ? 0.6 : 0.3

  const layout = useMemo(() => {
    const rng = makeRng(90210)
    const buildings: Building[] = []
    const panels: { x: number; y: number; z: number; w: number; h: number; rot: number }[] = []

    const rows = Math.floor(78 * budget) + 18
    for (let i = 0; i < rows; i++) {
      const side = i % 2 === 0 ? -1 : 1
      const z = -rng() * SPAN_Z
      const depth = -z / SPAN_Z
      // Push the silhouettes outward as they recede, so the corridor the
      // camera travels through stays clear.
      const x = side * (16 + depth * 26 + rng() * 16)
      const w = 2.6 + rng() * 6
      const h = 4 + rng() * 22 * (0.5 + depth * 0.8)
      const d = 2.6 + rng() * 7
      buildings.push({ x, y: h / 2 - 6, z, w, h, d })
    }

    const panelCount = Math.floor(52 * budget) + 12
    for (let i = 0; i < panelCount; i++) {
      panels.push({
        x: (rng() < 0.5 ? -1 : 1) * (11 + rng() * 9),
        y: -4 + rng() * 14,
        z: -rng() * SPAN_Z,
        w: 0.9 + rng() * 2.4,
        h: 0.5 + rng() * 2.2,
        rot: (rng() - 0.5) * 0.5,
      })
    }

    return { buildings, panels }
  }, [budget])

  const buildingGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const buildingMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.1092, 0.1344, 0.21),
        roughness: 0.86,
        metalness: 0.5,
      }),
    [],
  )

  const panelGeometry = useMemo(() => new THREE.PlaneGeometry(1, 1), [])
  const panelMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('cyan').multiplyScalar(0.22),
        toneMapped: false,
        transparent: true,
        opacity: 0.35,
        side: THREE.DoubleSide,
      }),
    [],
  )

  const beaconGeometry = useMemo(() => new THREE.SphereGeometry(0.09, 6, 6), [])
  const beaconMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('green'),
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  )

  // Deterministic layout, written to the instance buffers exactly once.
  useEffect(() => {
    const dummy = new THREE.Object3D()
    const buildings = buildingsRef.current
    if (buildings) {
      layout.buildings.forEach((b, i) => {
        dummy.position.set(b.x, b.y, b.z)
        dummy.scale.set(b.w, b.h, b.d)
        dummy.rotation.set(0, b.x > 0 ? 0.05 : -0.05, 0)
        dummy.updateMatrix()
        buildings.setMatrixAt(i, dummy.matrix)
      })
      buildings.instanceMatrix.needsUpdate = true
      buildings.computeBoundingSphere()
    }

    const panels = panelsRef.current
    if (panels) {
      layout.panels.forEach((p, i) => {
        dummy.position.set(p.x, p.y, p.z)
        dummy.scale.set(p.w, p.h, 1)
        dummy.rotation.set(0, p.rot, 0)
        dummy.updateMatrix()
        panels.setMatrixAt(i, dummy.matrix)
      })
      panels.instanceMatrix.needsUpdate = true
      panels.computeBoundingSphere()
    }

    const beacons = beaconsRef.current
    if (beacons) {
      const stride = Math.max(1, Math.floor(layout.buildings.length / BEACONS))
      const color = new THREE.Color()
      for (let i = 0; i < BEACONS; i++) {
        const b = layout.buildings[i * stride] ?? layout.buildings[0]
        dummy.position.set(b.x, b.y + b.h / 2 + 0.35, b.z)
        dummy.scale.setScalar(0.7 + (i % 3) * 0.4)
        dummy.rotation.set(0, 0, 0)
        dummy.updateMatrix()
        beacons.setMatrixAt(i, dummy.matrix)
        // Stagger the base brightness so they never blink in unison.
        beacons.setColorAt(i, color.setScalar(0.45 + (i % 4) * 0.18))
      }
      beacons.instanceMatrix.needsUpdate = true
      if (beacons.instanceColor) beacons.instanceColor.needsUpdate = true
    }
  }, [layout])

  useEffect(() => {
    return () => {
      buildingGeometry.dispose()
      buildingMaterial.dispose()
      panelGeometry.dispose()
      panelMaterial.dispose()
      beaconGeometry.dispose()
      beaconMaterial.dispose()
    }
  }, [buildingGeometry, buildingMaterial, panelGeometry, panelMaterial, beaconGeometry, beaconMaterial])

  useFrame(() => {
    if (beaconsRef.current) {
      // A soft irregular blink reads as infrastructure; a hard on/off reads as
      // a UI effect.
      const flicker = 0.5 + 0.5 * Math.abs(Math.sin(frame.time * 1.7))
      beaconMaterial.opacity = (0.3 + flicker * 0.55) * frame.presence
    }
    if (groupRef.current) {
      // Very slow vertical parallax — present enough to feel alive, far too
      // slow to notice as motion.
      groupRef.current.position.y = Math.sin(frame.time * 0.12) * 0.45
    }
  })

  return (
    <group ref={groupRef}>
      <instancedMesh
        ref={buildingsRef}
        args={[buildingGeometry, buildingMaterial, Math.max(1, layout.buildings.length)]}
        frustumCulled={false}
      />
      <instancedMesh
        ref={panelsRef}
        args={[panelGeometry, panelMaterial, Math.max(1, layout.panels.length)]}
        frustumCulled={false}
      />
      <instancedMesh ref={beaconsRef} args={[beaconGeometry, beaconMaterial, BEACONS]} frustumCulled={false} />
      <EnvironmentFloor />
    </group>
  )
}

/**
 * Wet reflective ground plane.
 *
 * context.txt asks for "wet reflective surfaces where appropriate" — a dark,
 * low-roughness plane that catches the accent light and gives the corridor a
 * floor without becoming a mirror showpiece.
 */
function EnvironmentFloor() {
  const geometry = useMemo(() => new THREE.PlaneGeometry(150, SPAN_Z + 160), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        // The floor is the largest surface in every frame. If it is not
        // genuinely dark it dominates the composition and, because it spans the
        // whole lower half of frame, it is also what pushes the image over the
        // bloom threshold. It stays a suggestion of a wet surface.
        color: new THREE.Color(0.016, 0.02, 0.03),
        // Wet, but not a mirror. At metalness 0.9 / roughness 0.22 the point
        // light struck a single blown-out specular streak straight down the
        // middle of every frame, which ACES then pushed from cyan to a yellow
        // blob. A rougher surface spreads the same light into a sheen.
        roughness: 0.46,
        metalness: 0.5,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return (
    <mesh geometry={geometry} material={material} rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, -SPAN_Z / 2]} />
  )
}