'use client'

import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { SCENES } from '@/config/scenes'
import { bell, damp, ease, lerp, noise1 } from '@/lib/math'
import { frame } from '@/lib/store'

/**
 * The single camera rig.
 *
 * Every chapter's `camera` keys are relative to that chapter's anchor, so the
 * rig simply works out which interval the document is in and interpolates
 * between the two keys. That gives "scene progress must be deterministic from
 * scroll position" for the camera, exactly as the master timeline asks.
 *
 * Damping is exponential rather than linear, which is what makes the movement
 * read as a physical camera on a rig instead of a tween. pointerParallax and
 * shake are additive offsets applied *after* the scroll position is resolved,
 * so idle motion never fights GSAP-owned scroll values.
 */

interface CameraRigProps {
  /** Base field of view in degrees. */
  fov?: number
}

export function CameraRig({ fov = 42 }: CameraRigProps) {
  const { camera, size } = useThree()

  const target = useMemo(() => new THREE.Vector3(), [])
  const position = useMemo(() => new THREE.Vector3(), [])
  const lookAt = useMemo(() => new THREE.Vector3(), [])
  const shakeOffset = useMemo(() => new THREE.Vector3(), [])

  // Owns the eased scroll position, so a scroll burst cannot snap the camera.
  const smoothed = useRef(0)
  const initialised = useRef(false)

  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera
    // Narrower viewports need a wider lens or the machines fall out of frame.
    cam.fov = size.width < 768 ? fov + 16 : size.width < 1280 ? fov + 7 : fov
    cam.near = 0.1
    cam.far = 900
    cam.updateProjectionMatrix()
  }, [camera, fov, size.width])

  useFrame((_, dt) => {
    const d = Math.min(0.05, dt)

    if (!initialised.current) {
      smoothed.current = frame.progress
      initialised.current = true
    }
    // Reduced motion keeps scene changes but removes aggressive camera moves.
    const lambda = frame.reducedMotion ? 12 : 3.4
    smoothed.current = damp(smoothed.current, frame.progress, lambda, d)

    const progress = smoothed.current

    // Which interval are we in, and how far through it?
    let index = 0
    for (let i = 0; i < SCENES.length; i++) {
      if (progress < SCENES[i].progressEnd) {
        index = i
        break
      }
      index = i
    }
    const scene = SCENES[index]
    const span = scene.progressEnd - scene.progressStart || 1
    const local = Math.min(1, Math.max(0, (progress - scene.progressStart) / span))

    // power2.inOut — accelerate out of the previous chapter, decelerate into
    // this one, so each interval feels like a deliberate camera move.
    const t = ease.inOut(local)

    const [ax, ay, az] = scene.anchor
    const [sx, sy, sz] = scene.camera.start
    const [ex, ey, ez] = scene.camera.end
    const [tx, ty, tz] = scene.camera.target

    position.set(
      ax + lerp(sx, ex, t),
      ay + lerp(sy, ey, t),
      az + lerp(sz, ez, t),
    )

    // Look-at drifts slightly across the interval so the framing is never
    // completely static even where the keys are level.
    lookAt.set(
      ax + tx + Math.sin(local * Math.PI) * 0.35,
      ay + ty + Math.sin(local * Math.PI * 1.3) * 0.18,
      az + tz,
    )

    // Pointer parallax: small, damped, and disabled under reduced motion.
    if (!frame.reducedMotion) {
      const px = frame.pointer.dx * 0.85
      const py = frame.pointer.dy * 0.5
      position.x += px
      position.y += py
      lookAt.x += px * 0.35
      lookAt.y += py * 0.35
    }

    // Shake, weighted by how close the chapter is to its most active moment so
    // it never sits still *and* never jitters constantly.
    if (scene.shake > 0) {
      const energy = bell(local, 0.3)
      const amount = scene.shake * energy * (frame.reducedMotion ? 0.15 : 1)
      if (amount > 0.001) {
        shakeOffset.set(
          noise1(frame.time * 9.1) * amount * 0.34,
          noise1(frame.time * 7.7 + 31) * amount * 0.26,
          0,
        )
        position.add(shakeOffset)
      }
    }

    // The rig itself is damped after all offsets, so the image is always
    // smooth even when the scroll position itself jumps.
    const cam = camera as THREE.PerspectiveCamera
    const follow = 1 - Math.exp(-(frame.reducedMotion ? 18 : 5.5) * d)
    cam.position.lerp(position, follow)
    target.lerp(lookAt, follow)
    cam.lookAt(target)

    // A slow breath keeps the frame alive when the visitor stops scrolling.
    if (!frame.reducedMotion && frame.sinceScroll > 0.6) {
      const idle = Math.min(1, (frame.sinceScroll - 0.6) / 1.5)
      cam.position.y += Math.sin(frame.time * 0.5) * 0.035 * idle
      cam.position.x += Math.sin(frame.time * 0.37 + 1.2) * 0.025 * idle
    }
  })

  return null
}