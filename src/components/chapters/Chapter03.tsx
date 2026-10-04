'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { PacketFlow } from '@/components/three/PacketFlow'
import { GridFloor, ServiceTower } from '@/components/three/parts'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, makeRng, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 03 — MICROSERVICE CITY — ARCHITECTURE
 *
 * "Build a futuristic miniature city where each tower represents a service.
 * Towers are black glass with translucent interiors."
 *
 * Scroll behaviour: "the camera starts above the city, descends between service
 * towers, then travels horizontally through the internal network" — which is
 * why the camera keys for this chapter climb from y=11 down to y=1.6 while
 * moving 25 units down the corridor.
 *
 * Requests are packets on curved paths from the API gateway out to the
 * services and on to cache, database and queue nodes. `PacketFlow` already
 * does the Catmull-Rom + power3.inOut work the brief asks for.
 */

/** Towers are generated deterministically: the same city every reload. */
const TOWERS = (() => {
  const rng = makeRng(31337)
  const items: { x: number; z: number; h: number; label: string; load: number }[] = []
  const labels = ['API', 'AUTH', 'ORDERS', 'USERS', 'PAYMENT', 'CATALOG', 'QUEUE', 'WORKER', 'CACHE', 'GRAPHQL']
  const rows = 7
  for (let row = 0; row < rows; row++) {
    for (let side = -1; side <= 1; side += 2) {
      const count = 2 + Math.floor(rng() * 2)
      for (let c = 0; c < count; c++) {
        const z = 12 - row * 5.5 - rng() * 2.5
        const x = side * (3.6 + rng() * 7.5)
        items.push({
          x,
          z,
          h: 2.6 + rng() * 6.5,
          label: labels[(items.length + row) % labels.length],
          load: 0.2 + rng() * 0.7,
        })
      }
    }
  }
  return items
})()

/** Network paths: gateway → service → downstream node. */
const ROUTES: [number, number, number][][] = [
  [
    [0, 5.5, 14],
    [2.6, 4.4, 9],
    [5.4, 3.4, 4.5],
  ],
  [
    [0, 5.5, 14],
    [-2.4, 4.6, 8.5],
    [-5.8, 3.2, 3.5],
  ],
  [
    [0, 5.5, 14],
    [1.2, 3.4, 7],
    [6.2, 2.2, -1],
  ],
  [
    [0, 5.5, 14],
    [-1.6, 3.2, 6.5],
    [-6.4, 2.4, -2],
  ],
  [
    [5.4, 3.4, 4.5],
    [4.2, 2.6, 0.5],
    [3.4, 2.0, -4],
  ],
  [
    [-5.8, 3.2, 3.5],
    [-4.4, 2.4, -0.5],
    [-3.6, 1.8, -5],
  ],
]

export function Chapter03({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const gatewayRef = useRef<THREE.Mesh>(null)
  const groundRef = useRef<THREE.Group>(null)
  const scene = SCENES[index]

  const gatewayGeometry = useMemo(() => new THREE.OctahedronGeometry(0.7, 0), [])
  const gatewayMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('green'),
        toneMapped: false,
        transparent: true,
        opacity: 0.85,
      }),
    [],
  )
  const gatewayHaloGeometry = useMemo(() => new THREE.TorusGeometry(1.15, 0.02, 6, 64), [])
  const gatewayHaloMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('green'),
        toneMapped: false,
        transparent: true,
        opacity: 0.4,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      gatewayGeometry.dispose()
      gatewayMaterial.dispose()
      gatewayHaloGeometry.dispose()
      gatewayHaloMaterial.dispose()
    }
  }, [gatewayGeometry, gatewayMaterial, gatewayHaloGeometry, gatewayHaloMaterial])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.28, local) * (1 - smoothWindow(local, 0.76, 1))
    group.visible = alive > 0.01

    // The gateway is where every request originates, so it leads the eye.
    const gateway = gatewayRef.current
    if (gateway) {
      gateway.rotation.y = frame.time * 0.5
      gateway.rotation.x = frame.time * 0.25
      gatewayMaterial.opacity = alive * 0.85
      gatewayHaloMaterial.opacity = alive * (0.25 + 0.2 * Math.sin(frame.time * 2))
      gateway.scale.setScalar(lerp(0.85, 1, ease.out(smoothstep(0, 0.35, local))))
    }

    // The grid sinks as the camera descends into the city, so the architecture
    // never has to move — only the viewpoint does.
    if (groundRef.current) {
      groundRef.current.position.y = -ease.inOut(local) * 1.6
    }
  })

  return (
    <group ref={root} position={scene.anchor}>
      <group ref={groundRef}>
        <GridFloor position={[0, -1.2, 2]} size={52} divisions={26} accent="green" opacity={0.13} />
      </group>

      {/* Service towers. */}
      {TOWERS.map((t, i) => (
        <group key={i} position={[t.x, -1.2, t.z]}>
          <ServiceTower
            position={[0, 0, 0]}
            height={t.h}
            width={1.1 + (i % 3) * 0.25}
            accent="green"
            load={t.load}
            seed={i * 0.7}
          />
          {/* Service names appear as tiny holographic labels, never flat cards. */}
          <HoloLabel position={[0, t.h + 0.55, 0]} accent="green" variant="technical" distanceFactor={9}>
            {t.label}
          </HoloLabel>
        </group>
      ))}

      {/* The API gateway the packets originate from. */}
      <group position={[0, 5.5, 14]}>
        <mesh ref={gatewayRef} geometry={gatewayGeometry} material={gatewayMaterial} />
        <mesh geometry={gatewayHaloGeometry} material={gatewayHaloMaterial} rotation={[Math.PI / 2, 0, 0]} />
        <HoloLabel position={[0, 1.5, 0]} accent="cyan" variant="title" distanceFactor={10}>
          API GATEWAY
        </HoloLabel>
      </group>

      {/* Curved request paths. Progress is this chapter's own scroll interval. */}
      {ROUTES.map((route, i) => (
        <PacketFlow
          key={i}
          waypoints={route}
          count={3}
          spacing={0.16}
          accent={i % 3 === 0 ? 'cyan' : 'green'}
          chapter={index}
          travel={0.9}
          speed={1}
          size={0.075}
          trail
        />
      ))}
    </group>
  )
}