'use client'
import { useThree } from '@react-three/fiber'
import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'

gsap.registerPlugin(ScrollTrigger)

export default function CameraController() {
  const { camera } = useThree()

  useEffect(() => {
    gsap.to(camera.position, {
      z: 3,
      scrollTrigger: {
        trigger: '#hero',
        start: 'top top',
        end: 'bottom top',
        scrub: true,
      }
    })
  }, [])

  return null
}