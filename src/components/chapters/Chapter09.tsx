'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { PanelSlab } from '@/components/three/parts'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import { projects } from '@/config/content'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 09 — PRODUCT GALLERY — REAL PROJECTS
 *
 * "Create a long horizontal cyberpunk gallery containing large floating project
 * slabs. Each slab is a rounded glass-metal rectangle with an embedded
 * image/video area, project title, technology tags and a small project number."
 *
 * "Vertical page scrolling drives horizontal camera movement. The visitor should
 * feel as if they are walking through a physical project archive."
 *
 * "Cards must not all animate identically. The flagship commerce projects can
 * have stronger motion; supporting projects can use quieter rotations and depth
 * shifts." The `flagship` flag in the content config drives exactly that
 * difference, so it is one boolean in the data rather than a per-scene list.
 *
 * The slabs carry no imagery: the brief forbids inventing project media, and a
 * labelled inset screen is a more honest representation than a placeholder
 * screenshot would be. Titles, stacks and live links live in the DOM overlay.
 */

const SPACING = 6.4

export function Chapter09({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const slabRefs = useRef<(THREE.Group | null)[]>([])
  const doorRef = useRef<THREE.Group>(null)
  const scene = SCENES[index]

  // `key` is not the same as index: content.ts owns the data, the scene only
  // decides where each project stands.
  const layout = useMemo(
    () =>
      projects.map((project, i) => ({
        project,
        x: (i - (projects.length - 1) / 2) * SPACING,
        // Flagships sit slightly proud of the corridor; supporting work sits
        // deeper, so the eye is pulled to the strongest work first.
        z: project.flagship ? 0.4 : -1.6,
        seed: i * 1.37,
      })),
    [],
  )

  const doorGeometry = useMemo(() => new THREE.BoxGeometry(2.9, 4.6, 0.14), [])
  const doorMaterials = useMemo(
    () =>
      [0, 1].map(
        () =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.252, 0.336, 0.5),
            metalness: 0.94,
            roughness: 0.22,
            emissive: accentColor('violet'),
            emissiveIntensity: 0.08,
          }),
      ),
    [],
  )
  const edgeGeometry = useMemo(() => new THREE.BoxGeometry(3.4, 5.1, 0.06), [])
  const edgeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('violet'),
        toneMapped: false,
        transparent: true,
        opacity: 0,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      doorGeometry.dispose()
      doorMaterials.forEach((m) => m.dispose())
      edgeGeometry.dispose()
      edgeMaterial.dispose()
    }
  }, [doorGeometry, doorMaterials, edgeGeometry, edgeMaterial])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.2, local) * (1 - smoothWindow(local, 0.84, 1))
    group.visible = alive > 0.01

    // --- slabs. Flagships move more; supporting work is quieter, exactly as
    // the brief asks.
    for (let i = 0; i < layout.length; i++) {
      const slab = slabRefs.current[i]
      const item = layout[i]
      if (!slab) continue

      const energy = item.project.flagship ? 1 : 0.42
      // The slab nearest the centre of the corridor is the one being read.
      const depth = Math.abs(item.x - lerp(-(layout.length - 1) * 1.2, (layout.length - 1) * 1.2, local)) / SPACING

      slab.rotation.y = frame.time * 0.12 * energy + Math.sin(frame.time * 0.4 + item.seed) * 0.06 * energy
      slab.rotation.x = Math.sin(frame.time * 0.3 + item.seed) * 0.03 * energy
      slab.position.y = Math.sin(frame.time * 0.6 + item.seed) * 0.12 * energy
      slab.position.z = item.z + Math.min(1.6, depth) * 0.5 * energy
      slab.scale.setScalar(1 - Math.min(1, depth) * 0.12)
    }

    // --- exit: the final slab opens like a mechanical door, revealing a device
    // floating inside it.
    const door = doorRef.current
    if (door) {
      const open = ease.inOut(smoothWindow(local, 0.8, 1))
      const [left, right] = door.children
      if (left) left.position.x = -open * 1.45
      if (right) right.position.x = open * 1.45
      edgeMaterial.opacity = open * 0.5
    }
  })

  const lastX = layout.length > 0 ? layout[layout.length - 1].x : 0

  return (
    <group ref={root} position={scene.anchor}>
      {layout.map((item, i) => (
        <group key={item.project.id} position={[item.x, 0, item.z]} ref={(node) => { slabRefs.current[i] = node }}>
          <PanelSlab
            size={[4.2, 2.8]}
            accent={item.project.flagship ? 'green' : 'cyan'}
            opacity={item.project.flagship ? 0.72 : 0.5}
            rotation={[0, 0, 0]}
          />
          <HoloLabel
            position={[0, -1.85, 0.2]}
            accent={item.project.flagship ? 'green' : 'cyan'}
            variant="technical"
            distanceFactor={9}
          >
            {String(i + 1).padStart(2, '0')} · {item.project.stack.slice(0, 3).join(' · ')}
          </HoloLabel>
        </group>
      ))}

      {/* The mechanical door at the end of the archive. */}
      <group ref={doorRef} position={[lastX + SPACING, 0, -1]}>
        <group>
          <mesh geometry={doorGeometry} material={doorMaterials[0]} position={[-0.72, 0, 0]} />
        </group>
        <group>
          <mesh geometry={doorGeometry} material={doorMaterials[1]} position={[0.72, 0, 0]} />
        </group>
        <mesh geometry={edgeGeometry} material={edgeMaterial} />
      </group>
    </group>
  )
}