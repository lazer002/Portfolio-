'use client'
import { Canvas } from '@react-three/fiber'
import { Environment } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'

import MainModel from './MainModel'
import Particles from './Particles'
import CameraController from './CameraController'

export default function Scene() {
  return (
    <Canvas camera={{ position: [0, 0, 8] }}>
      <ambientLight intensity={0.5} />
      <Environment preset="city" />

      <MainModel />
      <Particles />

      <EffectComposer>
        <Bloom intensity={1.5} />
      </EffectComposer>

      <CameraController />
    </Canvas>
  )
}