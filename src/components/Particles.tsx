'use client'
import { useMemo, useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function Particles() {
  const ref = useRef<THREE.Points>(null!)
  const count = 4000

  // 🌌 positions
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 40
      arr[i * 3 + 1] = (Math.random() - 0.5) * 40
      arr[i * 3 + 2] = (Math.random() - 0.5) * 40
    }

    return arr
  }, [])

  // ✨ material (better look)
  const material = useMemo(() => {
    return new THREE.PointsMaterial({
      size: 0.04,
      color: '#00ffff',
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  }, [])

  // 🎮 idle motion
  useFrame(() => {
    if (!ref.current) return
    
ref.current.position.z = Math.sin(Date.now() * 0.0002) * 0.2
    ref.current.rotation.y += 0.0004
    ref.current.rotation.x += 0.00015
  })

  // 🎬 scroll interaction (for next sections)
useEffect(() => {
  if (!ref.current) return

  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#container',
      start: 'top top',
      end: '+=3000',
      scrub: true,
    }
  })

  // HERO
// HERO
tl.to(ref.current.scale, {
  x: 1.2,
  y: 1.2,
  z: 1.2,
  ease: 'power3.inOut'
})

// IMMERSION → surround user
tl.to(ref.current.scale, {
  x: 3,
  y: 3,
  z: 3,
  ease: 'power3.inOut'
})

// slight rotation increase (feels alive)
tl.to(ref.current.rotation, {
  y: 0.5,
  ease: 'power2.inOut'
}, 0)

}, [])

  return (
    <points ref={ref}>
      <bufferGeometry>
<bufferAttribute
  attach="attributes-position"
  args={[positions, 3]}
/>
      </bufferGeometry>

      <primitive object={material} attach="material" />
    </points>
  )
}