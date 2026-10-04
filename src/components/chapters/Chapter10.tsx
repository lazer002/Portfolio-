'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { HoloLabel } from '@/components/three/HoloLabel'
import { DataLink } from '@/components/three/DataLink'
import { PanelSlab } from '@/components/three/parts'
import { SCENES } from '@/config/scenes'
import { accentColor } from '@/components/three/materials'
import { ease, lerp, makeRng, smoothWindow, smoothstep } from "@/lib/math"
import { frame } from '@/lib/store'
import type { ChapterProps } from '@/components/chapters/types'

/**
 * SCENE 10 — MOBILE WEALTH NODE — PLEXIFY
 *
 * "Build a large futuristic mobile device floating vertically in front of the
 * camera. The device has layered glass UI panels extending into 3D space. Behind
 * it, create a blockchain lattice of connected nodes."
 *
 * Scroll behaviour: "the device rotates from portrait to a slight perspective
 * angle. The interface layers separate, revealing assets, liabilities,
 * property, insurance and will-generation concepts as visual modules."
 *
 * "The blockchain lattice should remain secondary. Nodes connect and pulse only
 * when data moves between the app and the secure-data layer." The lattice is
 * behind, dimmer, and its pulses are gated on the app-to-secure-data transfers
 * rather than running continuously.
 */

const MODULES = ['ASSETS', 'LIABILITIES', 'PROPERTY', 'INSURANCE', 'WILL GENERATION']

const LATTICE_NODES = 42

export function Chapter10({ index }: ChapterProps) {
  const root = useRef<THREE.Group>(null)
  const deviceRef = useRef<THREE.Group>(null)
  const layerRefs = useRef<(THREE.Group | null)[]>([])
  const latticeRef = useRef<THREE.InstancedMesh>(null)
  const scene = SCENES[index]

  const deviceShellGeometry = useMemo(() => new THREE.BoxGeometry(2.1, 4.3, 0.16), [])
  const deviceShellMaterial = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0.084, 0.1176, 0.189),
        metalness: 0.96,
        roughness: 0.12,
        transmission: 0.3,
        thickness: 0.5,
        transparent: true,
      }),
    [],
  )
  const screenGeometry = useMemo(() => new THREE.PlaneGeometry(1.82, 3.9), [])
  const screenMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('violet'),
        toneMapped: false,
        transparent: true,
        opacity: 0.14,
      }),
    [],
  )

  const nodeGeometry = useMemo(() => new THREE.OctahedronGeometry(0.08, 0), [])
  const nodeMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor('violet'),
        toneMapped: false,
        transparent: true,
        opacity: 0.5,
      }),
    [],
  )

  const lattice = useMemo(() => {
    const rng = makeRng(5150)
    return Array.from({ length: LATTICE_NODES }, () => {
      const a = rng() * Math.PI * 2
      const b = (rng() - 0.5) * Math.PI * 0.7
      const r = 4.2 + rng() * 3.4
      return {
        position: new THREE.Vector3(
          Math.cos(a) * Math.cos(b) * r,
          Math.sin(b) * r * 0.85,
          Math.sin(a) * Math.cos(b) * r,
        ),
        phase: rng() * Math.PI * 2,
        level: Math.floor(rng() * 3),
      }
    })
  }, [])

  const latticeEdges = useMemo(() => {
    // A deterministic subset of edges — enough to read as a ledger without
    // turning the background into a wireframe ball.
    const edges: [[number, number, number], [number, number, number]][] = []
    for (let i = 0; i < lattice.length - 1; i++) {
      const a = lattice[i]
      const b = lattice[i + 1]
      if (a.position.distanceTo(b.position) < 3.4 && a.level !== b.level) {
        edges.push([a.position.toArray() as [number, number, number], b.position.toArray() as [number, number, number]])
      }
    }
    return edges
  }, [lattice])

  useEffect(() => {
    return () => {
      deviceShellGeometry.dispose()
      deviceShellMaterial.dispose()
      screenGeometry.dispose()
      screenMaterial.dispose()
      nodeGeometry.dispose()
      nodeMaterial.dispose()
    }
  }, [deviceShellGeometry, deviceShellMaterial, screenGeometry, screenMaterial, nodeGeometry, nodeMaterial])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useEffect(() => {
    const mesh = latticeRef.current
    if (!mesh) return
    lattice.forEach((node, i) => {
      dummy.position.copy(node.position)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.setScalar(0.7 + node.level * 0.25)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
  }, [lattice, dummy])

  useFrame(() => {
    const local = frame.chapters[index] ?? 0
    const group = root.current
    if (!group) return
    const alive = smoothstep(0, 0.25, local) * (1 - smoothWindow(local, 0.84, 1))
    group.visible = alive > 0.01

    // --- the device turns from portrait toward a perspective angle.
    const device = deviceRef.current
    if (device) {
      const turn = ease.inOut(smoothWindow(local, 0.1, 0.75))
      device.rotation.y = lerp(0, -0.42, turn)
      device.rotation.x = lerp(0, 0.09, turn)
      device.position.y = Math.sin(frame.time * 0.5) * 0.1
      device.position.z = lerp(2.2, 1.4, turn)
      screenMaterial.opacity = alive * (0.1 + turn * 0.12)
    }

    // --- the interface layers separate, each at its own depth.
    const separate = ease.inOut(smoothWindow(local, 0.2, 0.8))
    for (let i = 0; i < MODULES.length; i++) {
      const layer = layerRefs.current[i]
      if (!layer) continue
      const side = i % 2 === 0 ? 1 : -1
      const level = Math.floor(i / 2)
      layer.position.set(
        side * lerp(0.2, 1.5 + level * 0.3, separate),
        lerp(1.2 - level * 0.9, 1.5 - level * 0.8, separate),
        lerp(0.3, -0.4 - level * 0.4, separate),
      )
      layer.rotation.y = side * lerp(0.1, 0.7, separate)
      layer.rotation.z = Math.sin(frame.time * 0.4 + i) * 0.05
      layer.visible = separate > 0.02
    }

    // --- the lattice stays secondary: nodes only pulse while a transfer is in
    // flight, so it never becomes the subject.
    const transfer = smoothWindow(local, 0.3, 0.62)
    const expand = ease.inOut(smoothWindow(local, 0.78, 1))
    nodeMaterial.opacity = alive * (0.12 + transfer * 0.45)
    if (latticeRef.current) {
      latticeRef.current.scale.setScalar(lerp(1, 2.6, expand))
      latticeRef.current.rotation.y = frame.time * 0.08
      latticeRef.current.rotation.x = Math.sin(frame.time * 0.12) * 0.2
    }
  })

  return (
    <group ref={root} position={scene.anchor}>
      {/* The lattice sits behind the device. */}
      <instancedMesh ref={latticeRef} args={[nodeGeometry, nodeMaterial, LATTICE_NODES]} frustumCulled={false} position={[0, 0, -6]} />
      {latticeEdges.map(([a, b], i) => (
        <DataLink key={i} from={a} to={b} accent="violet" intensity={0.16} />
      ))}

      {/* The device. */}
      <group ref={deviceRef} position={[0, 0, 2.2]}>
        <mesh geometry={deviceShellGeometry} material={deviceShellMaterial} />
        <mesh geometry={screenGeometry} material={screenMaterial} position={[0, 0, 0.1]} />
        <HoloLabel position={[0, 2.65, 0]} accent="violet" variant="title" distanceFactor={9}>
          PLEXIFY WEALTH APP
        </HoloLabel>
        <HoloLabel position={[0, -2.55, 0]} accent="violet" variant="technical" distanceFactor={9}>
          REACT NATIVE · REALM · HEDERA
        </HoloLabel>
      </group>

      {/* The interface modules that separate out of the device. */}
      {MODULES.map((label, i) => (
        <group key={label} ref={(node) => { layerRefs.current[i] = node }} visible={false}>
          <PanelSlab
            size={[1.5, 0.9]}
            accent="violet"
            opacity={0.6}
            rotation={[0, 0, (i % 2 === 0 ? 1 : -1) * 0.04]}
          />
          <HoloLabel position={[0, 0.72, 0.1]} accent="violet" variant="technical" distanceFactor={8}>
            {label}
          </HoloLabel>
        </group>
      ))}

      {/* Transfers between the app and the secure-data layer. */}
      <DataLink from={[1.2, 0.6, 1.4]} to={[2.6, 2.4, -3]} accent="violet" intensity={0.5} pulses={3} chapter={index} />
      <DataLink from={[-1.2, -0.6, 1.4]} to={[-2.6, -2.4, -3]} accent="violet" intensity={0.5} pulses={3} chapter={index} />
    </group>
  )
}