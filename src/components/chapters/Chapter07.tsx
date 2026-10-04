'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { Capsule, DetailScatter, Ribbon } from '@/components/three/parts'
import { PacketFlow } from '@/components/three/PacketFlow'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, smoothstep, smoothWindow } from '@/lib/math'
import { frame } from '@/lib/store'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 07 — ERP BRIDGE — SOAP / CONTRACTS / SYNCHRONIZATION
 *
 * "Build two enormous cyberpunk terminals facing each other across a deep gap.
 * One is the commerce side; the other is the ERP side. Between them is a
 * flexible data bridge made from animated XML-like ribbons."
 *
 * Scroll behaviour: "the camera moves across the bridge. During the movement,
 * one payload travels from commerce to ERP and a response payload returns in
 * the opposite direction." The camera keys cross the gap from x = -6.5 to
 * x = +6.5, so the crossing is the camera's own journey.
 *
 * "Payload debugging is represented by a scanning beam that travels through the
 * data ribbon and briefly highlights malformed-looking segments before showing
 * a corrected synchronized packet."
 *
 * The malformed segments below are deliberately not invented incident data —
 * they are abstract geometry, with the honest words "ILL-FORMED" and
 * "SYNCHRONIZED" in the DOM overlay.
 */

const COMMERCE = -6.5
const ERP = 6.5

const OUTBOUND: [number, number, number][] = [
  [COMMERCE + 1.4, 0, 0],
  [0, 1.4, 0.6],
  [ERP - 1.4, 0, 0],
]

const INBOUND: [number, number, number][] = [
  [ERP - 1.4, -0.4, -0.8],
  [0, -1.2, -1.2],
  [COMMERCE + 1.4, -0.4, -0.8],
]

const RIBBON_TOP: [number, number, number][] = [
  [COMMERCE + 0.6, 0.8, 0],
  [-2, 1.5, 0.5],
  [2.5, 1.1, 0.4],
  [ERP - 0.6, 0.6, 0],
]

const RIBBON_BOTTOM: [number, number, number][] = [
  [COMMERCE + 0.6, -0.8, 0],
  [-2.4, -1.6, -0.5],
  [2.8, -1.2, -0.4],
  [ERP - 0.6, -0.6, 0],
]

export function Chapter07({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const commerceRef = useRef<THREE.Group>(null)
  const erpRef = useRef<THREE.Group>(null)
  const beamRef = useRef<THREE.Mesh>(null)
  const glitchRefs = useRef<(THREE.Mesh | null)[]>([])
  const scene = SCENES[index]

  const terminalShell = useMemo(() => new THREE.BoxGeometry(2.2, 4.4, 1.2), [])
  const terminalMaterials = useMemo(
    () =>
      ['cyan', 'violet'].map(
        (name) =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.147, 0.189, 0.294),
            metalness: 0.92,
            roughness: 0.28,
            emissive: accentColor(name as 'cyan' | 'violet'),
            emissiveIntensity: 0.12,
          }),
      ),
    [],
  )
  const screenGeometry = useMemo(() => new THREE.PlaneGeometry(1.7, 3.1), [])
  const screenMaterials = useMemo(
    () =>
      ['cyan', 'violet'].map(
        (name) =>
          new THREE.MeshBasicMaterial({
            color: accentColor(name as 'cyan' | 'violet'),
            toneMapped: false,
            transparent: true,
            opacity: 0.18,
          }),
      ),
    [],
  )

  const beamGeometry = useMemo(() => new THREE.BoxGeometry(13.4, 0.06, 0.5), [])
  const beamMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('white'),
        toneMapped: false,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  // Segments that briefly look ill-formed while the beam passes over them.
  const glitchGeometry = useMemo(() => new THREE.BoxGeometry(0.22, 0.22, 0.22), [])
  const glitchMaterials = useMemo(
    () => Array.from({ length: 7 }, () => new THREE.MeshBasicMaterial({ color: accentColor('amber'), toneMapped: false, transparent: true, opacity: 0 })),
    [],
  )
  const glitchPositions = useMemo(
    () => [-4.2, -2.6, -1.1, 0.4, 1.9, 3.1, 4.4].map((x, i) => ({ x, y: i % 2 === 0 ? 1.15 : -1.05, z: 0.3 })),
    [],
  )

  useEffect(() => {
    return () => {
      terminalShell.dispose()
      terminalMaterials.forEach((m) => m.dispose())
      screenGeometry.dispose()
      screenMaterials.forEach((m) => m.dispose())
      beamGeometry.dispose()
      beamMaterial.dispose()
      glitchGeometry.dispose()
      glitchMaterials.forEach((m) => m.dispose())
    }
  }, [terminalShell, terminalMaterials, screenGeometry, screenMaterials, beamGeometry, beamMaterial, glitchGeometry, glitchMaterials])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.24, local) * (1 - smoothWindow(local, 0.82, 1))
    group.visible = alive > 0.01

    // --- both terminals track the visitor slightly: they face across the gap
    // but acknowledge that someone is watching.
    const commerce = commerceRef.current
    const erp = erpRef.current
    const face = frame.reducedMotion ? 0 : frame.pointer.dx * 0.12
    if (commerce) {
      commerce.rotation.y = face + Math.sin(frame.time * 0.3) * 0.03
      commerce.position.y = Math.sin(frame.time * 0.5) * 0.08
      terminalMaterials[0].emissiveIntensity = 0.1 + frame.presence * 0.16
      screenMaterials[0].opacity = 0.1 + frame.presence * 0.14
    }
    if (erp) {
      erp.rotation.y = -face + Math.cos(frame.time * 0.27) * 0.03
      erp.position.y = Math.cos(frame.time * 0.45) * 0.08
      terminalMaterials[1].emissiveIntensity = 0.1 + frame.presence * 0.16
      screenMaterials[1].opacity = 0.1 + frame.presence * 0.14
    }

    // --- the scanning beam. It travels commerce → ERP, and only the segments
    // it is currently over light up. Then a corrected packet crosses cleanly.
    const scan = smoothstep(0.18, 0.62, local)
    const beam = beamRef.current
    if (beam) {
      beam.position.x = lerp(COMMERCE, ERP, scan)
      beamMaterial.opacity = alive * 0.55 * smoothWindow(local, 0.16, 0.2) * (1 - smoothWindow(local, 0.6, 0.68))
    }

    for (let i = 0; i < glitchPositions.length; i++) {
      const mesh = glitchRefs.current[i]
      const position = glitchPositions[i]
      if (!mesh) continue
      // Ill-formed only while the beam is on this segment.
      const proximity = smoothstep(1.6, 0, Math.abs(beam ? beam.position.x - position.x : 99))
      const material = glitchMaterials[i]
      material.opacity = alive * proximity * 0.85
      mesh.rotation.x = frame.time * 3 + i
      mesh.rotation.y = frame.time * 2.2 + i
      mesh.scale.setScalar(0.7 + proximity * 0.5)
    }

    // --- exit: the bridge collapses. The ribbons shorten and the gap widens,
    // which is the setup for SCENE 08's data landscape.
    const collapse = ease.inOut(smoothWindow(local, 0.78, 1))
    group.position.y = -collapse * 1.4
    group.scale.setScalar(1 - collapse * 0.12)
  })

  return (
    <group ref={root} position={scene.anchor}>
      <DetailScatter position={[0, -2.4, 0]} count={26} extent={[20, 2, 6]} accent="violet" seed={57} />

      {/* Commerce terminal. */}
      <group ref={commerceRef} position={[COMMERCE, 0, 0]}>
        <mesh geometry={terminalShell} material={terminalMaterials[0]} />
        <mesh geometry={screenGeometry} material={screenMaterials[0]} position={[0, 0, 0.62]} />
        <HoloLabel position={[0, 2.8, 0]} accent="cyan" variant="title" distanceFactor={9}>
          COMMERCE
        </HoloLabel>
        <HoloLabel position={[0, -2.7, 0]} accent="cyan" variant="technical" distanceFactor={9}>
          SOAP API · POSTMAN
        </HoloLabel>
      </group>

      {/* ERP terminal. */}
      <group ref={erpRef} position={[ERP, 0, 0]}>
        <mesh geometry={terminalShell} material={terminalMaterials[1]} />
        <mesh geometry={screenGeometry} material={screenMaterials[1]} position={[0, 0, 0.62]} />
        <HoloLabel position={[0, 2.8, 0]} accent="violet" variant="title" distanceFactor={9}>
          ERP
        </HoloLabel>
        <HoloLabel position={[0, -2.7, 0]} accent="violet" variant="technical" distanceFactor={9}>
          SOAP UI · CONTRACTS
        </HoloLabel>
      </group>

      {/* The flexible data bridge. */}
      <Ribbon points={RIBBON_TOP} accent="violet" width={0.34} opacity={0.6} scan />
      <Ribbon points={RIBBON_BOTTOM} accent="cyan" width={0.2} opacity={0.45} scan />

      {/* Payloads: out to ERP, response back. */}
      <PacketFlow waypoints={OUTBOUND} count={2} accent="violet" chapter={index} travel={1} size={0.09} trail />
      <PacketFlow waypoints={INBOUND} count={2} accent="cyan" chapter={index} travel={1} speed={1.2} size={0.08} trail />

      {/* Scanning beam and the segments it flags. */}
      <mesh ref={beamRef} geometry={beamGeometry} material={beamMaterial} position={[0, 0, 0.6]} />
      {glitchPositions.map((position, i) => (
        <mesh
          key={i}
          ref={(node) => { glitchRefs.current[i] = node }}
          geometry={glitchGeometry}
          material={glitchMaterials[i]}
          position={[position.x, position.y, position.z]}
        />
      ))}

      <Capsule position={[0, 0, 0]} accent="white" scale={1.2} />
      <HoloLabel position={[0, 2.1, 0.4]} accent="white" variant="technical" distanceFactor={9}>
        ORDER STATUS SYNCHRONIZATION
      </HoloLabel>
    </group>
  )
}