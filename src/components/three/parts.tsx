'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { accentColor, shellMaterial, type AccentName } from '@/components/three/materials'
import { ease, lerp, makeRng, smoothstep } from '@/lib/math'
import { frame } from '@/lib/store'

/**
 * The parts bin.
 *
 * Fourteen chapters share a small vocabulary of physical objects: machines,
 * towers, rails, panels, ribbons, capsules. They live here so each scene file
 * stays about its own idea rather than re-deriving geometry and materials, and
 * so performance guidance stays enforceable in one place — geometries are
 * memoised per size, materials are shared instances, and nothing here allocates
 * inside `useFrame`.
 *
 * context.txt is the reason these are all *machinery*. Rails, bridges, vaults,
 * machines, terminals, access towers, control rooms and data cores are the
 * sanctioned metaphors, and they are easier to build coherently than a fresh
 * visual idea per chapter.
 */

/* ------------------------------------------------------------------ */
/* Machine block — the base unit of every scene.                        */
/* ------------------------------------------------------------------ */

export interface MachineBlockProps {
  position?: [number, number, number]
  size?: [number, number, number]
  accent?: AccentName
  /** Edge trim brightness, 0–1. Reserved for key edges. */
  trim?: number
  /** Interior glow, 0–1. Reserved for active data. */
  core?: number
  /** Idle breathing amplitude. Keeps the object from being static. */
  idle?: number
  /** Scene-local rotation applied to the whole block. */
  spin?: number
  seed?: number
}

export function MachineBlock({
  position = [0, 0, 0],
  size = [2, 2, 2],
  accent = 'cyan',
  trim = 0.35,
  core = 0.2,
  idle = 0.05,
  spin = 0,
  seed = 0,
}: MachineBlockProps) {
  const group = useRef<THREE.Group>(null)
  // 0.05 was authored as if it were an emissive value; multiplied by scene
  // lighting it renders at 3/255, which is not "dark", it is absent.
  const shell = useMemo(() => shellMaterial(0.21), [])
  const inner = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor(accent), toneMapped: false, transparent: true, opacity: 0.25 }),
    [accent],
  )
  const edge = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor(accent),
        toneMapped: false,
        transparent: true,
        opacity: 0.5,
        wireframe: true,
      }),
    [accent],
  )

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const innerGeometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])

  useEffect(() => {
    return () => {
      shell.dispose()
      inner.dispose()
      edge.dispose()
      geometry.dispose()
      innerGeometry.dispose()
    }
  }, [shell, inner, edge, geometry, innerGeometry])

  useFrame(() => {
    const g = group.current
    if (!g) return
    // Idle motion lives only on Y rotation and a small vertical breath, so the
    // scroll timeline can own X/Z and scale without a fight.
    g.rotation.y = spin + Math.sin(frame.time * 0.35 + seed) * idle
    g.position.y = position[1] + Math.sin(frame.time * 0.6 + seed * 1.7) * idle * 0.25
    inner.opacity = 0.1 + core * 0.55
    edge.opacity = 0.18 + trim * 0.5
  })

  const [w, h, d] = size
  return (
    <group ref={group} position={position}>
      <mesh geometry={geometry} material={shell} scale={[w, h, d]} />
      <mesh geometry={innerGeometry} material={inner} scale={[w * 0.82, h * 0.82, d * 0.82]} />
      <mesh geometry={innerGeometry} material={edge} scale={[w * 1.005, h * 1.005, d * 1.005]} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Service tower — SCENE 03.                                           */
/* ------------------------------------------------------------------ */

export interface ServiceTowerProps {
  position: [number, number, number]
  height: number
  width?: number
  accent?: AccentName
  /** 0–1 how much traffic is passing through this tower. */
  load?: number
  seed?: number
}

/**
 * "Towers are black glass with translucent interiors." The interior band is
 * what makes them read as occupied rather than decorative — it brightens with
 * traffic, so the city visibly runs when packets move.
 */
export function ServiceTower({ position, height, width = 1.4, accent = 'green', load = 0.3, seed = 0 }: ServiceTowerProps) {
  const interior = useRef<THREE.Mesh>(null)
  const rim = useRef<THREE.Mesh>(null)

  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const glass = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0.0504, 0.0672, 0.1176),
        metalness: 0.95,
        roughness: 0.18,
        transmission: 0.22,
        thickness: 0.6,
        transparent: true,
      }),
    [],
  )
  const light = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor(accent),
        toneMapped: false,
        transparent: true,
        opacity: 0.4,
      }),
    [accent],
  )
  const rimMaterial = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor(accent), toneMapped: false, transparent: true, opacity: 0.8 }),
    [accent],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      glass.dispose()
      light.dispose()
      rimMaterial.dispose()
    }
  }, [geometry, glass, light, rimMaterial])

  useFrame(() => {
    // Traffic climbs the tower, so the interior band scrolls upward. It reads
    // as work in progress rather than a pulsing light.
    if (interior.current) {
      const material = interior.current.material as THREE.MeshBasicMaterial
      material.opacity = (0.16 + load * 0.5) * (0.6 + 0.4 * Math.sin(frame.time * 1.4 + seed))
      interior.current.position.y = ((frame.time * 0.5 + seed) % 1 - 0.5) * height * 0.6
    }
    if (rim.current) {
      const material = rim.current.material as THREE.MeshBasicMaterial
      material.opacity = 0.35 + load * 0.5
    }
  })

  return (
    <group position={position}>
      <mesh geometry={geometry} material={glass} position={[0, height / 2, 0]} scale={[width, height, width]} />
      <mesh ref={interior} geometry={geometry} material={light} scale={[width * 0.6, height * 0.22, width * 0.6]} />
      <mesh ref={rim} geometry={geometry} material={rimMaterial} position={[0, height, 0]} scale={[width * 1.08, 0.06, width * 1.08]} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Rail — SCENE 05.                                                    */
/* ------------------------------------------------------------------ */

export interface RailProps {
  position: [number, number, number]
  length?: number
  radius?: number
  accent?: AccentName
  rotation?: [number, number, number]
  /** Ring density along the rail. */
  segments?: number
}

/**
 * A transparent queue rail. Rendered as a tube shell plus evenly spaced rings,
 * so a capsule travelling inside it is clearly *inside a queue* rather than
 * near one.
 */
export function Rail({
  position,
  length = 10,
  radius = 0.55,
  accent = 'violet',
  rotation = [0, 0, 0],
  segments = 16,
}: RailProps) {
  const rings = useRef<THREE.InstancedMesh>(null)

  const shell = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor(accent),
        toneMapped: false,
        transparent: true,
        opacity: 0.09,
        side: THREE.DoubleSide,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    [accent],
  )
  const ringMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor(accent),
        toneMapped: false,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [accent],
  )
  const tubeGeometry = useMemo(() => new THREE.CylinderGeometry(radius, radius, length, 20, 1, true), [radius, length])
  const ringGeometry = useMemo(() => new THREE.TorusGeometry(radius * 0.96, 0.012, 4, 18), [radius])

  useEffect(() => {
    const mesh = rings.current
    if (!mesh) return
    const dummy = new THREE.Object3D()
    for (let i = 0; i < segments; i++) {
      const t = (i / (segments - 1) - 0.5) * length
      dummy.position.set(0, t, 0)
      dummy.rotation.set(Math.PI / 2, 0, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [segments, length])

  useEffect(() => {
    return () => {
      shell.dispose()
      ringMaterial.dispose()
      tubeGeometry.dispose()
      ringGeometry.dispose()
    }
  }, [shell, ringMaterial, tubeGeometry, ringGeometry])

  useFrame(() => {
    shell.opacity = 0.05 + frame.presence * 0.07
    ringMaterial.opacity = 0.18 + frame.presence * 0.25
  })

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={tubeGeometry} material={shell} />
      <instancedMesh ref={rings} args={[ringGeometry, ringMaterial, segments]} frustumCulled={false} />
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Capsule — queue events, packets, shards.                             */
/* ------------------------------------------------------------------ */

export interface CapsuleProps {
  position: [number, number, number]
  accent?: AccentName
  scale?: number
  /** 0–1 brightness. */
  intensity?: number
  /** Slowly rotates in place so it never reads as a still image. */
  spin?: boolean
}

export function Capsule({ position, accent = 'violet', scale = 1, intensity = 1, spin = true }: CapsuleProps) {
  const ref = useRef<THREE.Group>(null)
  const geometry = useMemo(() => new THREE.CapsuleGeometry(0.12 * scale, 0.26 * scale, 4, 10), [scale])
  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor(accent),
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
      }),
    [accent],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame(() => {
    if (ref.current && spin) {
      ref.current.rotation.x = frame.time * 0.9
      ref.current.rotation.z = frame.time * 0.6
    }
    material.opacity = (0.55 + 0.45 * Math.sin(frame.time * 3 + position[0])) * intensity
  })

  return <group ref={ref} position={position}>
    <mesh geometry={geometry} material={material} />
  </group>
}

/* ------------------------------------------------------------------ */
/* Panel slab — SCENE 09 project plaques, SCENE 12 diagnostic windows. */
/* ------------------------------------------------------------------ */

export interface PanelSlabProps {
  /** Local position. Defaults to the origin, so a slab can be parented. */
  position?: [number, number, number]
  size?: [number, number]
  accent?: AccentName
  /** 0–1 opacity. */
  opacity?: number
  rotation?: [number, number, number]
  /** Adds a bright inset "display area" — a screen rather than a blank plate. */
  screen?: boolean
  radius?: number
}

/**
 * A rounded glass-metal rectangle. Built from an extruded rounded shape so the
 * corners catch light like real plate glass; the inset screen is a separate
 * plane so it can glow without making the whole slab glow.
 */
export function PanelSlab({
  position = [0, 0, 0],
  size = [3, 2],
  accent = 'cyan',
  opacity = 0.5,
  rotation = [0, 0, 0],
  screen = true,
  radius = 0.12,
}: PanelSlabProps) {
  const geometry = useMemo(() => {
    const [w, h] = size
    const r = Math.min(radius, Math.min(w, h) * 0.2)
    const shape = new THREE.Shape()
    const x = -w / 2
    const y = -h / 2
    shape.moveTo(x + r, y)
    shape.lineTo(x + w - r, y)
    shape.quadraticCurveTo(x + w, y, x + w, y + r)
    shape.lineTo(x + w, y + h - r)
    shape.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    shape.lineTo(x + r, y + h)
    shape.quadraticCurveTo(x, y + h, x, y + h - r)
    shape.lineTo(x, y + r)
    shape.quadraticCurveTo(x, y, x + r, y)
    return new THREE.ExtrudeGeometry(shape, { depth: 0.06, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 })
  }, [size, radius])

  const material = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0.084, 0.1092, 0.168),
        metalness: 0.92,
        roughness: 0.2,
        transmission: 0.28,
        thickness: 0.4,
        transparent: true,
        opacity,
      }),
    [opacity],
  )

  const screenMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor(accent),
        toneMapped: false,
        transparent: true,
        opacity: 0.14,
      }),
    [accent],
  )

  const screenGeometry = useMemo(() => new THREE.PlaneGeometry(size[0] * 0.82, size[1] * 0.7), [size])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
      screenMaterial.dispose()
      screenGeometry.dispose()
    }
  }, [geometry, material, screenMaterial, screenGeometry])

  useFrame(() => {
    screenMaterial.opacity = (screen ? 0.09 : 0) + 0.06 * (0.5 + 0.5 * Math.sin(frame.time * 1.1))
  })

  return (
    <group position={position} rotation={rotation}>
      <mesh geometry={geometry} material={material} />
      {screen ? (
        <mesh geometry={screenGeometry} material={screenMaterial} position={[0, size[1] * 0.08, 0.09]} />
      ) : null}
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Ribbon — SCENE 07 ERP bridge.                                        */
/* ------------------------------------------------------------------ */

export interface RibbonProps {
  /** Control points of the ribbon spine. */
  points: [number, number, number][]
  accent?: AccentName
  width?: number
  /** 0–1 opacity. */
  opacity?: number
  /** Animates a travelling highlight along the ribbon — the scanning beam. */
  scan?: boolean
  segments?: number
}

/**
 * The animated data ribbon between the two ERP terminals.
 *
 * Rendered as a thin extruded strip rather than a tube so it reads as a
 * flexible data carrier, and vertex-displaced every frame by a sine so it
 * genuinely ripples. Vertex positions are rewritten in place — no allocation.
 */
export function Ribbon({ points, accent = 'violet', width = 0.16, opacity = 0.7, scan = true, segments = 90 }: RibbonProps) {
  const geometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(
      points.map(([x, y, z]) => new THREE.Vector3(x, y, z)),
      false,
      'catmullrom',
      0.5,
    )
    const g = new THREE.PlaneGeometry(1, 1, segments, 1)
    g.userData.curve = curve
    return g
  }, [points, segments])

  const material = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor(accent),
        toneMapped: false,
        transparent: true,
        opacity,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [accent, opacity],
  )

  const base = useMemo(() => Float32Array.from(geometry.attributes.position.array as Float32Array), [geometry])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  

  const scratch = useMemo(() => new THREE.Vector3(), [])
  const tangent = useMemo(() => new THREE.Vector3(), [])
  const side = useMemo(() => new THREE.Vector3(), [])

  useFrame(() => {
    const curve = geometry.userData.curve as THREE.CatmullRomCurve3
    const position = geometry.attributes.position
    const array = position.array as Float32Array

    for (let i = 0; i < position.count; i++) {
      // PlaneGeometry(1, 1, segments, 1) lays out two rows of vertices, so the
      // original x of -0.5 / 0.5 gives us both the station along the ribbon and
      // which side of it the vertex belongs to.
      const across = base[i * 2]
      const u = across + 0.5
      curve.getPointAt(u, scratch)
      curve.getTangentAt(u, tangent)

      // Perpendicular in the ribbon's own plane, so the strip twists with the
      // curve instead of shearing through it.
      side.set(-tangent.y, tangent.x, 0).normalize().multiplyScalar(across * width)

      const ripple = Math.sin(u * 9 + frame.time * 1.8) * 0.06 * Math.sin(u * Math.PI)
      const beam = scan ? smoothstep(0.06, 0.0, Math.abs(((frame.time * 0.28 + 0.1) % 1) - u)) : 0

      array[i * 3] = scratch.x + side.x
      array[i * 3 + 1] = scratch.y + side.y + ripple + beam * 0.12
      array[i * 3 + 2] = scratch.z + side.z + Math.sin(u * 6 - frame.time * 1.2) * 0.05
    }
    position.needsUpdate = true
    geometry.computeVertexNormals()
    material.opacity = opacity * (0.55 + frame.presence * 0.45)
  })

  return <mesh geometry={geometry} material={material} frustumCulled={false} />
}

/* ------------------------------------------------------------------ */
/* Hex core — SCENE 06 API core.                                        */
/* ------------------------------------------------------------------ */

export function HexCore({
  position,
  radius = 1.2,
  accent = 'cyan',
  spin = 0.25,
}: {
  position: [number, number, number]
  radius?: number
  accent?: AccentName
  spin?: number
}) {
  const outer = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)

  const geometry = useMemo(() => new THREE.CylinderGeometry(radius, radius, radius * 0.35, 6), [radius])
  const innerGeometry = useMemo(() => new THREE.IcosahedronGeometry(radius * 0.52, 1), [radius])

  const shell = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(0.084, 0.126, 0.21),
        metalness: 0.95,
        roughness: 0.15,
        transmission: 0.4,
        thickness: 0.5,
        transparent: true,
      }),
    [],
  )
  const glow = useMemo(
    () => new THREE.MeshBasicMaterial({ color: accentColor(accent), toneMapped: false, transparent: true, opacity: 0.55 }),
    [accent],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      innerGeometry.dispose()
      shell.dispose()
      glow.dispose()
    }
  }, [geometry, innerGeometry, shell, glow])

  useFrame(() => {
    // Two counter-rotating shells: mechanical, not a spinning ball.
    if (outer.current) outer.current.rotation.y = frame.time * spin
    if (inner.current) {
      inner.current.rotation.y = -frame.time * spin * 1.7
      inner.current.rotation.x = frame.time * spin * 0.6
      glow.opacity = 0.35 + frame.presence * 0.35
    }
  })

  return (
    <group position={position}>
      <group ref={outer}>
        <mesh geometry={geometry} material={shell} />
      </group>
      <group ref={inner}>
        <mesh geometry={innerGeometry} material={glow} />
      </group>
    </group>
  )
}

/* ------------------------------------------------------------------ */
/* Grid floor — architectural reference grids.                           */
/* ------------------------------------------------------------------ */

export function GridFloor({
  position = [0, -5.9, 0],
  size = 60,
  divisions = 30,
  accent = 'cyan',
  opacity = 0.14,
}: {
  position?: [number, number, number]
  size?: number
  divisions?: number
  accent?: AccentName
  opacity?: number
}) {
  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    const half = size / 2
    const step = size / divisions
    const vertices: number[] = []
    for (let i = 0; i <= divisions; i++) {
      const p = -half + i * step
      vertices.push(-half, 0, p, half, 0, p)
      vertices.push(p, 0, -half, p, 0, half)
    }
    g.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    return g
  }, [size, divisions])

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: accentColor(accent),
        transparent: true,
        opacity,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [accent, opacity],
  )

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  useFrame(() => {
    material.opacity = opacity * (0.4 + frame.presence * 0.6)
  })

  return <lineSegments geometry={geometry} material={material} position={position} />
}

/* ------------------------------------------------------------------ */
/* Instance scatter — cheap background detail.                          */
/* ------------------------------------------------------------------ */

/**
 * Deterministic instanced clutter: vents, conduits, small housings. Used to
 * give machines surface detail without a mesh per fitting.
 */
export function DetailScatter({
  position,
  count = 40,
  extent = [8, 4, 6],
  accent = 'cyan',
  seed = 7,
  scale = 0.18,
}: {
  position: [number, number, number]
  count?: number
  extent?: [number, number, number]
  accent?: AccentName
  seed?: number
  scale?: number
}) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const geometry = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: new THREE.Color(0.168, 0.21, 0.336),
        metalness: 0.8,
        roughness: 0.5,
        emissive: accentColor(accent).multiplyScalar(0.06),
      }),
    [accent],
  )

  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const rng = makeRng(seed)
    const dummy = new THREE.Object3D()
    for (let i = 0; i < count; i++) {
      dummy.position.set(
        (rng() - 0.5) * extent[0],
        (rng() - 0.5) * extent[1],
        (rng() - 0.5) * extent[2],
      )
      const s = scale * (0.5 + rng())
      dummy.scale.set(s, s * (0.4 + rng() * 2.5), s)
      dummy.rotation.set(0, rng() * Math.PI, 0)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
  }, [count, extent, seed, scale])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
    }
  }, [geometry, material])

  return <instancedMesh ref={ref} args={[geometry, material, count]} position={position} frustumCulled={false} />
}

export { ease, lerp }