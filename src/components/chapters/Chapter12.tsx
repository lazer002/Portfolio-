'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { DataLink } from '@/components/three/DataLink'
import { PanelSlab } from '@/components/three/parts'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 12 — PRODUCTION CONTROL ROOM — DEBUGGING
 *
 * "Build a dark cyberpunk control room made from floating translucent diagnostic
 * panels. A central failed request is represented as a red data packet frozen in
 * space."
 *
 * "Scroll advances the investigation step by step. First reveal the log, then
 * the API payload, then the queue state, then the database record, then the
 * root cause, then the corrected workflow."
 *
 * "Do not fabricate specific incidents from the resume. Use clearly labeled
 * illustrative diagnostic data. The visual story should demonstrate the
 * debugging method rather than claim a specific production outage." So the
 * panels carry method labels and abstract readouts only — no invented error
 * messages, endpoints or incident identifiers. The one thing the scene asserts
 * about reality is the method, which is what the resume actually supports.
 */

/** The six steps of the investigation, in order. */
const STEPS = [
  'LOG ANALYSIS',
  'API PAYLOAD TRACING',
  'QUEUE BEHAVIOR',
  'DATABASE RECORDS',
  'ROOT-CAUSE ANALYSIS',
  'PRODUCTION SAFEGUARDS',
]

/** Each step gets a window across the chapter's progress. */
const STEP_WINDOWS: [number, number][] = [
  [0.04, 0.24],
  [0.16, 0.38],
  [0.3, 0.52],
  [0.44, 0.66],
  [0.58, 0.82],
  [0.74, 0.97],
]

/** Panel placement — a control room, not a flat dashboard. */
const PANEL_SLOTS: { position: [number, number, number]; rotation: [number, number, number] }[] = [
  { position: [-5.2, 2.4, -2.4], rotation: [0, 0.55, 0] },
  { position: [5.2, 2.6, -2.6], rotation: [0, -0.55, 0] },
  { position: [-5.6, -1.4, 1.2], rotation: [0.1, 0.7, 0] },
  { position: [5.6, -1.2, 1], rotation: [-0.1, -0.7, 0] },
  { position: [-2.6, 3.8, 3.4], rotation: [-0.3, 0.28, 0] },
  { position: [2.8, -3.4, 3.2], rotation: [0.28, -0.3, 0] },
]

const PANEL_OPACITY = 0.42

export function Chapter12({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const panelRefs = useRef<(THREE.Group | null)[]>([])
  const packetRef = useRef<THREE.Group>(null)
  const traceRef = useRef<THREE.Mesh>(null)
  const causeRef = useRef<THREE.Mesh>(null)
  const signalRef = useRef<THREE.Mesh>(null)
  const scene = SCENES[index]

  const packetGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.34, 1), [])
  const packetMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: accentColor('red'),
        emissive: accentColor('red'),
        emissiveIntensity: 1.6,
        metalness: 0.4,
        roughness: 0.3,
        transparent: true,
        opacity: 0.9,
      }),
    [],
  )

  const causeGeometry = useMemo(() => new THREE.TorusGeometry(0.85, 0.05, 8, 48), [])
  const causeMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('red'), toneMapped: false, transparent: true, opacity: 0 }),
    [],
  )

  const traceGeometry = useMemo(() => new THREE.BoxGeometry(1, 0.05, 0.05), [])
  const traceMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('white'), toneMapped: false, transparent: true, opacity: 0 }),
    [],
  )

  const signalGeometry = useMemo(() => new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), [])
  const signalMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('green'), toneMapped: false, transparent: true, opacity: 0 }),
    [],
  )

  useEffect(() => {
    return () => {
      packetGeometry.dispose()
      packetMaterial.dispose()
      causeGeometry.dispose()
      causeMaterial.dispose()
      traceGeometry.dispose()
      traceMaterial.dispose()
      signalGeometry.dispose()
      signalMaterial.dispose()
    }
  }, [packetGeometry, packetMaterial, causeGeometry, causeMaterial, traceGeometry, traceMaterial, signalGeometry, signalMaterial])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.16, local) * (1 - smoothWindow(local, 0.88, 1))
    group.visible = alive > 0.01

    // --- panels arrive one step at a time and then hold, so the room fills up
    // as evidence accumulates rather than all at once.
    let reached = 0
    for (let i = 0; i < STEPS.length; i++) {
      const panel = panelRefs.current[i]
      if (!panel) continue
      const [start, end] = STEP_WINDOWS[i]
      const open = smoothWindow(local, start, start + 0.09)
      const done = 1 - smoothWindow(local, end, end + 0.1)
      if (local > start) reached = i + 1

      const emphasis = open * (0.55 + done * 0.45)
      panel.scale.setScalar(0.5 + ease.out(open) * 0.5)
      panel.position.z = PANEL_SLOTS[i].position[2] - (1 - open) * 1.8
      // The current step leans in; resolved steps settle back.
      panel.position.x = PANEL_SLOTS[i].position[0] * (0.75 + emphasis * 0.25)
      panel.visible = alive > 0.01 && open > 0.01
    }

    // --- the failed packet is frozen in space. Everything else in the room
    // moves; the problem does not. That contrast is the entire image.
    const packet = packetRef.current
    if (packet) {
      packet.rotation.y = frame.time * 0.35
      packet.rotation.x = frame.time * 0.22
      const resolved = smoothWindow(local, 0.8, 0.9)
      const alarm = 0.6 + 0.4 * Math.abs(Math.sin(frame.time * 2.6))
      packetMaterial.emissiveIntensity = lerp(1.4 * alarm, 0.9, resolved)
      packetMaterial.color.lerpColors(accentColor('red'), accentColor('white'), resolved)
      packetMaterial.emissive.lerpColors(accentColor('red'), accentColor('green'), resolved)
      packet.scale.setScalar(lerp(1, 1.18, alarm * 0.4) * (1 - resolved * 0.15))
    }

    // --- the trace: a horizontal line that grows across the room as each step
    // is confirmed. The width of the trace is the progress of the method.
    const trace = traceRef.current
    if (trace) {
      const target = (reached / STEPS.length) * 11
      trace.scale.x = Math.max(0.05, target)
      traceMaterial.opacity = alive * 0.4
    }

    // --- root cause: a ring closes once, at the fifth step.
    const cause = causeRef.current
    if (cause) {
      const found = smoothWindow(local, STEP_WINDOWS[4][0], STEP_WINDOWS[4][0] + 0.1)
      causeMaterial.opacity = found * (1 - smoothWindow(local, 0.9, 1)) * 0.85
      cause.rotation.z = frame.time * 0.4
      cause.scale.setScalar(lerp(1.6, 1, ease.out(found)))
    }

    // --- the resolved signal leaves for the final matrix.
    const signal = signalRef.current
    if (signal) {
      const resolved = smoothWindow(local, 0.82, 0.96)
      signalMaterial.opacity = resolved * 0.9
      signal.position.set(0, 0.2, lerp(0, -10, resolved))
      signal.rotation.z = Math.PI / 2
    }
  })

  return (
    <group ref={root} position={scene.anchor}>
      {/* Six diagnostic panels, opening in sequence. */}
      {STEPS.map((label, i) => {
        const slot = PANEL_SLOTS[i]
        return (
          <group key={label} ref={(node) => { panelRefs.current[i] = node }} position={slot.position} rotation={slot.rotation}>
            <PanelSlab
              size={[3.2, 2.1]}
              accent={i === 4 ? 'red' : i === 5 ? 'green' : 'white'}
              opacity={PANEL_OPACITY}
            />
            <HoloLabel
              position={[0, -1.3, 0.2]}
              accent={i === 4 ? 'red' : i === 5 ? 'green' : 'white'}
              variant="technical"
              distanceFactor={9}
            >
              {label}
            </HoloLabel>
          </group>
        )
      })}

      {/* The failed request, frozen. */}
      <group ref={packetRef} position={[0, 0.2, 0]}>
        <mesh geometry={packetGeometry} material={packetMaterial} />
        <HoloLabel position={[0, -1.05, 0]} accent="red" variant="technical" distanceFactor={9}>
          FAILED REQUEST
        </HoloLabel>
      </group>

      {/* The accumulating evidence trace. */}
      <mesh ref={traceRef} geometry={traceGeometry} material={traceMaterial} position={[0, -0.35, 0]} />

      {/* Root cause. */}
      <mesh ref={causeRef} geometry={causeGeometry} material={causeMaterial} position={[0, 0.2, 0]} />

      {/* The corrected signal, travelling onward. */}
      <mesh ref={signalRef} geometry={signalGeometry} material={signalMaterial} position={[0, 0.2, 0]} />
      <DataLink from={[0, 0.2, -2]} to={[0, 0.2, -10]} accent="green" intensity={0.35} pulses={3} chapter={index} />
    </group>
  )
}