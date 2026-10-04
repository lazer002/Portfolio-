'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { DataLink } from '@/components/three/DataLink'
import { Capsule, DetailScatter, Rail } from '@/components/three/parts'
import { PacketFlow } from '@/components/three/PacketFlow'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 05 — EVENT RAIL — AWS SQS / RETRIES / DLQ
 *
 * "Build multiple transparent cyberpunk queue rails. Each rail is a physical
 * tunnel containing moving event capsules. Use different rail colors only for
 * meaning: primary events, retries, and failures."
 *
 * That constraint — colour only where it carries meaning — is why this is the
 * one chapter with three distinct accents and everything else in violet
 * structure.
 *
 * Scroll behaviour: the first scroll sends an event through the FIFO rail; a
 * duplicate appears and is rejected by a deduplication gate; a failed event
 * enters a delay chamber, waits, then retries; a repeatedly failing event moves
 * into the dead-letter chamber.
 *
 * "Backoff must be represented physically: every retry takes longer and the
 * capsule travels through a larger loop before returning to the main rail." The
 * retry rails below grow in radius and length with each attempt, which is the
 * physical backoff the brief asks for.
 */

/** The main FIFO rail, left to right. */
const MAIN_RAIL: [number, number, number][] = [
  [-11, 2.4, 0],
  [-6, 2.4, 0],
  [0, 2.4, 0],
  [6, 2.4, 0],
  [11, 2.4, 0],
]

/** Duplicate event: joins behind the first, then meets the dedup gate. */
const DUPLICATE_RAIL: [number, number, number][] = [
  [-11, 1.1, -2.2],
  [-7, 1.3, -1.6],
  [-4.6, 1.8, -0.6],
  [-3.2, 2.4, 0],
]

/** Retry 1 — the shortest backoff loop. */
const RETRY_1: [number, number, number][] = [
  [0.5, 2.4, 0],
  [1.4, 0.6, -1.4],
  [3.2, -0.2, -1.8],
  [4.4, 0.6, -1.2],
  [5.2, 2.4, 0],
]

/** Retry 2 — a visibly larger loop. Backoff, made physical. */
const RETRY_2: [number, number, number][] = [
  [0.5, 2.4, 0],
  [0.4, -1.2, -3.2],
  [2.4, -2.4, -4.6],
  [5.2, -2.2, -4.2],
  [6.6, -0.6, -2.4],
  [7, 1.6, -0.8],
  [7.2, 2.4, 0],
]

/** Dead letter: the event falls out of the system entirely. */
const DLQ_RAIL: [number, number, number][] = [
  [4, 2.4, 0],
  [4.6, 0.2, 1.6],
  [5.6, -2.6, 3.2],
  [7.4, -4.4, 4.6],
]

export function Chapter05({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const dedupRef = useRef<THREE.Group>(null)
  const delayRef = useRef<THREE.Group>(null)
  const dlqRef = useRef<THREE.Group>(null)
  const scene = SCENES[index]

  const gateGeometry = useMemo(() => new THREE.TorusGeometry(0.72, 0.07, 8, 32), [])
  const gateMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('amber'),
        toneMapped: false,
        transparent: true,
        opacity: 0.5,
      }),
    [],
  )
  const lockGeometry = useMemo(() => new THREE.BoxGeometry(0.9, 0.16, 0.9), [])
  const lockMaterials = useMemo(
    () =>
      [
        ['amber', 0.4],
        ['violet', 0.4],
        ['red', 0.35],
      ].map(
        ([name, base]) =>
          new THREE.MeshBasicMaterial({
            color: accentColor(name as 'amber' | 'violet' | 'red'),
            toneMapped: false,
            transparent: true,
            opacity: base as number,
          }),
      ),
    [],
  )
  const lockGroupRef = useRef<THREE.Group>(null)
  const shutterTop = useRef<THREE.Mesh>(null)
  const shutterBottom = useRef<THREE.Mesh>(null)

  useEffect(() => {
    return () => {
      gateGeometry.dispose()
      gateMaterial.dispose()
      lockGeometry.dispose()
      lockMaterials.forEach((m) => m.dispose())
    }
  }, [gateGeometry, gateMaterial, lockGeometry, lockMaterials])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.24, local) * (1 - smoothWindow(local, 0.8, 1))
    group.visible = alive > 0.01

    // --- deduplication gate. Closes on the duplicate as it arrives, which is
    // the whole explanation of deduplication in one gesture.
    const dedup = dedupRef.current
    if (dedup) {
      const approach = smoothWindow(local, 0.1, 0.3)
      // Two shutters that meet in the middle, closing on the duplicate as it
      // arrives. That single gesture is the whole explanation of deduplication.
      const closed = approach * 0.9
      if (shutterTop.current) shutterTop.current.position.y = 0.36 + closed * 0.3
      if (shutterBottom.current) shutterBottom.current.position.y = -0.36 - closed * 0.3
      gateMaterial.opacity = alive * (0.25 + approach * 0.55)
      dedup.rotation.z = frame.time * 0.4
    }

    // --- delay chamber. The waiting period is literal: the capsule stops.
    const delay = delayRef.current
    if (delay) {
      const waiting = smoothWindow(local, 0.32, 0.46) * (1 - smoothWindow(local, 0.52, 0.62))
      delay.scale.setScalar(lerp(0.85, 1.15, waiting))
      delay.rotation.y = frame.time * 0.5 * (0.2 + waiting)
      lockMaterials[0].opacity = alive * (0.2 + waiting * 0.6)
    }

    // --- retry ladder: each gate opens a little later than the last.
    const locks = lockGroupRef.current
    if (locks) {
      for (let i = 0; i < lockMaterials.length; i++) {
        const mesh = locks.children[i] as THREE.Mesh
        if (!mesh) continue
        const open = smoothWindow(local, 0.42 + i * 0.09, 0.56 + i * 0.09)
        mesh.rotation.y = open * (Math.PI / 2) + frame.time * 0.2
        mesh.position.y = open * 0.4
        lockMaterials[i].opacity = alive * (0.12 + open * 0.5)
      }
    }

    // --- dead-letter chamber. Only lights up once the event has failed enough
    // times, so it never looks like an ordinary destination.
    const dlq = dlqRef.current
    if (dlq) {
      const dead = smoothWindow(local, 0.62, 0.82)
      dlq.rotation.x = frame.time * 0.25
      lockMaterials[2].opacity = alive * (0.12 + dead * 0.75)
      dlq.scale.setScalar(lerp(0.7, 1.1, ease.out(dead)))
    }
  })

  return (
    <group ref={root} position={scene.anchor}>
      <DetailScatter position={[0, 0, 0]} count={30} extent={[26, 6, 8]} accent="violet" seed={23} />

      {/* The main FIFO rail. */}
      <Rail position={[0, 2.4, 0]} length={24} radius={0.62} accent="violet" rotation={[0, 0, Math.PI / 2]} />
      <HoloLabel position={[-11, 3.6, 0]} accent="cyan" variant="title" distanceFactor={9}>
        FIFO QUEUE
      </HoloLabel>
      <HoloLabel position={[11, 3.6, 0]} accent="green" variant="technical" distanceFactor={9}>
        ORDERED DELIVERY
      </HoloLabel>

      {/* Retry rails grow larger with each attempt — the physical backoff. */}
      <Rail position={[2.6, -0.4, -1.8]} length={5.4} radius={0.32} accent="amber" rotation={[Math.PI / 2, 0.6, 0]} segments={10} />
      <Rail position={[3.8, -2, -4.2]} length={7.6} radius={0.4} accent="amber" rotation={[Math.PI / 2, -0.5, 0]} segments={12} />

      {/* Event capsules. */}
      <PacketFlow waypoints={MAIN_RAIL} count={5} spacing={0.13} accent="cyan" chapter={index} travel={1} size={0.085} trail />
      <PacketFlow waypoints={DUPLICATE_RAIL} count={1} accent="amber" chapter={index} travel={0.85} size={0.085} />
      <PacketFlow waypoints={RETRY_1} count={1} accent="amber" chapter={index} travel={0.9} speed={0.7} size={0.08} idle />
      <PacketFlow waypoints={RETRY_2} count={1} accent="amber" chapter={index} travel={0.9} speed={0.5} size={0.08} idle />
      <PacketFlow waypoints={DLQ_RAIL} count={1} accent="red" chapter={index} travel={1} speed={0.45} size={0.09} trail />

      {/* Deduplication gate. */}
      <group ref={dedupRef} position={[-3.2, 2.4, 0]}>
        <mesh geometry={gateGeometry} material={gateMaterial} rotation={[0, Math.PI / 2, 0]} />
        <mesh ref={shutterTop} geometry={lockGeometry} material={lockMaterials[0]} position={[0, 0.36, 0]} />
        <mesh ref={shutterBottom} geometry={lockGeometry} material={lockMaterials[0]} position={[0, -0.36, 0]} />
        <HoloLabel position={[0, -1.3, 0]} accent="amber" variant="technical" distanceFactor={9}>
          DEDUPLICATION
        </HoloLabel>
      </group>

      {/* Delay chamber. */}
      <group ref={delayRef} position={[1.4, 0.6, -1.4]}>
        <Capsule position={[0, 0, 0]} accent="amber" scale={0.8} />
        <HoloLabel position={[0, -0.9, 0]} accent="amber" variant="technical" distanceFactor={9}>
          DELAY QUEUE
        </HoloLabel>
      </group>

      {/* Retry ladder gates. */}
      <group ref={lockGroupRef}>
        <mesh geometry={lockGeometry} material={lockMaterials[0]} position={[3.2, -0.2, -1.8]} />
        <mesh geometry={lockGeometry} material={lockMaterials[1]} position={[5.2, -2.2, -4.2]} />
        <mesh geometry={lockGeometry} material={lockMaterials[2]} position={[7.4, -4.4, 4.6]} />
      </group>

      <HoloLabel position={[6, 0.4, 1.8]} accent="amber" variant="technical" distanceFactor={9}>
        RETRY · BACKOFF
      </HoloLabel>

      {/* Dead-letter chamber. */}
      <group ref={dlqRef} position={[7.4, -4.6, 4.6]}>
        <mesh geometry={gateGeometry} material={lockMaterials[2]} />
        <HoloLabel position={[0, -1.1, 0]} accent="red" variant="technical" distanceFactor={9}>
          DEAD LETTER
        </HoloLabel>
      </group>

      {/* The event leaves the queue as a signed webhook packet. */}
      <DataLink from={[11.4, 2.4, 0]} to={[13.6, 2.4, -1.4]} accent="cyan" intensity={0.5} pulses={2} chapter={index} />
    </group>
  )
}