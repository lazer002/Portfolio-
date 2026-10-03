'use client'
import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import * as THREE from 'three'

gsap.registerPlugin(ScrollTrigger)

export default function MainModel() {
  const ref = useRef<THREE.Mesh>(null!)

  // 🎮 Mouse + idle motion
  useFrame(({ mouse }) => {
    if (!ref.current) return

    // base slow rotation
    ref.current.rotation.y += 0.002

    // mouse parallax (smooth)
    ref.current.rotation.x = THREE.MathUtils.lerp(
      ref.current.rotation.x,
      mouse.y * 0.3,
      0.05
    )

    ref.current.rotation.z = THREE.MathUtils.lerp(
      ref.current.rotation.z,
      mouse.x * 0.2,
      0.05
    )
  })

  // 🎬 Scroll animation
useEffect(() => {
  if (!ref.current) return

  const ctx = gsap.context(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: '#container',
        start: 'top top',
        end: '+=3000',
        scrub: true,
      }
    })

    // HERO
    tl.to(ref.current.rotation, {
      y: Math.PI * 2,
      ease: 'power3.inOut'
    })

    tl.to(ref.current.position, {
      z: -3,
      ease: 'power3.inOut'
    }, 0)

    // IMMERSION → push model away
 // IMMERSION → push away + tilt
tl.to(ref.current.position, {
  z: -12,
  y: -2,
  ease: 'power3.inOut'
})

// slight rotation change (losing focus)
tl.to(ref.current.rotation, {
  x: 1,
  ease: 'power3.inOut'
}, 0)

  })

  return () => ctx.revert()
}, [])
  return (
    <mesh ref={ref}>
      <torusKnotGeometry args={[1.5, 0.4, 200, 32]} />
      <meshPhysicalMaterial
        transmission={1}
        roughness={0}
        thickness={2}
        envMapIntensity={2}
        color="#00ffff"
      />
    </mesh>
  )
}