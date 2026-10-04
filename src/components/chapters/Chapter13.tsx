'use client'

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'

import { DataLink } from '@/components/three/DataLink'
import { HoloLabel } from '@/components/three/HoloLabel'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import { skills, type SkillRing } from '@/config/content'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 13 — STACK MATRIX — COMPLETE TECHNICAL DNA
 *
 * "Create a massive 3D neural matrix. Each skill is a physical glass-metal tile
 * connected to related technologies. Backend technologies form the central
 * cluster, integrations and messaging form the middle ring, frontend and tools
 * form outer rings."
 *
 * Every tile and every edge comes straight from `content.ts` — thirty-one
 * skills, positioned by their real `ring`, connected by their real `related`
 * ids. Nothing here is decorative; the picture *is* the skill set and the
 * relationships between it.
 *
 * Hover lifts a tile and lights only its own edges, because "keep interaction
 * responses local to the object under the pointer" is an explicit rule.
 */

const RING_RADIUS: Record<SkillRing, number> = {
  core: 3.2,
  integration: 6.6,
  interface: 10,
}

const RING_ACCENT: Record<SkillRing, 'green' | 'cyan' | 'violet'> = {
  core: 'green',
  integration: 'cyan',
  interface: 'violet',
}

const RING_TILT: Record<SkillRing, number> = {
  core: 0.5,
  integration: 0.28,
  interface: -0.18,
}

export function Chapter13({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const coreRef = useRef<THREE.Group>(null)
  const tileRefs = useRef<(THREE.Group | null)[]>([])
  const hovered = useRef(-1)
  const scene = SCENES[index]

  /** One tile per skill, placed by ring and evenly distributed within it. */
  const tiles = useMemo(() => {
    const byRing = new Map<SkillRing, typeof skills>()
    for (const skill of skills) {
      const list = byRing.get(skill.ring) ?? []
      list.push(skill)
      byRing.set(skill.ring, list)
    }

    const placed: {
      skill: (typeof skills)[number]
      ring: SkillRing
      angle: number
      position: [number, number, number]
    }[] = []
    for (const ring of ['core', 'integration', 'interface'] as SkillRing[]) {
      const list = byRing.get(ring) ?? []
      const radius = RING_RADIUS[ring]
      list.forEach((skill, i) => {
        // Offset each ring so tiles never line up radially across all three.
        const offset = ring === 'core' ? 0 : ring === 'integration' ? 0.32 : 0.14
        const angle = (i / Math.max(1, list.length)) * Math.PI * 2 + offset
        const tilt = RING_TILT[ring]
        placed.push({
          skill,
          ring,
          angle,
          position: [Math.cos(angle) * radius, Math.sin(angle) * radius * tilt, Math.sin(angle * 2) * 0.6],
        })
      })
    }
    return placed
  }, [])

  /** Edges come from the `related` lists in the content config. */
  const edges = useMemo(() => {
    const byId = new Map(tiles.map((t) => [t.skill.id, t]))
    const seen = new Set<string>()
    const list: { from: [number, number, number]; to: [number, number, number]; a: string; b: string }[] = []
    for (const skill of skills) {
      for (const related of skill.related) {
        const key = [skill.id, related].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)
        const from = byId.get(skill.id)
        const to = byId.get(related)
        if (from && to) {
          list.push({ from: from.position, to: to.position, a: skill.id, b: related })
        }
      }
    }
    return list
  }, [tiles])

  const tileGeometry = useMemo(() => new THREE.BoxGeometry(0.62, 0.62, 0.09), [])
  const tileMaterials = useMemo(
    () =>
      Object.fromEntries(
        skills.map((skill) => [
          skill.id,
          // Deliberately NOT MeshPhysicalMaterial with `transmission`.
          // Transmission is not a per-object look tweak: any transmissive
          // material in the scene makes three render the whole opaque scene
          // again into a transmission target every frame, and thirty-one of
          // them turned this chapter into the one that dropped frames. A
          // near-mirror metal under the generated environment reads the same at
          // this size and costs one standard shader.
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.126, 0.168, 0.252),
            metalness: 0.95,
            roughness: 0.16,
            emissive: accentColor(RING_ACCENT[skill.ring]),
            emissiveIntensity: 0.16,
          }),
        ]),
      ) as Record<string, THREE.MeshStandardMaterial>,
    [],
  )
  const coreGeometry = useMemo(() => new THREE.IcosahedronGeometry(1.05, 2), [])
  const coreMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: accentColor('white').multiplyScalar(0.12),
        emissive: accentColor('green'),
        emissiveIntensity: 0.9,
        metalness: 0.6,
        roughness: 0.25,
        wireframe: true,
        transparent: true,
        opacity: 0.7,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      tileGeometry.dispose()
      Object.values(tileMaterials).forEach((m) => m.dispose())
      coreGeometry.dispose()
      coreMaterial.dispose()
    }
  }, [tileGeometry, tileMaterials, coreGeometry, coreMaterial])

  useFrame((_, delta) => {
    const dt = Math.min(0.05, delta)
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.2, local) * (1 - smoothWindow(local, 0.86, 1))
    group.visible = alive > 0.01

    // --- hover: lift one tile, brighten only its own edges.
    const px = frame.pointer.dx
    const py = frame.pointer.dy
    const interactive = frame.pointer.active && !frame.reducedMotion && !frame.pointer.coarse

    let closest = -1
    let closestDistance = 0.16
    if (interactive) {
      for (let i = 0; i < tiles.length; i++) {
        const t = tiles[i]
        // Project each tile roughly into screen-normalised space.
        const sx = t.position[0] * 0.055
        const sy = t.position[1] * 0.07
        const distance = Math.hypot(sx - px, sy - py)
        if (distance < closestDistance) {
          closestDistance = distance
          closest = i
        }
      }
    }
    hovered.current = closest

    // --- the matrix itself turns slowly; scroll adds a rotation on top rather
    // than replacing the idle motion.
    const scrollSpin = ease.inOut(local) * 0.8
    const idleWeight = smoothWindow(frame.sinceScroll, 0.4, 2.2)
    group.rotation.y = scrollSpin + frame.time * 0.06 * idleWeight
    group.rotation.x = Math.sin(frame.time * 0.12) * 0.08 * idleWeight

    for (let i = 0; i < tiles.length; i++) {
      const node = tileRefs.current[i]
      const t = tiles[i]
      if (!node) continue
      const isHovered = i === closest

      // Each tile drifts on its own phase so the matrix breathes rather than
      // rotating as a solid disc.
      const phase = t.angle * 3
      node.position.set(
        t.position[0],
        t.position[1] + Math.sin(frame.time * 0.7 + phase) * 0.09,
        t.position[2] + Math.cos(frame.time * 0.5 + phase) * 0.14,
      )
      node.rotation.set(
        Math.sin(frame.time * 0.3 + phase) * 0.14,
        -group.rotation.y + Math.sin(frame.time * 0.2 + phase) * 0.2,
        t.angle * 0.05,
      )

      // Hover lifts the tile toward the viewer.
      const lift = isHovered ? 1 : 0
      node.userData.lift = lerp(node.userData.lift ?? 0, lift, 1 - Math.exp(-9 * dt))
      node.position.z += node.userData.lift * 1.1
      node.scale.setScalar(1 + node.userData.lift * 0.35)

      // Only the hovered tile's own related tiles light up. "Keep interaction
      // responses local to the object under the pointer."
      const hoveredSkill = closest >= 0 ? tiles[closest].skill : null
      const connected = !isHovered && hoveredSkill ? hoveredSkill.related.includes(t.skill.id) : false
      tileMaterials[t.skill.id].emissiveIntensity = isHovered ? 1.4 : connected ? 0.7 : 0.16
    }

    // --- the central core contracts at the end; this is the object SCENE 14
    // inherits.
    const core = coreRef.current
    if (core) {
      const compress = ease.inOut(smoothWindow(local, 0.82, 1))
      core.rotation.y = frame.time * 0.4
      core.rotation.x = frame.time * 0.2
      core.scale.setScalar(lerp(1, 2.4, compress))
      coreMaterial.opacity = 0.7 * (1 - compress * 0.5)
      coreMaterial.emissiveIntensity = 0.9 + compress * 2.4
    }
  })

  return (
    <group ref={root} position={scene.anchor}>
      {/* The central cluster. */}
      <mesh ref={coreRef} geometry={coreGeometry} material={coreMaterial} />
      <HoloLabel position={[0, 1.6, 0]} accent="white" variant="technical" distanceFactor={12}>
        CORE CLUSTER
      </HoloLabel>

      {/* Edges between related skills. */}
      {edges.map((edge) => (
        <DataLink key={`${edge.a}-${edge.b}`} from={edge.from} to={edge.to} accent="green" intensity={0.16} bow={0.16} />
      ))}

      {/* Thirty-one skill tiles. */}
      {tiles.map((tile, i) => (
        <group key={tile.skill.id} ref={(node) => { tileRefs.current[i] = node }} position={tile.position}>
          <mesh geometry={tileGeometry} material={tileMaterials[tile.skill.id]} />
          <HoloLabel
            position={[0, 0.52, 0]}
            accent={RING_ACCENT[tile.ring]}
            variant="technical"
            distanceFactor={14}
          >
            {tile.skill.name}
          </HoloLabel>
        </group>
      ))}
    </group>
  )
}