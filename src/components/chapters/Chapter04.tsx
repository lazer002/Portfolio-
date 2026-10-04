'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { Capsule } from '@/components/three/parts'
import { DetailScatter, MachineBlock } from '@/components/three/parts'
import { PacketFlow } from '@/components/three/PacketFlow'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 04 — COMMERCE MACHINE — NICOBAR PLATFORM
 *
 * "Create a huge cyberpunk order-processing machine" containing a storefront
 * gateway, order core, inventory chamber, fulfilment rail, return chamber,
 * exchange chamber, gift-card vault, Shopify gateway, ERP gateway, Redis cache
 * and MongoDB vault.
 *
 * Scroll behaviour: "scrolling starts an order journey. The order packet enters
 * checkout, moves to order processing, splits into inventory and payment-style
 * internal routes, reaches fulfillment, and later branches into cancellation,
 * return, exchange, and settlement paths."
 *
 * Animation: "Each stage must have a different physical metaphor. Checkout is a
 * scanner gate. Fulfillment is a conveyor. Returns are reverse-moving packets.
 * Exchange is a packet that transforms. Gift cards are encrypted chips."
 *
 * Every metaphor below is a distinct mechanism rather than a differently
 * coloured box, because that distinction is the whole point of the chapter.
 */

interface Station {
  id: string
  label: string
  position: [number, number, number]
  size: [number, number, number]
}

const STATIONS: Station[] = [
  { id: 'storefront', label: 'STOREFRONT GATEWAY', position: [0, 0, 9], size: [2.4, 2.4, 2.4] },
  { id: 'checkout', label: 'CHECKOUT', position: [0, 0, 5.4], size: [3.2, 0.5, 0.5] },
  { id: 'order', label: 'ORDER CORE', position: [0, 0, 2.6], size: [2.2, 2.2, 2.2] },
  { id: 'inventory', label: 'INVENTORY', position: [-4.2, 1.4, 0.4], size: [1.8, 1.4, 1.8] },
  { id: 'payment', label: 'PAYMENT ROUTE', position: [4.2, 1.4, 0.4], size: [1.8, 1.4, 1.8] },
  { id: 'fulfillment', label: 'FULFILLMENT RAIL', position: [0, 0, -2.4], size: [4.6, 0.4, 0.4] },
  { id: 'cancellation', label: 'CANCELLATION', position: [-4.6, -1.8, -4.4], size: [1.6, 1.2, 1.6] },
  { id: 'returns', label: 'RETURNS', position: [0, -2.2, -5.4], size: [1.8, 1.4, 1.8] },
  { id: 'exchange', label: 'EXCHANGES', position: [4.6, -1.8, -4.4], size: [1.6, 1.2, 1.6] },
  { id: 'giftcard', label: 'GIFT CARDS', position: [0, 2.6, -3.2], size: [1.6, 0.5, 1.1] },
  { id: 'shopify', label: 'SHOPIFY', position: [-6.4, 2.6, 4], size: [1.2, 1.2, 1.2] },
  { id: 'erp', label: 'ERP', position: [6.4, 2.6, 4], size: [1.2, 1.2, 1.2] },
  { id: 'redis', label: 'REDIS', position: [6.4, -1.4, -1], size: [1.1, 1.1, 1.1] },
  { id: 'mongo', label: 'MONGODB', position: [-6.4, -1.4, -1], size: [1.4, 1.4, 1.4] },
]

/** The order lifecycle, as consecutive stations on one path. */
const HAPPY_PATH: [number, number, number][][] = [
  [
    [0, 0, 13],
    [0, 0, 9],
    [0, 0, 5.4],
    [0, 0, 2.6],
  ],
  [
    [0, 0, 2.6],
    [2.1, 0.7, 1.5],
    [4.2, 1.4, 0.4],
    [4.2, 0.6, -2.4],
  ],
  [
    [0, 0, 2.6],
    [-2.1, 0.7, 1.5],
    [-4.2, 1.4, 0.4],
    [-4.2, 0.6, -2.4],
  ],
]

const FULFILMENT_PATH: [number, number, number][] = [
  [0, 0, 2.6],
  [0, 0, -0.6],
  [0, 0, -2.4],
  [0, 0, -4],
]

/** Returns run backwards along the fulfilment rail — physically reversed. */
const RETURN_PATH: [number, number, number][] = [
  [0, 0, -4],
  [0, -0.9, -5.4],
  [0, -1.6, -3],
  [0, -0.8, 0.6],
]

export function Chapter04({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const gateRef = useRef<THREE.Group>(null)
  const conveyorRef = useRef<THREE.Group>(null)
  const chipRefs = useRef<(THREE.Group | null)[]>([])
  const scene = SCENES[index]

  const gateGeometry = useMemo(() => new THREE.TorusGeometry(1.9, 0.05, 6, 48, Math.PI), [])
  const gateMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('green'),
        toneMapped: false,
        transparent: true,
        opacity: 0.6,
      }),
    [],
  )
  const conveyorGeometry = useMemo(() => new THREE.CylinderGeometry(0.07, 0.07, 4.6, 8), [])
  const conveyorMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('green'),
        toneMapped: false,
        transparent: true,
        opacity: 0.4,
      }),
    [],
  )
  const chipGeometry = useMemo(() => new THREE.BoxGeometry(0.36, 0.06, 0.24), [])
  const chipMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('amber'),
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      gateGeometry.dispose()
      gateMaterial.dispose()
      conveyorGeometry.dispose()
      conveyorMaterial.dispose()
      chipGeometry.dispose()
      chipMaterial.dispose()
    }
  }, [gateGeometry, gateMaterial, conveyorGeometry, conveyorMaterial, chipGeometry, chipMaterial])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.25, local) * (1 - smoothWindow(local, 0.78, 1))
    group.visible = alive > 0.01

    // --- checkout: a scanner gate the packet passes through.
    const gate = gateRef.current
    if (gate) {
      const sweep = smoothWindow(local, 0.06, 0.2)
      gate.rotation.y = sweep * Math.PI
      gate.scale.setScalar(lerp(0.7, 1, ease.out(sweep)))
      gateMaterial.opacity = alive * (0.25 + sweep * 0.5)
    }

    // --- fulfillment: a conveyor. The slats roll; the packet rides them.
    const conveyor = conveyorRef.current
    if (conveyor) {
      const belt = ease.inOut(smoothWindow(local, 0.28, 0.5))
      conveyor.position.z = -2.4 + belt * 1.6
      conveyor.children.forEach((child, i) => {
        child.position.x = -2 + (((i * 0.4 + frame.time * 0.7) % 4.4))
        child.position.y = 0.28
      })
      conveyorMaterial.opacity = alive * 0.35
    }

    // --- gift cards: encrypted chips that only materialise once an order
    // reaches settlement, so they are not competing with the main journey.
    const chipWindow = smoothWindow(local, 0.55, 0.9)
    for (let i = 0; i < 5; i++) {
      const chip = chipRefs.current[i]
      if (!chip) continue
      chip.visible = alive > 0.01 && chipWindow > 0.02
      chip.position.set(
        Math.sin(frame.time * 0.6 + i) * 0.6,
        2.6 + Math.cos(frame.time * 0.8 + i * 1.3) * 0.18,
        -3.2 + Math.cos(frame.time * 0.5 + i) * 0.4,
      )
      chip.rotation.set(frame.time * 0.4 + i, frame.time * 0.6, 0)
      chipMaterial.opacity = alive * chipWindow * 0.8
    }
  })

  return (
    <group ref={root} position={scene.anchor}>
      {/* Surface detail so the machine reads as built, not blocked out. */}
      <DetailScatter position={[0, 0.5, 1]} count={44} extent={[12, 3, 14]} accent="green" seed={11} />

      {STATIONS.map((s, i) => (
        <group key={s.id} position={s.position}>
          <MachineBlock size={s.size} accent="green" trim={i < 4 ? 0.55 : 0.25} core={i < 4 ? 0.5 : 0.15} idle={0.03} seed={i} />
          <HoloLabel
            position={[0, s.size[1] * 0.5 + 0.55, 0]}
            accent={i < 4 ? 'green' : 'cyan'}
            variant="technical"
            distanceFactor={9}
          >
            {s.label}
          </HoloLabel>
        </group>
      ))}

      {/* Checkout scanner gate. */}
      <group ref={gateRef} position={[0, 0, 5.4]} rotation={[0, 0, Math.PI]}>
        <mesh geometry={gateGeometry} material={gateMaterial} />
      </group>

      {/* Fulfilment conveyor. */}
      <group ref={conveyorRef} position={[0, 0, -2.4]}>
        {Array.from({ length: 11 }, (_, i) => (
          <mesh key={i} geometry={conveyorGeometry} material={conveyorMaterial} rotation={[0, 0, Math.PI / 2]} />
        ))}
      </group>

      {/* Gift-card chips. */}
      {Array.from({ length: 5 }, (_, i) => (
        <group key={i} ref={(node) => { chipRefs.current[i] = node }}>
          <mesh geometry={chipGeometry} material={chipMaterial} />
        </group>
      ))}

      {/* The order journey. Each leg is a separate flow so the packet can be
          seen leaving one station and arriving at the next. */}
      <PacketFlow waypoints={HAPPY_PATH[0]} count={2} accent="green" chapter={index} travel={0.55} size={0.1} trail />
      <PacketFlow waypoints={HAPPY_PATH[1]} count={2} accent="cyan" chapter={index} travel={0.45} speed={1.1} size={0.09} />
      <PacketFlow waypoints={HAPPY_PATH[2]} count={2} accent="cyan" chapter={index} travel={0.45} speed={1.1} size={0.09} />
      <PacketFlow waypoints={FULFILMENT_PATH} count={3} accent="green" chapter={index} travel={0.5} size={0.1} />
      <PacketFlow
        waypoints={RETURN_PATH}
        count={2}
        accent="violet"
        chapter={index}
        travel={0.45}
        speed={-0.7}
        size={0.08}
        idle
      />
      {/* Settlement capsules. */}
      <Capsule position={[0, -2.2, -5.4]} accent="amber" scale={0.9} />
    </group>
  )
}