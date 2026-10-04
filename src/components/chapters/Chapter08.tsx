'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { DataLink } from '@/components/three/DataLink'
import { DetailScatter, GridFloor } from '@/components/three/parts'
import { PacketFlow } from '@/components/three/PacketFlow'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, makeRng, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 08 — DATA VAULT — MONGODB / MYSQL / ORACLEDB / REDIS
 *
 * "Create four distinct cyberpunk data vaults. MongoDB is a flexible cluster of
 * floating document shards. MySQL is an organized relational grid. OracleDB is a
 * massive enterprise vault. Redis is a fast glowing memory layer positioned
 * closest to the active request path."
 *
 * "Show database breadth without using ordinary database logos as decoration" —
 * so each store is drawn as the *shape of its data*: loose shards, a rigid
 * table, an immovable mass, a fast thin layer. That is what makes the four
 * distinguishable at a glance.
 *
 * "Use thousands of tiny data particles inside the vaults, but keep the scene
 * readable. Data should look like structured information, not stars." The
 * particles below are grid-locked, not drifting.
 *
 * Scroll behaviour: a request checks Redis first; on a miss it travels to the
 * persistent layer; the response returns and populates the cache.
 */

interface VaultDef {
  id: 'mongo' | 'mysql' | 'oracle' | 'redis'
  label: string
  position: [number, number, number]
  size: [number, number, number]
  accent: 'cyan' | 'green' | 'violet' | 'white'
  note: string
}

const VAULTS: VaultDef[] = [
  { id: 'redis', label: 'REDIS', position: [0, 2.2, 2.4], size: [2.6, 0.5, 1.4], accent: 'white', note: 'MEMORY LAYER' },
  { id: 'mongo', label: 'MONGODB', position: [-4.6, -0.4, 0], size: [2.4, 2.4, 2.4], accent: 'green', note: 'DOCUMENT SHARDS' },
  { id: 'mysql', label: 'MYSQL', position: [4.6, -0.4, 0], size: [2.2, 2, 2.2], accent: 'cyan', note: 'RELATIONAL GRID' },
  { id: 'oracle', label: 'ORACLEDB', position: [0, -0.6, -4.4], size: [3.4, 3, 3], accent: 'violet', note: 'ENTERPRISE VAULT' },
]

/** The request path: in from outside, Redis first, then the persistent layer. */
const CACHE_HIT: [number, number, number][] = [
  [0, 4.4, 8],
  [0, 3.2, 5],
  [0, 2.6, 3.4],
]

const CACHE_MISS: [number, number, number][][] = [
  [
    [0, 4.4, 8],
    [0, 3.2, 5],
    [0, 2.6, 3.4],
    [0, 1.4, 1.6],
  ],
  [
    [0, 1.4, 1.6],
    [2.4, 0.2, 0.8],
    [4.6, 0.2, 0],
  ],
  [
    [0, 1.4, 1.6],
    [-2.4, 0.2, 0.8],
    [-4.6, 0.2, 0],
  ],
]

const PERSIST: [number, number, number][] = [
  [0, 0.6, 1.6],
  [0, -0.2, -2],
  [0, -0.6, -4.4],
]

const RESPONSE: [number, number, number][] = [
  [0, -0.2, -4.4],
  [0, 0.8, -2.4],
  [0, 2.2, 2.4],
  [0, 3.6, 6],
]

export function Chapter08({ index, tier }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const cubeRef = useRef<THREE.Mesh>(null)
  const shardRefs = useRef<(THREE.Mesh | null)[]>([])
  const tableRefs = useRef<(THREE.Mesh | null)[]>([])
  const cacheRefs = useRef<(THREE.Mesh | null)[]>([])
  const scene = SCENES[index]

  const budget = tier === 'high' ? 1 : tier === 'mid' ? 0.55 : 0.25

  /* --- MongoDB: a flexible cluster of floating document shards --- */
  const shardCount = Math.floor(60 * budget) + 18
  const shardData = useMemo(() => {
    const rng = makeRng(808)
    return Array.from({ length: shardCount }, () => ({
      offset: new THREE.Vector3((rng() - 0.5) * 2.2, (rng() - 0.5) * 2.2, (rng() - 0.5) * 2.2),
      spin: new THREE.Vector3(rng() * Math.PI, rng() * Math.PI, rng() * Math.PI),
      phase: rng() * Math.PI * 2,
    }))
  }, [shardCount])

  /* --- MySQL: an organised relational grid. Same data, different shape. --- */
  const rowCount = Math.floor(7 * budget) + 5
  const colCount = Math.floor(7 * budget) + 5

  /* --- OracleDB: an immovable mass. --- */
  const coreCount = Math.floor(34 * budget) + 12
  const coreData = useMemo(() => {
    const rng = makeRng(1618)
    return Array.from({ length: coreCount }, () => ({
      x: (rng() - 0.5) * 2.2,
      y: (rng() - 0.5) * 2.0,
      z: (rng() - 0.5) * 2.2,
      scale: 0.1 + rng() * 0.16,
    }))
  }, [coreCount])

  /* --- Redis: a fast, thin memory layer. --- */
  const cellCount = Math.floor(48 * budget) + 20

  const shardGeometry = useMemo(() => new THREE.BoxGeometry(0.34, 0.05, 0.26), [])
  const cellGeometry = useMemo(() => new THREE.BoxGeometry(0.14, 0.06, 0.2), [])
  const coreGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const vaultShellGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  const shardMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('green'), toneMapped: false, transparent: true, opacity: 0.6 }),
    [],
  )
  const tableMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('cyan'), toneMapped: false, transparent: true, opacity: 0.45 }),
    [],
  )
  const coreMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('violet'), toneMapped: false, transparent: true, opacity: 0.4 }),
    [],
  )
  const cellMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor('white'), toneMapped: false, transparent: true, opacity: 0.8 }),
    [],
  )
  const vaultMaterials = useMemo(
    () =>
      VAULTS.map(
        () =>
          new THREE.MeshPhysicalMaterial({
            color: new THREE.Color(0.0756, 0.1008, 0.1596),
            metalness: 0.95,
            roughness: 0.16,
            transmission: 0.34,
            thickness: 0.6,
            transparent: true,
          }),
      ),
    [],
  )

  const cubeGeometry = useMemo(() => new THREE.BoxGeometry(1.3, 1.3, 1.3), [])
  const cubeMaterial = useMemo(
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

  useEffect(() => {
    return () => {
      shardGeometry.dispose()
      cellGeometry.dispose()
      coreGeometry.dispose()
      vaultShellGeometry.dispose()
      cubeGeometry.dispose()
      shardMaterial.dispose()
      tableMaterial.dispose()
      coreMaterial.dispose()
      cellMaterial.dispose()
      cubeMaterial.dispose()
      vaultMaterials.forEach((m) => m.dispose())
    }
  }, [
    shardGeometry,
    cellGeometry,
    coreGeometry,
    vaultShellGeometry,
    cubeGeometry,
    shardMaterial,
    tableMaterial,
    coreMaterial,
    cellMaterial,
    cubeMaterial,
    vaultMaterials,
  ])

  const scratchVec = useMemo(() => new THREE.Vector3(), [])
  const shellRefs = useRef<(THREE.Mesh | null)[]>([])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.24, local) * (1 - smoothWindow(local, 0.82, 1))
    group.visible = alive > 0.01

    // --- MongoDB shards float loosely. Structure, but unstructured.
    const shardOn = smoothWindow(local, 0.05, 0.25)
    for (let i = 0; i < shardData.length; i++) {
      const mesh = shardRefs.current[i]
      const d = shardData[i]
      if (!mesh) continue
      const t = frame.time * 0.25 + d.phase
      mesh.position.set(
        d.offset.x + Math.sin(t) * 0.12,
        d.offset.y + Math.cos(t * 0.8) * 0.12,
        d.offset.z + Math.sin(t * 0.6) * 0.1,
      )
      mesh.rotation.set(d.spin.x + t * 0.4, d.spin.y + t * 0.3, d.spin.z)
      mesh.visible = shardOn > 0.02
    }
    shardMaterial.opacity = alive * 0.55 * shardOn

    // --- MySQL grid: rigid rows and columns. Deliberately un-animated in
    // layout, because a relational table does not drift.
    const tableOn = smoothWindow(local, 0.14, 0.34)
    const activeRow = Math.floor(smoothWindow(local, 0.3, 0.6) * (rowCount - 1))
    for (let r = 0; r < rowCount; r++) {
      for (let c = 0; c < colCount; c++) {
        const index2d = r * colCount + c
        const mesh = tableRefs.current[index2d]
        if (!mesh) continue
        const spread = Math.min(1.8 / Math.max(1, colCount - 1), 1.8 / Math.max(1, rowCount - 1))
        mesh.position.set((c - (colCount - 1) / 2) * spread, (r - (rowCount - 1) / 2) * spread, 0)
        const active = r === activeRow && tableOn > 0.4
        mesh.scale.setScalar(active ? 1.5 : 1)
        mesh.visible = tableOn > 0.02
      }
    }
    tableMaterial.opacity = alive * 0.5 * tableOn

    // --- OracleDB: an immovable mass that only pulses.
    const coreOn = smoothWindow(local, 0.22, 0.42)
    for (let i = 0; i < coreData.length; i++) {
      const mesh = shardRefs.current[shardData.length + i]
      const d = coreData[i]
      if (!mesh) continue
      mesh.position.set(d.x, d.y, d.z)
      mesh.scale.setScalar(d.scale * (1 + 0.08 * Math.sin(frame.time * 1.4 + i)))
      mesh.visible = coreOn > 0.02
    }
    coreMaterial.opacity = alive * 0.4 * coreOn

    // --- Redis cells: the memory layer flashes as the cache is populated.
    const cacheOn = smoothWindow(local, 0.05, 0.22)
    const populate = smoothWindow(local, 0.42, 0.68)
    for (let i = 0; i < cellCount; i++) {
      const mesh = cacheRefs.current[i]
      if (!mesh) continue
      const spread = Math.min(2.2 / Math.max(1, cellCount / 6), 0.36)
      const column = i % 6
      const row = Math.floor(i / 6)
      mesh.position.set((column - 2.5) * spread * 0.9, row * 0.14 - 0.2, ((i * 7) % 5) * 0.08 - 0.16)
      // Cells light up in order as the response populates the cache.
      const threshold = i / cellCount
      const lit = threshold < populate ? 1 : 0.08
      mesh.scale.setScalar(0.5 + lit * 0.7)
      mesh.visible = cacheOn > 0.02
    }
    cellMaterial.opacity = alive * (0.2 + populate * 0.6)

    // --- exit: all four vaults compress into one data cube, which becomes the
    // screen of the device in SCENE 10.
    const compress = ease.inOut(smoothWindow(local, 0.8, 1))
    for (let i = 0; i < VAULTS.length; i++) {
      const shell = shellRefs.current[i]
      if (!shell) continue
      const v = VAULTS[i].position
      // Each vault collapses toward the origin, which is where the cube forms.
      scratchVec.set(v[0], v[1], v[2]).multiplyScalar(1 - compress)
      shell.position.copy(scratchVec)
      shell.scale.setScalar(1 - compress * 0.72)
    }
    const cube = cubeRef.current
    if (cube) {
      cube.visible = compress > 0.01
      cube.scale.setScalar(lerp(0.2, 1, compress))
      cube.rotation.y = frame.time * 0.6
      cube.rotation.x = Math.sin(frame.time * 0.4) * 0.3
      cubeMaterial.opacity = compress * 0.7
    }
  })

  return (
    <group ref={root} position={scene.anchor}>
      <GridFloor position={[0, -2.6, -1]} size={44} divisions={22} accent="cyan" opacity={0.1} />
      <DetailScatter position={[0, -2.2, 0]} count={30} extent={[16, 1.4, 12]} accent="cyan" seed={71} />

      {/* Vault shells. */}
      {VAULTS.map((vault, i) => (
        <mesh
          key={vault.id}
          ref={(node) => { shellRefs.current[i] = node }}
          position={vault.position}
          geometry={vaultShellGeometry}
          material={vaultMaterials[i]}
          scale={vault.size}
        />
      ))}

      {/* MongoDB: floating document shards. */}
      {shardData.map((_, i) => (
        <mesh
          key={`shard-${i}`}
          ref={(node) => { shardRefs.current[i] = node }}
          geometry={shardGeometry}
          material={shardMaterial}
          position={VAULTS[1].position}
          visible={false}
        />
      ))}

      {/* MySQL: the relational grid. */}
      {Array.from({ length: rowCount * colCount }, (_, i) => (
        <mesh
          key={`cell-${i}`}
          ref={(node) => { tableRefs.current[i] = node }}
          geometry={shardGeometry}
          material={tableMaterial}
          position={VAULTS[2].position}
          visible={false}
        />
      ))}

      {/* OracleDB: the immovable mass. */}
      {coreData.map((_, i) => (
        <mesh
          key={`core-${i}`}
          ref={(node) => { shardRefs.current[shardData.length + i] = node }}
          geometry={coreGeometry}
          material={coreMaterial}
          position={VAULTS[3].position}
          visible={false}
        />
      ))}

      {/* Redis: the memory layer. */}
      {Array.from({ length: cellCount }, (_, i) => (
        <mesh
          key={`cache-${i}`}
          ref={(node) => { cacheRefs.current[i] = node }}
          geometry={cellGeometry}
          material={cellMaterial}
          position={VAULTS[0].position}
          visible={false}
        />
      ))}

      {/* Labels. Each names the shape as well as the store. */}
      {VAULTS.map((vault) => (
        <HoloLabel
          key={vault.id}
          position={[vault.position[0], vault.position[1] + vault.size[1] * 0.5 + 0.6, vault.position[2]]}
          accent={vault.accent}
          variant="technical"
          distanceFactor={9}
        >
          {vault.label} · {vault.note}
        </HoloLabel>
      ))}

      {/* Request path: cache first, persistent layer on a miss, response back. */}
      <PacketFlow waypoints={CACHE_HIT} count={1} accent="white" chapter={index} travel={0.45} size={0.09} />
      {CACHE_MISS.map((path, i) => (
        <PacketFlow key={i} waypoints={path} count={1} accent="white" chapter={index} travel={0.4} speed={1.1} size={0.08} />
      ))}
      <PacketFlow waypoints={PERSIST} count={1} accent="violet" chapter={index} travel={0.4} size={0.09} trail />
      <PacketFlow waypoints={RESPONSE} count={2} accent="green" chapter={index} travel={0.45} speed={1.2} size={0.08} trail />

      <DataLink from={[-4.6, -0.4, 0]} to={[4.6, -0.4, 0]} accent="cyan" intensity={0.18} pulses={2} chapter={index} bow={0.4} />
      <DataLink from={[0, 2.2, 2.4]} to={[0, -0.6, -4.4]} accent="white" intensity={0.22} pulses={2} chapter={index} bow={0.3} />

      {/* The compressed data cube. */}
      <mesh ref={cubeRef} geometry={cubeGeometry} material={cubeMaterial} visible={false} />
    </group>
  )
}