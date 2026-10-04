'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { ease } from '@/lib/math'
import { frame } from '@/lib/store'
import { accentColor, type AccentName } from '@/components/three/materials'

/**
 * Packet flow.
 *
 * The single most reused mechanism in the build: an order packet, a queue
 * capsule, a webhook, a cache lookup, a routing trace — all the same idea of a
 * discrete signal travelling a curved path between two machines.
 *
 * context.txt SCENE 03: "No packet should move linearly; use curved bezier
 * paths and power3.inOut easing." So paths are Catmull-Rom curves, travel is
 * eased with `power3.inOut`, and each packet owns a lane offset so a group of
 * them reads as a flow rather than a single dot.
 *
 * Progress is read from the shared frame store inside `useFrame`. Nothing here
 * re-renders.
 */

export interface PacketFlowProps {
  /** Waypoints in world space. Two or more; curves are built through all of them. */
  waypoints: [number, number, number][]
  /** How many packets share the path. */
  count?: number
  /** Spacing along the path, 0–1, so packets do not overlap. */
  spacing?: number
  accent: AccentName
  /** Chapter index whose local progress drives the flow. */
  chapter: number
  /**
   * How far through the path the flow gets across the chapter. 1 means the
   * lead packet crosses the whole path during the chapter.
   */
  travel?: number
  /** Multiplier on all travel speed. */
  speed?: number
  /** Packet size in world units. */
  size?: number
  /** Continuous idle drift after the scroll-driven packet lands. */
  idle?: boolean
  /** Render as a trailing line as well as a chip. */
  trail?: boolean
  /** Vertical/horizontal squash so the same component reads as a capsule or ribbon. */
  aspect?: [number, number]
}

export function PacketFlow({
  waypoints,
  count = 3,
  spacing = 0.18,
  accent,
  chapter,
  travel = 1,
  speed = 1,
  size = 0.09,
  idle = false,
  trail = false,
  aspect = [1, 1],
}: PacketFlowProps) {
  const groupRef = useRef<THREE.Group>(null)
  const meshRef = useRef<THREE.InstancedMesh>(null)
  const trailRef = useRef<THREE.Line | null>(null)

  const curve = useMemo(() => {
    const points = waypoints.map(([x, y, z]) => new THREE.Vector3(x, y, z))
    if (points.length === 2) {
      // A straight two-point line still needs curvature; lift the midpoint.
      const mid = points[0].clone().lerp(points[1], 0.5)
      mid.y += 1.2
      mid.x += 0.6
      points.splice(1, 0, mid)
    }
    return new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.4)
  }, [waypoints])

  const geometry = useMemo(() => {
    // A low-poly capsule — cheap, reads as a data capsule at any distance.
    return new THREE.CapsuleGeometry(size, size * 2.4, 4, 10)
  }, [size])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        // Instance colours carry the intensity, so the base colour stays the
        // accent itself and setColorAt multiplies cleanly.
        color: accentColor(accent),
        toneMapped: false,
        transparent: true,
        opacity: 0.95,
      }),
    [accent],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const sample = useMemo(() => ({ point: new THREE.Vector3(), tangent: new THREE.Vector3() }), [])
  const positions = useMemo(() => new Float32Array(count * 3), [count])
  const trailGeometry = useMemo(() => new THREE.BufferGeometry(), [])
  const lastProgress = useRef(0)

  useEffect(() => {
    if (trail) {
      trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    }
  }, [positions, trail, trailGeometry, count])

  const trailMaterial = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: accentColor(accent),
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [accent],
  )

  useEffect(() => {
    return () => {
      trailGeometry.dispose()
      trailMaterial.dispose()
    }
  }, [trailGeometry, trailMaterial])

  // Built in JS rather than declared as `<line>`: `line` is an SVG intrinsic in
  // the React JSX namespace, and a primitive also keeps the same geometry object
  // alive while its buffer is rewritten each frame.
  const trailObject = useMemo(() => {
    const object = new THREE.Line(trailGeometry, trailMaterial)
    object.frustumCulled = false
    return object
  }, [trailGeometry, trailMaterial])

  // The ref is written in an effect rather than during render, and the frame
  // loop reads the object from `trailObject` directly.
  useEffect(() => {
    trailRef.current = trailObject
  }, [trailObject])

  useFrame((_, dt) => {
    const mesh = meshRef.current
    if (!mesh) return

    const local = frame.chapters[chapter] ?? 0
    // Scroll owns the head of the flow. Idle motion only picks up the slack
    // once scrolling stops, so the two never fight over the same transform.
    const scrolled = ease.inOut(local) * travel
    const drift = idle && frame.sinceScroll > 0.4 ? Math.sin(frame.time * 0.5) * 0.03 : 0
    const head = scrolled + drift

    // Blend rather than replace, per the master timeline rules.
    const blend = 1 - Math.exp(-6 * dt)
    lastProgress.current += (head - lastProgress.current) * blend
    const headNow = lastProgress.current

    for (let i = 0; i < count; i++) {
      const t = headNow - i * spacing * speed
      // Wrap so packets cycle, but only behind the head — never ahead of it.
      const wrapped = ((t % 1) + 1) % 1
      curve.getPointAt(wrapped, sample.point)
      curve.getTangentAt(wrapped, sample.tangent)

      dummy.position.copy(sample.point)
      // Packets orient along travel, then stretch slightly with speed.
      dummy.quaternion.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, sample.tangent)
      const stretch = 1 + (idle ? Math.sin(frame.time * 6 + i) * 0.12 : 0)
      dummy.scale.set(aspect[0] * stretch, aspect[1] * stretch, 1)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)

      positions[i * 3] = sample.point.x
      positions[i * 3 + 1] = sample.point.y
      positions[i * 3 + 2] = sample.point.z

      // Fade the tail out rather than popping it at the wrap point.
      const fade = i / (count + 1)
      mesh.setColorAt(i, tmpColor.copy(accentColor(accent)).multiplyScalar(0.5 + (1 - fade) * 2.6))
    }

    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true

    if (trail && trailRef.current) {
      trailGeometry.attributes.position.needsUpdate = true
      const mat = trailRef.current.material as THREE.LineBasicMaterial
      mat.opacity = 0.12 + Math.min(0.4, headNow) * 0.4
    }
  })

  return (
    <group ref={groupRef}>
      <instancedMesh ref={meshRef} args={[geometry, material, count]} frustumCulled={false} />
      {trail ? <primitive object={trailObject} /> : null}
    </group>
  )
}

const tmpColor = new THREE.Color()