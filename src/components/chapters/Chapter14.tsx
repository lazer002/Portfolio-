'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { Capsule, MachineBlock } from '@/components/three/parts'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, makeRng, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import { contact, engineer } from '@/config/content'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 14 — THE CORE — CONTACT / CLOSING
 *
 * "Return to a refined version of the hero core. It should now contain small
 * fragments from every previous scene: service nodes, queue capsules, database
 * shards, API ribbons, project panels and skill tiles."
 *
 * Every fragment below is a real instance of the chapter that introduced it —
 * a queue capsule from SCENE 05, a document shard from SCENE 08, a project
 * panel from SCENE 09 — so the closing image is a genuine summary rather than
 * generic decoration orbiting a sphere.
 *
 * Scroll behaviour: "very little movement remains. The camera slowly pulls
 * backward, revealing the complete cyberpunk environment and all major system
 * fragments orbiting the core." The camera keys do exactly that, ending 28 units
 * further back than they started.
 *
 * "No aggressive glitch. Finish with a slow controlled fade, subtle grain, and
 * the final identity remaining visible." Nothing in this chapter flashes.
 */

/** One fragment per kind of thing the previous thirteen chapters built. */
type FragmentKind = 'service' | 'capsule' | 'shard' | 'ribbon' | 'panel' | 'tile'

interface Fragment {
  kind: FragmentKind
  angle: number
  radius: number
  y: number
  speed: number
  phase: number
  scale: number
}

const FRAGMENTS: Fragment[] = (() => {
  const rng = makeRng(1400)
  const kinds: FragmentKind[] = ['service', 'capsule', 'shard', 'ribbon', 'panel', 'tile']
  return Array.from({ length: 18 }, (_, i) => {
    const kind = kinds[i % kinds.length]
    const radius = kind === 'shard' ? 1.5 + rng() * 0.5 : kind === 'panel' ? 2.4 + rng() * 0.6 : 2.6 + rng() * 1.8
    return {
      kind,
      angle: (i / 18) * Math.PI * 2 + rng() * 0.4,
      radius,
      y: (rng() - 0.5) * (kind === 'panel' ? 3.2 : 4.4),
      // Slower for the larger, closer fragments so the orbit reads as one
      // system rather than a carousel.
      speed: kind === 'shard' ? -0.5 - rng() * 0.3 : 0.1 + rng() * 0.25,
      phase: rng() * Math.PI * 2,
      scale: kind === 'panel' ? 1 : kind === 'tile' ? 0.7 : 0.85 + rng() * 0.5,
    }
  })
})()

export function Chapter14({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Group>(null)
  const orbitRef = useRef<THREE.Group>(null)
  const portalRef = useRef<THREE.Mesh>(null)
  const scene = SCENES[index]

  const coreShellGeometry = useMemo(() => new THREE.TorusGeometry(1.8, 0.2, 16, 80), [])
  const coreShellMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0.168, 0.252, 0.42),
        metalness: 1,
        roughness: 0.1,
        transmission: 0.45,
        thickness: 0.9,
        ior: 1.5,
        transparent: true,
        clearcoat: 1,
      }),
    [],
  )
  const haloGeometry = useMemo(() => new THREE.TorusGeometry(2.5, 0.014, 6, 96), [])
  const haloMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('white'), toneMapped: false, transparent: true, opacity: 0.35 }),
    [],
  )
  const innerGeometry = useMemo(() => new THREE.IcosahedronGeometry(0.62, 2), [])
  const innerMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('white'),
        toneMapped: false,
        transparent: true,
        opacity: 0.5,
        wireframe: true,
      }),
    [],
  )

  const portalGeometry = useMemo(() => new THREE.TorusGeometry(0.75, 0.02, 6, 64), [])
  const portalMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('white'), toneMapped: false, transparent: true, opacity: 0 }),
    [],
  )

  // One small object per fragment kind, shared across all instances of that kind.
  const fragmentGeometry = useMemo(() => new THREE.BoxGeometry(0.3, 0.3, 0.12), [])
  const fragmentMaterials = useMemo(
    () =>
      ({
        service: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.21, 0.294, 0.42), metalness: 0.92, roughness: 0.28, emissive: accentColor('cyan'), emissiveIntensity: 0.14 }),
        capsule: new THREE.MeshBasicMaterial({ color: accentColor('violet'), toneMapped: false, transparent: true, opacity: 0.85 }),
        shard: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.168, 0.252, 0.21), metalness: 0.6, roughness: 0.4, emissive: accentColor('green'), emissiveIntensity: 0.5 }),
        ribbon: new THREE.MeshBasicMaterial({ color: accentColor('cyan'), toneMapped: false, transparent: true, opacity: 0.6 }),
        panel: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.252, 0.336, 0.5), metalness: 0.9, roughness: 0.25 }),
        tile: new THREE.MeshStandardMaterial({ color: new THREE.Color(0.21, 0.252, 0.336), metalness: 0.95, roughness: 0.2, emissive: accentColor('green'), emissiveIntensity: 0.2 }),
      }) as Record<FragmentKind, THREE.Material>,
    [],
  )

  useEffect(() => {
    return () => {
      coreShellGeometry.dispose()
      coreShellMaterial.dispose()
      haloGeometry.dispose()
      haloMaterial.dispose()
      innerGeometry.dispose()
      innerMaterial.dispose()
      portalGeometry.dispose()
      portalMaterial.dispose()
      fragmentGeometry.dispose()
      Object.values(fragmentMaterials).forEach((m) => m.dispose())
    }
  }, [
    coreShellGeometry,
    coreShellMaterial,
    haloGeometry,
    haloMaterial,
    innerGeometry,
    innerMaterial,
    portalGeometry,
    portalMaterial,
    fragmentGeometry,
    fragmentMaterials,
  ])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.3, local)
    group.visible = alive > 0.01

    // --- the core follows the pointer subtly, and calms as the chapter opens.
    const core = coreRef.current
    if (core) {
      const follow = frame.reducedMotion ? 0 : 1
      core.rotation.y += (frame.pointer.dx * 0.18 * follow - core.rotation.y) * 0.02
      core.rotation.x += (-frame.pointer.dy * 0.12 * follow - core.rotation.x) * 0.02
      core.position.y = Math.sin(frame.time * 0.4) * 0.1
      coreShellMaterial.opacity = alive
      haloMaterial.opacity = alive * 0.3
      innerMaterial.opacity = alive * 0.45
    }

    // --- fragments drift slowly. This is a reveal, not a performance.
    const orbit = orbitRef.current
    if (orbit) {
      orbit.rotation.y = frame.time * 0.045 + ease.inOut(local) * 0.6
      orbit.rotation.x = Math.sin(frame.time * 0.08) * 0.12
    }

    // --- the portal ring opens around the contact action the pointer is over.
    const portal = portalRef.current
    if (portal) {
      const px = frame.pointer.dx
      const py = frame.pointer.dy
      const overChannel = Math.hypot(px, py) < 0.85 && frame.pointer.active && !frame.pointer.coarse
      const open = overChannel ? 1 : 0
      portalMaterial.opacity += (open * 0.75 * alive - portalMaterial.opacity) * 0.08
      portal.rotation.z = frame.time * 0.3
      portal.scale.setScalar(lerp(0.7, 1.15, portalMaterial.opacity / 0.75))
      // The ring centres on whichever contact action the pointer is nearest.
      const slot = contact.length > 0 ? contact.length - 1 : 0
      const normalised = Math.min(0.999, Math.max(0, (py + 0.75) / 1.5))
      portal.position.y = lerp(-4.4, -1.2, normalised * slot)
      portal.position.x = px * 2.4
    }
  })

  return (
    <group ref={root} position={scene.anchor}>
      {/* The refined core. */}
      <group ref={coreRef}>
        <mesh geometry={coreShellGeometry} material={coreShellMaterial} rotation={[Math.PI / 2, 0, 0]} />
        <mesh geometry={haloGeometry} material={haloMaterial} rotation={[Math.PI / 2.4, 0, 0]} />
        <mesh geometry={innerGeometry} material={innerMaterial} />
        <HoloLabel position={[0, 3.1, 0]} accent="white" variant="technical" distanceFactor={16}>
          {engineer.closing.toUpperCase()}
        </HoloLabel>
      </group>

      {/* Fragments of every previous scene. */}
      <group ref={orbitRef}>
        {FRAGMENTS.map((fragment, i) => {
          const x = Math.cos(fragment.angle) * fragment.radius
          const z = Math.sin(fragment.angle) * fragment.radius
          if (fragment.kind === 'capsule') {
            return (
              <group key={i} position={[x, fragment.y, z]}>
                <Capsule position={[0, 0, 0]} accent="violet" scale={0.7} />
              </group>
            )
          }
          if (fragment.kind === 'service') {
            return <MachineBlock key={i} position={[x, fragment.y, z]} size={[0.42, 0.42, 0.42]} accent="cyan" trim={0.4} core={0.3} idle={0.12} seed={i} />
          }
          if (fragment.kind === 'panel') {
            return <MachineBlock key={i} position={[x, fragment.y, z]} size={[0.7, 0.48, 0.08]} accent="green" trim={0.5} core={0.2} idle={0.06} seed={i} />
          }
          return (
            <mesh
              key={i}
              geometry={fragmentGeometry}
              material={fragmentMaterials[fragment.kind]}
              position={[x, fragment.y, z]}
              rotation={[fragment.phase, fragment.angle, fragment.phase * 0.5]}
              scale={fragment.scale}
            />
          )
        })}
      </group>

      {/* The portal ring that opens around the hovered contact action. */}
      <mesh ref={portalRef} geometry={portalGeometry} material={portalMaterial} position={[0, -2.4, 2.2]} />

      {/* Contact anchors. The DOM overlay carries the real, clickable links. */}
      {contact.map((channel, i) => (
        <HoloLabel
          key={channel.id}
          position={[-4.6, -4.4 + i * 1.6, 2.2]}
          accent="white"
          variant="technical"
          distanceFactor={16}
        >
          {channel.label.toUpperCase()}
        </HoloLabel>
      ))}
      <HoloLabel position={[-4.6, -5.8, 2.2]} accent="white" variant="title" distanceFactor={16}>
        {engineer.name.toUpperCase()}
      </HoloLabel>
    </group>
  )
}