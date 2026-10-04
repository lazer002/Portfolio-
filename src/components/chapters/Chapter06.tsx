'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { DataLink } from '@/components/three/DataLink'
import { Capsule, DetailScatter, HexCore, MachineBlock } from '@/components/three/parts'
import { PacketFlow } from '@/components/three/PacketFlow'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { clamp01, ease, lerp, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 06 — SHOPIFY NEXUS — API + WEBHOOKS
 *
 * "Create a giant cyberpunk commerce gateway with a central hexagonal API core.
 * REST requests use one visual path and GraphQL requests use another. Webhooks
 * enter from the outside as signed data capsules."
 *
 * Two separate paths is the chapter's whole argument — REST and GraphQL are not
 * the same wire wearing different labels — so they leave the core on distinct
 * routes in distinct colours and never merge.
 *
 * "Show rate-limit awareness as a traffic meter. When the virtual request rate
 * increases, the system automatically spaces requests instead of allowing
 * chaotic flooding." The meter below is the literal explanation: as demand
 * rises, the gap between packets widens.
 */

const REST_PATH: [number, number, number][][] = [
  [
    [0, 0, 0],
    [3.4, 1.2, 3.2],
    [5.6, 0.4, 6.6],
  ],
  [
    [0, 0, 0],
    [2.6, -1.4, 3.6],
    [5.4, -0.6, 7],
  ],
]

const GRAPHQL_PATH: [number, number, number][][] = [
  [
    [0, 0, 0],
    [-3.2, 1.6, 3.4],
    [-5.4, 0.6, 6.8],
  ],
]

/** Webhooks arrive from outside the system, above and behind. */
const WEBHOOK_PATH: [number, number, number][] = [
  [1.6, 9, -7],
  [0.8, 5.4, -4.4],
  [0, 2.6, -2.2],
  [0, 0.4, 0],
]

/** Resources moving through the gateway: product, inventory, order, gift card. */
const RESOURCES = ['PRODUCT', 'INVENTORY', 'ORDER', 'GIFT CARD']

export function Chapter06({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Group>(null)
  const verifyRef = useRef<THREE.Group>(null)
  const lockRef = useRef<THREE.Group>(null)
  const meterBars = useRef<(THREE.Mesh | null)[]>([])
  const scene = SCENES[index]

  const verifyGeometry = useMemo(() => new THREE.TorusGeometry(0.62, 0.05, 6, 36), [])
  const lockGeometry = useMemo(() => new THREE.TorusGeometry(0.52, 0.06, 6, 28), [])
  const meterGeometry = useMemo(() => new THREE.BoxGeometry(0.1, 1, 0.1), [])
  // One material per bar: the loop recolours each bar by demand level, and a
  // shared material would make every bar take the last bar's colour.
  const meterMaterials = useMemo(
    () =>
      Array.from(
        { length: 11 },
        () =>
          new THREE.MeshBasicMaterial({
            color: accentColor('cyan'),
            toneMapped: false,
            transparent: true,
            opacity: 0.6,
          }),
      ),
    [],
  )
  const lockMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('green'),
        toneMapped: false,
        transparent: true,
        opacity: 0.5,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      verifyGeometry.dispose()
      lockGeometry.dispose()
      meterGeometry.dispose()
      meterMaterials.forEach((m) => m.dispose())
      lockMaterial.dispose()
    }
  }, [verifyGeometry, lockGeometry, meterGeometry, meterMaterials, lockMaterial])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.26, local) * (1 - smoothWindow(local, 0.8, 1))
    group.visible = alive > 0.01

    // --- the gateway itself: it turns as the chapter closes, becoming one side
    // of the bridge in SCENE 07.
    const core = coreRef.current
    if (core) {
      const turn = ease.inOut(smoothWindow(local, 0.72, 1))
      core.rotation.y = turn * (Math.PI / 2)
      core.position.z = turn * 2.6
      core.scale.setScalar(lerp(1, 0.85, turn))
    }

    // --- signature verification: a gate the webhook capsule must pass through.
    const verify = verifyRef.current
    if (verify) {
      const check = smoothWindow(local, 0.12, 0.3)
      verify.rotation.y = frame.time * (0.4 + check * 2.2)
      lockMaterial.opacity = alive * (0.2 + check * 0.5)
    }

    // --- idempotency lock: closes after the handler has run, then releases.
    const lock = lockRef.current
    if (lock) {
      const engaged = smoothWindow(local, 0.3, 0.42) * (1 - smoothWindow(local, 0.58, 0.7))
      lock.scale.setScalar(lerp(1.35, 0.85, engaged))
      lock.rotation.x = Math.PI / 2 + engaged * 0.5
    }

    // --- traffic meter. Demand rises through the chapter; the client spaces
    // its requests rather than flooding, so the bars stagger outward.
    const demand = clamp01(smoothWindow(local, 0.08, 0.62))
    const spacing = lerp(1, 0.34, demand)
    for (let i = 0; i < meterBars.current.length; i++) {
      const bar = meterBars.current[i]
      if (!bar) continue
      const height = 0.18 + demand * (1.15 - i * 0.09)
      bar.scale.y = height
      bar.position.y = -1.6 + height / 2
      bar.position.x = (i - 5) * 0.42 * (1 + (1 - spacing) * 0.9)
      const material = meterMaterials[i]
      material.color.copy(accentColor(demand > 0.82 ? 'amber' : 'cyan')).multiplyScalar(0.6 + demand * 0.8)
      material.opacity = alive * (0.25 + demand * 0.5)
    }
  })

  return (
    <group ref={root} position={scene.anchor}>
      <DetailScatter position={[0, 0, 3]} count={36} extent={[14, 6, 10]} accent="cyan" seed={41} />

      {/* The gateway. */}
      <group ref={coreRef}>
        <HexCore position={[0, 0, 0]} radius={1.3} accent="cyan" spin={0.22} />
        <HoloLabel position={[0, 2.3, 0]} accent="cyan" variant="title" distanceFactor={10}>
          SHOPIFY ADMIN API
        </HoloLabel>
      </group>

      {/* REST leaves on one path... */}
      {REST_PATH.map((path, i) => (
        <PacketFlow key={`rest-${i}`} waypoints={path} count={2} accent="cyan" chapter={index} travel={1} size={0.08} trail />
      ))}
      <HoloLabel position={[6.2, -0.4, 7.2]} accent="cyan" variant="technical" distanceFactor={9}>
        REST
      </HoloLabel>

      {/* ...GraphQL on another. They never share a segment. */}
      {GRAPHQL_PATH.map((path, i) => (
        <PacketFlow key={`gql-${i}`} waypoints={path} count={2} accent="violet" chapter={index} travel={1} size={0.08} trail />
      ))}
      <HoloLabel position={[-6, 0.4, 7.4]} accent="violet" variant="technical" distanceFactor={9}>
        GRAPHQL
      </HoloLabel>

      {/* Webhooks enter from outside the system as signed capsules. */}
      <PacketFlow waypoints={WEBHOOK_PATH} count={2} accent="green" chapter={index} travel={0.9} size={0.09} trail />
      <group ref={verifyRef} position={[0, 2.6, -2.2]}>
        <mesh geometry={verifyGeometry} material={lockMaterial} rotation={[Math.PI / 2, 0, 0]} />
        <HoloLabel position={[0, 1.1, 0]} accent="green" variant="technical" distanceFactor={9}>
          SIGNATURE VERIFICATION
        </HoloLabel>
      </group>

      <group ref={lockRef} position={[0, 0.4, 0]}>
        <mesh geometry={lockGeometry} material={lockMaterial} rotation={[0, 0, 0]} />
        <HoloLabel position={[0, -1.2, 0]} accent="green" variant="technical" distanceFactor={9}>
          IDEMPOTENT HANDLER
        </HoloLabel>
      </group>

      {/* Traffic meter. */}
      <group position={[0, 0, -3.4]}>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh
            key={i}
            ref={(node) => { meterBars.current[i] = node }}
            geometry={meterGeometry}
            material={meterMaterials[i]}
            position={[(i - 5) * 0.42, -1.4, 0]}
          />
        ))}
        <HoloLabel position={[0, -2.3, 0]} accent="cyan" variant="technical" distanceFactor={9}>
          RATE-LIMIT AWARE
        </HoloLabel>
      </group>

      {/* Resources in flight. */}
      {RESOURCES.map((resource, i) => (
        <Capsule
          key={resource}
          position={[i % 2 === 0 ? 5.6 : -5.6, i < 2 ? 0.5 : -0.7, 7]}
          accent={i % 2 === 0 ? 'cyan' : 'violet'}
          scale={0.8}
        />
      ))}

      {/* Exit into the ERP bridge. */}
      <DataLink from={[0, 0.4, 0]} to={[0, 0.4, 5]} accent="violet" intensity={0.35} pulses={2} chapter={index} />
      <MachineBlock position={[0, -2.2, 2]} size={[2.4, 0.6, 2.4]} accent="cyan" trim={0.2} core={0.1} />
    </group>
  )
}