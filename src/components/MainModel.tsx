'use client'
import { useRef, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function MainModel() {
  const ref = useRef()

  useFrame(() => {
    ref.current.rotation.y += 0.005
  })

  useEffect(() => {
    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: 'body',
        start: 'top top',
        end: 'bottom bottom',
        scrub: true,
      }
    })

    tl.to(ref.current.rotation, {
      x: Math.PI * 2,
      y: Math.PI * 2,
    })

    tl.to(ref.current.position, {
      y: -8,
      z: -5,
    }, 0)

  }, [])

  return (
    <mesh ref={ref}>
      <torusKnotGeometry args={[1.5, 0.4, 200, 32]} />
      <meshPhysicalMaterial transmission={1} roughness={0} thickness={2} />
    </mesh>
  )
}