'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { DataLink } from '@/components/three/DataLink'
import { DetailScatter, MachineBlock } from '@/components/three/parts'
import { PacketFlow } from '@/components/three/PacketFlow'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, makeRng, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 11 — ACCESS GRID — HRMS + HONDA HMSI
 *
 * "Create a vertical cyberpunk access tower. Four major levels represent
 * Employee, Manager, HR and Admin. Thousands of small user nodes sit below the
 * hierarchy. A separate enterprise tower represents the Honda HMSI system."
 *
 * Scroll behaviour: "the camera climbs the hierarchy. Each level unlocks another
 * layer of the tower." The camera keys run from y = -2 to y = +9, so the climb
 * is the camera's actual movement rather than an animation played on an object.
 *
 * "Thousands of small user nodes sit below the hierarchy" — these are one
 * InstancedMesh, sized by capability tier, because a thousand React components
 * would be a thousand draw calls.
 */

const LEVELS = [
  { id: 'employee', label: 'EMPLOYEE', y: 0, width: 6.4 },
  { id: 'manager', label: 'MANAGER', y: 3.2, width: 5.4 },
  { id: 'hr', label: 'HR', y: 6.2, width: 4.4 },
  { id: 'admin', label: 'ADMIN', y: 9, width: 3.4 },
]

const ROUTES: [number, number, number][][] = [
  // auth → role resolution → routing → database
  [
    [0, -5.4, 4],
    [0, -3.6, 2.6],
    [0, -1.6, 1.4],
  ],
  [
    [0, -1.6, 1.4],
    [1.4, 0.6, 0.6],
    [2.6, 3, 0],
  ],
  [
    [0, -1.6, 1.4],
    [-1.4, 0.6, 0.6],
    [-2.6, 3, 0],
  ],
  [
    [0, 3, 0],
    [0, 6, 0],
    [0, 8.8, 0],
  ],
]

export function Chapter11({ index, tier }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const levelRefs = useRef<(THREE.Mesh | null)[]>([])
  const usersRef = useRef<THREE.InstancedMesh>(null)
  const enterpriseRef = useRef<THREE.Group>(null)
  const scene = SCENES[index]

  const budget = tier === 'high' ? 1 : tier === 'mid' ? 0.5 : 0.2
  const userCount = Math.floor(2400 * budget) + 260

  const slabGeometry = useMemo(() => new THREE.BoxGeometry(1, 0.28, 3.2), [])
  const slabMaterials = useMemo(
    () =>
      LEVELS.map(
        (_, i) =>
          new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.126, 0.168, 0.252),
            metalness: 0.94,
            roughness: 0.24,
            emissive: accentColor(i > 1 ? 'cyan' : 'white'),
            emissiveIntensity: 0.06,
          }),
      ),
    [],
  )

  const userGeometry = useMemo(() => new THREE.BoxGeometry(0.05, 0.05, 0.05), [])
  const userMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('cyan'),
        toneMapped: false,
        transparent: true,
        opacity: 0.55,
      }),
    [],
  )

  const enterpriseGeometry = useMemo(() => new THREE.BoxGeometry(2.2, 16, 2.2), [])
  const enterpriseMaterial = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.1176, 0.1512, 0.231),
        metalness: 0.9,
        roughness: 0.4,
        emissive: accentColor('violet'),
        emissiveIntensity: 0.08,
      }),
    [],
  )

  useEffect(() => {
    return () => {
      slabGeometry.dispose()
      slabMaterials.forEach((m) => m.dispose())
      userGeometry.dispose()
      userMaterial.dispose()
      enterpriseGeometry.dispose()
      enterpriseMaterial.dispose()
    }
  }, [slabGeometry, slabMaterials, userGeometry, userMaterial, enterpriseGeometry, enterpriseMaterial])

  // The user field: a deterministic block lattice sitting under the hierarchy.
  useEffect(() => {
    const mesh = usersRef.current
    if (!mesh) return
    const rng = makeRng(2468)
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    const side = Math.ceil(Math.cbrt(userCount))
    for (let i = 0; i < userCount; i++) {
      const x = (i % side) - side / 2
      const z = (Math.floor(i / side) % side) - side / 2
      const layer = Math.floor(i / (side * side))
      dummy.position.set(x * 0.24, -6 - layer * 0.24, z * 0.24)
      dummy.scale.setScalar(0.6 + rng() * 0.8)
      dummy.rotation.set(0, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
      // Staggered brightness, so the mass reads as many users rather than a
      // single glowing block.
      mesh.setColorAt(i, color.copy(accentColor('cyan')).multiplyScalar(0.4 + rng() * 0.8))
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [userCount])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.2, local) * (1 - smoothWindow(local, 0.84, 1))
    group.visible = alive > 0.01

    // --- each level unlocks as the camera reaches it.
    for (let i = 0; i < LEVELS.length; i++) {
      const mesh = levelRefs.current[i]
      if (!mesh) continue
      const level = LEVELS[i]
      // Unlock window keyed to where the camera is in its climb.
      const threshold = 0.1 + i * 0.2
      const unlocked = smoothWindow(local, threshold, threshold + 0.16)
      const locked = 1 - unlocked

      mesh.scale.set(locked > 0.5 ? level.width * 0.4 : level.width, 1, locked > 0.5 ? 1.6 : 3.2)
      mesh.rotation.y = locked * 0.25 + Math.sin(frame.time * 0.2 + i) * 0.02
      mesh.position.y = level.y + Math.sin(frame.time * 0.5 + i) * 0.04
      slabMaterials[i].emissiveIntensity = 0.05 + unlocked * 0.55
      mesh.visible = alive > 0.01
    }

    // --- the user field dims once the hierarchy above it is in focus, so the
    // eye travels upward rather than being held at the bottom.
    if (usersRef.current) {
      const climb = ease.inOut(smoothWindow(local, 0.15, 0.75))
      userMaterial.opacity = alive * lerp(0.7, 0.16, climb)
      usersRef.current.rotation.y = frame.time * 0.03
      usersRef.current.position.y = -climb * 2.4
    }

    // --- the Honda HMSI enterprise tower stands alongside, not inside, the HRMS.
    const enterprise = enterpriseRef.current
    if (enterprise) {
      enterprise.position.y = -6 + Math.sin(frame.time * 0.35) * 0.2
      enterpriseMaterial.emissiveIntensity = 0.06 + frame.presence * 0.16
    }
  })

  return (
    <group ref={root} position={scene.anchor}>
      <DetailScatter position={[0, 4, -4]} count={22} extent={[12, 12, 4]} accent="cyan" seed={91} />

      {/* The hierarchy. */}
      {LEVELS.map((level, i) => (
        <group key={level.id}>
          <mesh
            ref={(node) => { levelRefs.current[i] = node }}
            geometry={slabGeometry}
            material={slabMaterials[i]}
            position={[0, level.y, 0]}
            scale={[level.width, 1, 3.2]}
          />
          <HoloLabel position={[level.width * 0.5 + 1.1, level.y, 0]} accent="cyan" variant="technical" distanceFactor={9}>
            {level.label}
          </HoloLabel>
        </group>
      ))}

      {/* The user field below the hierarchy. */}
      <instancedMesh ref={usersRef} args={[userGeometry, userMaterial, userCount]} frustumCulled={false} />

      {/* Honda HMSI: a separate enterprise tower. */}
      <group ref={enterpriseRef} position={[9, -6, -2]}>
        <mesh geometry={enterpriseGeometry} material={enterpriseMaterial} />
        <HoloLabel position={[0, 8.6, 0]} accent="violet" variant="title" distanceFactor={10}>
          HONDA HMSI
        </HoloLabel>
        <HoloLabel position={[0, -8.6, 0]} accent="violet" variant="technical" distanceFactor={10}>
          ORACLEDB
        </HoloLabel>
        <MachineBlock position={[0, 6.2, 0]} size={[2.4, 0.5, 2.4]} accent="violet" trim={0.3} core={0.2} />
      </group>

      {/* A request travelling authentication → role resolution → routing → data. */}
      {ROUTES.map((route, i) => (
        <PacketFlow key={i} waypoints={route} count={2} accent="cyan" chapter={index} travel={0.85} speed={1.1} size={0.075} />
      ))}
      <HoloLabel position={[0, -6.6, 2.4]} accent="cyan" variant="technical" distanceFactor={9}>
        AUTHENTICATION
      </HoloLabel>
      <HoloLabel position={[0, 0.2, 2.6]} accent="cyan" variant="technical" distanceFactor={9}>
        DYNAMIC ROUTING
      </HoloLabel>

      {/* The HRMS and Honda systems stay separate — an honest depiction of two
          distinct enterprise deployments. */}
      <DataLink from={[2.8, 9, 0]} to={[9, 0.4, -2]} accent="violet" intensity={0.2} pulses={2} chapter={index} />
    </group>
  )
}