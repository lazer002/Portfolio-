'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { DataLink, type DataLinkHandle } from '@/components/three/DataLink'
import { GridFloor } from '@/components/three/parts'
import { HoloLabel } from '@/components/three/HoloLabel'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { damp, ease, lerp, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 02 — THE ENGINEER PROFILE — HUMAN + SYSTEM
 *
 * "Create a giant vertical cyberpunk identification panel floating in front of a
 * dark architectural grid. Around it, construct small 3D service modules
 * representing API, database, queue, cache, webhook, and worker."
 *
 * The chapter is about separation: the person is one object, the stack is six,
 * and hovering a module draws a literal line back to the panel. The panel's
 * four layers split in depth as the camera travels from three-quarter to
 * frontal, which is what stops this reading as a resume card.
 */

interface ModuleDef {
  id: string
  label: string
  angle: number
  y: number
  radius: number
  size: [number, number, number]
}

const MODULES: ModuleDef[] = [
  { id: 'api', label: 'API', angle: 0.5, y: 2.4, radius: 3.6, size: [0.9, 0.7, 0.7] },
  { id: 'db', label: 'DATABASE', angle: 1.6, y: 1.2, radius: 3.9, size: [0.9, 1.1, 0.9] },
  { id: 'queue', label: 'QUEUE', angle: 2.7, y: 0.1, radius: 3.6, size: [1.3, 0.5, 0.5] },
  { id: 'cache', label: 'CACHE', angle: 3.8, y: -1.1, radius: 3.9, size: [0.8, 0.8, 0.8] },
  { id: 'webhook', label: 'WEBHOOK', angle: 4.9, y: -2.3, radius: 3.6, size: [1.0, 0.6, 0.6] },
  { id: 'worker', label: 'WORKER', angle: 0.1, y: -3.2, radius: 3.8, size: [1.0, 0.8, 0.7] },
]

const LAYER_COUNT = 4

export function Chapter02({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const panelRef = useRef<THREE.Group>(null)
  const bladeRef = useRef<THREE.Mesh>(null)
  const moduleRefs = useRef<(THREE.Group | null)[]>([])
  const linkRefs = useRef<(DataLinkHandle | null)[]>([])

  const scene = SCENES[index]

  const frameGeometry = useMemo(() => new THREE.BoxGeometry(3.7, 5.4, 0.22), [])
  const frameMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0.084, 0.126, 0.21),
        metalness: 0.95,
        roughness: 0.18,
        transmission: 0.3,
        thickness: 0.5,
        transparent: true,
      }),
    [],
  )

  const layerGeometry = useMemo(() => new THREE.PlaneGeometry(3.2, 0.9), [])
  const layerMaterials = useMemo(
    () =>
      Array.from({ length: LAYER_COUNT }, (_, i) =>
        new THREE.MeshBasicMaterial({
          color: accentColor(i === 0 ? 'white' : 'cyan'),
          toneMapped: false,
          transparent: true,
          opacity: 0.1,
        }),
      ),
    [],
  )

  const bladeGeometry = useMemo(() => new THREE.BoxGeometry(0.18, 4.6, 0.18), [])
  const bladeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('cyan'),
        toneMapped: false,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [],
  )

  const moduleGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  // One material per module: hover highlights exactly one module, so sharing a
  // single material would light them all.
  // Link endpoints are memoised so the child DataLink components never see a
  // changed prop identity and re-run their endpoint effect.
  const linkEndpoints = useMemo(
    () =>
      MODULES.map((m) => ({
        from: [0, 0, 0] as [number, number, number],
        to: [Math.cos(m.angle) * m.radius, m.y, Math.sin(m.angle) * m.radius] as [number, number, number],
      })),
    [],
  )

  const moduleMaterials = useMemo(
    () =>
      MODULES.map(
        () =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.21, 0.294, 0.462),
            metalness: 0.9,
            roughness: 0.3,
            emissive: accentColor('cyan'),
            emissiveIntensity: 0.12,
          }),
      ),
    [],
  )

  useEffect(() => {
    return () => {
      frameGeometry.dispose()
      frameMaterial.dispose()
      layerGeometry.dispose()
      layerMaterials.forEach((m) => m.dispose())
      bladeGeometry.dispose()
      bladeMaterial.dispose()
      moduleGeometry.dispose()
      moduleMaterials.forEach((m) => m.dispose())
    }
  }, [
    frameGeometry,
    frameMaterial,
    layerGeometry,
    layerMaterials,
    bladeGeometry,
    bladeMaterial,
    moduleGeometry,
    moduleMaterials,
  ])

  // Reused every frame; nothing in the loop allocates.
  const scratch = useMemo(
    () => ({
      from: new THREE.Vector3(),
      to: new THREE.Vector3(),
      push: new Array<number>(MODULES.length).fill(0),
    }),
    [],
  )

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta)
    const local = frame.chapters[index] ?? 0
    const enter = smoothstep(0, 0.3, local)
    const exit = 1 - smoothWindow(local, 0.75, 1)
    const alive = enter * exit

    const group = root.current
    if (!group) return
    group.position.set(...scene.anchor)
    group.visible = alive > 0.01

    /* ---- panel: layers separate in depth across the interval ---- */
    const panel = panelRef.current
    if (panel) {
      const separate = ease.inOut(smoothWindow(local, 0.12, 0.92))
      panel.rotation.y = lerp(-0.32, 0, ease.inOut(local))
      panel.position.y = Math.sin(frame.time * 0.5) * 0.06
      for (let i = 0; i < LAYER_COUNT; i++) {
        const mesh = panel.children[i + 1] as THREE.Mesh
        if (!mesh) continue
        mesh.position.set(Math.sin(frame.time * 0.4 + i) * 0.02, 1.5 - i * 1.0, -0.05 - i * 0.32 * separate)
        layerMaterials[i].opacity = alive * (0.07 + i * 0.035)
      }
    }

    /* ---- exit: the panel folds into a vertical data blade ---- */
    const blade = bladeRef.current
    if (blade) {
      const fold = ease.inOut(smoothWindow(local, 0.7, 1))
      blade.rotation.y = fold * (Math.PI / 2)
      blade.rotation.z = fold * 0.45
      blade.position.set(0, 0.2 + fold * 0.4, 0.3 + fold * 2.2)
      blade.scale.set(1, lerp(0.2, 1.15, fold), 1)
      bladeMaterial.opacity = alive * fold * 0.85
    }

    /* ---- six service modules with hover pull ---- */
    const px = frame.pointer.dx
    const py = frame.pointer.dy
    const interactive = frame.pointer.active && !frame.reducedMotion && !frame.pointer.coarse

    let closest = -1
    let closestDistance = 0.6

    for (let i = 0; i < MODULES.length; i++) {
      const node = moduleRefs.current[i]
      if (!node) continue
      const m = MODULES[i]
      if (interactive) {
        // Compare in the panel's normalised frame — the panel stays near the
        // centre of frame throughout this chapter's camera move.
        const sx = Math.cos(m.angle) * m.radius * 0.24
        const sy = m.y * 0.17
        const distance = Math.hypot(sx - px, sy - py)
        if (distance < closestDistance) {
          closestDistance = distance
          closest = i
        }
      }
    }

    for (let i = 0; i < MODULES.length; i++) {
      const node = moduleRefs.current[i]
      if (!node) continue
      const m = MODULES[i]
      const isHovered = i === closest

      // Hover pulls the module 0.25 world units forward; leaving returns it on
      // a spring rather than a linear tween.
      scratch.push[i] = damp(scratch.push[i], isHovered ? 0.25 : 0, isHovered ? 9 : 4.5, dt)

      const drift = frame.reducedMotion ? 0 : frame.time * 0.05
      const angle = m.angle + drift
      const bob = frame.reducedMotion ? 0 : Math.sin(frame.time * 0.8 + i * 1.1) * 0.08

      node.position.set(
        Math.cos(angle) * m.radius,
        m.y + bob,
        Math.sin(angle) * m.radius + scratch.push[i],
      )
      node.rotation.y = frame.time * 0.3 + i
      const emphasis = isHovered ? 1.18 : 1
      node.scale.set(m.size[0] * emphasis, m.size[1] * emphasis, m.size[2] * emphasis)

      moduleMaterials[i].emissiveIntensity = isHovered ? 0.9 : 0.12

      // The link tracks the module live, and brightens on hover.
      const link = linkRefs.current[i]
      if (link) {
        scratch.from.set(node.position.x * 0.32, node.position.y, node.position.z * 0.32)
        scratch.to.set(Math.cos(angle) * m.radius, m.y, Math.sin(angle) * m.radius)
        link.move(scratch.from, scratch.to, 0.06)
        link.setIntensity(isHovered ? 1 : 0.1)
        link.setPulses(isHovered ? 3 : 0)
      }
    }
  })

  return (
    <group ref={root}>
      {/* Dark architectural grid behind the panel. */}
      <GridFloor position={[0, -3.2, -6]} size={40} divisions={20} accent="cyan" opacity={0.09} />

      {/* Identity panel. Child 0 is the frame; children 1–4 are the layers. */}
      <group ref={panelRef}>
        <mesh geometry={frameGeometry} material={frameMaterial} />
        {Array.from({ length: LAYER_COUNT }, (_, i) => (
          <mesh key={i} geometry={layerGeometry} material={layerMaterials[i]} />
        ))}
      </group>

      {/* The data blade the panel becomes on exit. */}
      <mesh ref={bladeRef} geometry={bladeGeometry} material={bladeMaterial} />

      {/* Six service modules, each with its own live connection. */}
      {MODULES.map((m, i) => (
        <group key={m.id} ref={(node) => { moduleRefs.current[i] = node }}>
          <mesh geometry={moduleGeometry} material={moduleMaterials[i]} scale={m.size} />
          <HoloLabel
            position={[Math.cos(m.angle) * m.radius, m.y + m.size[1] * 0.5 + 0.42, Math.sin(m.angle) * m.radius]}
            accent="cyan"
            variant="technical"
            distanceFactor={11}
          >
            {m.label}
          </HoloLabel>
          <DataLink
            ref={(handle) => { linkRefs.current[i] = handle }}
            from={linkEndpoints[i].from}
            to={linkEndpoints[i].to}
            accent="cyan"
            intensity={0.1}
          />
        </group>
      ))}

      {/* 3D text is used only to name the structure; the words themselves live
          in the DOM overlay so they stay readable. */}
      <HoloLabel position={[0, 2.95, 0.3]} accent="white" variant="title" distanceFactor={10}>
        IDENTITY
      </HoloLabel>
      <HoloLabel position={[0, -3.6, 0]} accent="cyan" variant="technical" distanceFactor={10}>
        SERVICE MODULES
      </HoloLabel>
    </group>
  )
}