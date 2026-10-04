'use client'

import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { frame } from '@/lib/store'
import { accentColor, type AccentName } from '@/components/three/materials'

/**
 * A single data link: one luminous line between two machines.
 *
 * Used for hover connections (SCENE 02), matrix edges (SCENE 13), routing
 * traces (SCENE 11) and request paths (SCENE 08). The line is a single
 * `Line`; the signal is a small instanced set of pulses travelling along it,
 * so an idle link reads as *idle* rather than dead.
 *
 * Endpoints and intensity are exposed imperatively. Hover-driven links need to
 * track a module that is itself moving, and rebuilding the curve through React
 * props on every hover frame would mean a re-render per frame — exactly the
 * pattern the rest of the build avoids. Instead the sampled line is written
 * into the existing buffer, and only when an endpoint has actually moved.
 */

export interface DataLinkHandle {
  /** Moves the link. Writes into the existing buffer; no allocation. */
  move: (from: THREE.Vector3, to: THREE.Vector3, bow?: number) => void
  /** 0–1 brightness, normally hover state. */
  setIntensity: (value: number) => void
  /** Turns the travelling pulses on or off. */
  setPulses: (value: number) => void
}

export interface DataLinkProps {
  from: [number, number, number]
  to: [number, number, number]
  accent: AccentName
  /** Baseline brightness, before any imperative override. */
  intensity?: number
  /** Pulses travelling the link. 0 for structural edges. */
  pulses?: number
  /** Chapter index driving the pulse timing; omit for continuous idle motion. */
  chapter?: number
  /** Curve the link outward so overlapping links stay distinguishable. */
  bow?: number
  /** Fade the link in as the owning chapter approaches. */
  active?: boolean
  /** Distance the endpoint must move before the buffer is rewritten. */
  threshold?: number
}

const SAMPLES = 40

/**
 * The line is constructed in JS rather than declared as a `<line>` element:
 * `line` collides with the SVG intrinsic in the React JSX namespace, and a
 * primitive is also the only way to keep the same geometry object across
 * re-renders while its buffer is rewritten in place.
 */
const DataLink = forwardRef<DataLinkHandle, DataLinkProps>(function DataLink(
  {
    from,
    to,
    accent,
    intensity = 1,
    pulses = 0,
    chapter,
    bow = 0.12,
    active = true,
    threshold = 0.01,
  },
  ref,
) {
  const lineRef = useRef<THREE.Line>(null)
  const pulseRef = useRef<THREE.InstancedMesh>(null)

  const state = useRef({ intensity, pulses, from: new THREE.Vector3(...from), to: new THREE.Vector3(...to), bow })
  const curve = useMemo(() => new THREE.QuadraticBezierCurve3(state.current.from, state.current.from, state.current.to), [])
  const scratch = useMemo(
    () => ({
      a: new THREE.Vector3(),
      b: new THREE.Vector3(),
      p: new THREE.Vector3(),
      dir: new THREE.Vector3(),
      dummy: new THREE.Object3D(),
    }),
    [],
  )

  const geometry = useMemo(() => {
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array((SAMPLES + 1) * 3), 3))
    // Sampled once up front so the very first frame already shows the link —
    // `g`, not `geometry`, which is still in its temporal dead zone here.
    writeLine(curve, g)
    return g
  }, [curve])

  const material = useMemo(
    () =>
      new THREE.LineBasicMaterial({
        color: accentColor(accent),
        transparent: true,
        opacity: 0.3,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [accent],
  )

  const pulseGeometry = useMemo(() => new THREE.SphereGeometry(0.035, 6, 6), [])
  const pulseMaterial = useMemo(
    () =>
      new THREE.MeshBasicMaterial({
        color: accentColor(accent),
        toneMapped: false,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    [accent],
  )

  useImperativeHandle(
    ref,
    () => ({
      move(nextFrom, nextTo, nextBow) {
        const s = state.current
        const nextBowValue = nextBow ?? s.bow
        // Only resample when something genuinely changed. Rebuilding a
        // 40-segment line every frame for nothing would be wasted work.
        const changed =
          s.from.distanceToSquared(nextFrom) > threshold * threshold ||
          s.to.distanceToSquared(nextTo) > threshold * threshold ||
          nextBowValue !== s.bow
        if (!changed) return

        s.from.copy(nextFrom)
        s.to.copy(nextTo)
        s.bow = nextBowValue

        curve.v0.copy(s.from)
        curve.v2.copy(s.to)
        curve.v1.copy(s.from).lerp(s.to, 0.5)
        // Bow perpendicular to the link so a bundle of edges fans out cleanly.
        scratch.dir.subVectors(s.to, s.from)
        curve.v1.x += -scratch.dir.z * s.bow * 0.5
        curve.v1.y += scratch.dir.length() * s.bow * 0.5
        writeLine(curve, geometry)
      },
      setIntensity(value) {
        state.current.intensity = value
      },
      setPulses(value) {
        state.current.pulses = value
      },
    }),
    [curve, geometry, threshold, scratch],
  )

  useEffect(() => {
    state.current.from.set(...from)
    state.current.to.set(...to)
    state.current.bow = bow
    curve.v0.set(...from)
    curve.v2.set(...to)
    curve.v1.copy(curve.v0).lerp(curve.v2, 0.5)
    writeLine(curve, geometry)
  }, [from, to, bow, curve, geometry])

  useEffect(() => {
    return () => {
      geometry.dispose()
      material.dispose()
      pulseGeometry.dispose()
      pulseMaterial.dispose()
    }
  }, [geometry, material, pulseGeometry, pulseMaterial])

  // The THREE.Line object is created once and kept for the life of the
  // component, so its buffer can be rewritten in place every frame.
  const line = useMemo(() => {
    const object = new THREE.Line(geometry, material)
    object.frustumCulled = false
    lineRef.current = object
    return object
  }, [geometry, material])

  useFrame(() => {
    const s = state.current
    const gate = active ? frame.presence : 0
    const target = s.intensity * gate
    material.opacity = 0.05 + target * 0.4
    if (lineRef.current) lineRef.current.visible = material.opacity > 0.012

    const mesh = pulseRef.current
    if (!mesh) return
    const count = s.pulses
    mesh.visible = count > 0 && target > 0.05
    if (!mesh.visible) return

    const scrollPhase = chapter === undefined ? 0 : (frame.chapters[chapter] ?? 0)
    const rate = chapter === undefined ? 0.35 : 0.9

    for (let i = 0; i < MAX_PULSES; i++) {
      if (i >= count) {
        // Park unused instances out of sight rather than resizing the buffer.
        scratch.dummy.position.set(0, -9999, 0)
        scratch.dummy.scale.setScalar(0.0001)
      } else {
        const phase = ((frame.time * rate + scrollPhase + i / count) % 1 + 1) % 1
        curve.getPointAt(phase, scratch.p)
        scratch.dummy.position.copy(scratch.p)
        scratch.dummy.scale.setScalar(1 + Math.sin(frame.time * 8 + i) * 0.18)
      }
      scratch.dummy.updateMatrix()
      mesh.setMatrixAt(i, scratch.dummy.matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    pulseMaterial.opacity = target * 0.85
  })

  const pulseCount = Math.max(pulses, MAX_PULSES)

  return (
    <group>
      <primitive object={line} />
      <instancedMesh
        ref={pulseRef}
        args={[pulseGeometry, pulseMaterial, pulseCount]}
        frustumCulled={false}
        visible={false}
      />
    </group>
  )
})

export { DataLink }

const MAX_PULSES = 6

/** Resamples the curve into the line buffer. Writes in place; allocates nothing. */
const writePoint = new THREE.Vector3()

function writeLine(curve: THREE.QuadraticBezierCurve3, geometry: THREE.BufferGeometry): void {
  const attribute = geometry.getAttribute('position') as THREE.BufferAttribute
  const array = attribute.array as Float32Array
  for (let i = 0; i <= SAMPLES; i++) {
    curve.getPointAt(i / SAMPLES, writePoint)
    array[i * 3] = writePoint.x
    array[i * 3 + 1] = writePoint.y
    array[i * 3 + 2] = writePoint.z
  }
  attribute.needsUpdate = true
}