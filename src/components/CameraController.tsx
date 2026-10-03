'use client'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function CameraController() {
  const { camera } = useThree()

useEffect(() => {
  const tl = gsap.timeline({
    scrollTrigger: {
      trigger: '#container',
      start: 'top top',
      end: '+=3000',
      scrub: true,
    }
  })

  // 🎬 HERO
  tl.to(camera.position, {
    z: 4,
    y: 0.5,
    ease: 'power3.inOut'
  })

  // 🌀 IMMERSION (dive)
  tl.to(camera.position, {
    z: 0.2,   // deeper (better immersion)
    y: 0,
    ease: 'power3.inOut'
  })

  // 🎥 subtle cinematic drift
  tl.to(camera.position, {
    x: 0.8,
    ease: 'power2.inOut'
  })

}, [])

  return null
}