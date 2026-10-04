'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

import { CameraRig } from '@/components/three/CameraRig'
import { FrameGovernor } from '@/components/three/FrameGovernor'
import { Cityscape } from '@/components/three/Cityscape'
import { DataParticles } from '@/components/three/DataParticles'
import { Post } from '@/components/three/Post'
import { SceneHost } from '@/components/three/SceneHost'
import { buildEnvironment } from '@/components/three/materials'
import { detectCapabilities, type Capabilities } from '@/lib/device'

/**
 * The WebGL world.
 *
 * One `<Canvas>` for the entire experience — fourteen scenes sharing a single
 * renderer, a single camera rig and a single postprocessing chain. The
 * alternative, one canvas per chapter, would mean fourteen WebGL contexts, which
 * browsers cap at around sixteen and which would exhaust GPU memory long before
 * that.
 *
 * Layers, deliberately separated:
 *  - `Cityscape` and `DataParticles` are the world. They persist across the
 *    whole session and are what makes the fourteen chapters feel like one
 *    continuous space rather than fourteen stages.
 *  - `SceneHost` is the chapters, mounted in a window.
 *  - `CameraRig` owns the viewpoint. Nothing else moves the camera.
 */

/**
 * A single point light that rides with the camera.
 *
 * One light per chapter would mean fourteen lights in the scene graph. This one
 * is repositioned to the active chapter's anchor every frame, so the machine
 * always sits in a pool of its own light, and the light count stays at one.
 */
function CameraLight() {
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ camera }) => {
    const l = light.current
    if (!l) return
    // Slightly ahead of the camera, looking back down at the subject.
    l.position.set(camera.position.x, camera.position.y - 1.2, camera.position.z + 4)
  })
  return <pointLight ref={light} intensity={1.6} distance={18} decay={2} color="#22e6ff" />
}

/** Applies the generated environment map so glass reads as glass. */
function Environment() {
  const { gl, scene } = useThree()
  useEffect(() => {
    const texture = buildEnvironment(gl)
    scene.environment = texture
    return () => {
      scene.environment = null
      texture.dispose()
    }
  }, [gl, scene])
  return null
}

/**
 * A very dark, restrained lighting rig.
 *
 * context.txt: "Most surfaces are dark and restrained. Glow is reserved for
 * active data, interaction and key edges." So the lighting exists to give the
 * glass something to reflect, not to illuminate a scene.
 */
/**
 * A dark, restrained lighting rig — but not *so* dark that the geometry
 * disappears.
 *
 * context.txt: "Most surfaces are dark and restrained. Glow is reserved for
 * active data, interaction and key edges." That is a palette instruction, not a
 * licence to render at 3/255. The surfaces still have to be legible as
 * architecture, so the rig sits well above the point where black glass stops
 * reading as glass. Each source is tinted from the four-accent palette; none of
 * them introduces a fifth colour.
 */
function Lights() {
  return (
    <>
      {/* Ambient carries the dark surfaces just enough to read as form rather
          than silhouette. Any higher and the palette stops being "dark". */}
      <ambientLight intensity={0.3} color="#8fb4d8" />
      <hemisphereLight args={['#7fb0d8', '#0a1018', 0.22]} />
      {/* Key light: the cool overhead wash that defines edges. */}
      <directionalLight position={[6, 9, 4]} intensity={1.5} color="#bfe6ff" />
      {/* Fill from the opposite side, in violet, so shadow sides are not dead. */}
      <directionalLight position={[-7, 2, -5]} intensity={0.6} color="#a06bff" />
      {/*
        Rim from behind, in acid green, to separate silhouettes from the fog.

        Positioned level with its subject rather than above it. A light placed
        high and behind projects a bright elliptical pool onto the floor plane,
        and because the floor is large and metallic that pool became the single
        brightest thing in every frame — a green blob with the actual scene
        hidden behind it. A rim light's job is to graze the silhouette, not to
        illuminate the ground.
      */}
      <directionalLight position={[0, 0.5, -12]} intensity={0.32} color="#9dff4d" />
      {/* The machine's own glow. Follows the camera down the corridor so every
          chapter gets its own pool of light without a light per chapter. */}
      <CameraLight />
    </>
  )
}

export function SceneWorld() {
  // SceneWorld is only ever loaded through a `ssr: false` dynamic import, so
  // there is no server render to disagree with. A lazy initialiser reads the
  // capabilities exactly once, synchronously, with no effect and no cascading
  // render — and `Experience` has already established that WebGL is available.
  const [caps] = useState<Capabilities>(() => detectCapabilities())

  const dpr = useMemo<[number, number]>(() => [1, caps.maxPixelRatio], [caps])

  return (
    <Canvas
      className="scene-canvas"
      dpr={dpr}
      gl={{
        antialias: caps.tier === 'high',
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      }}
      camera={{ fov: 42, near: 0.1, far: 900, position: [0, 0.6, 9.5] }}
      // The scene is dark by design; three's default white clear would flash.
      onCreated={({ gl, scene }) => {
        gl.setClearColor(new THREE.Color('#04060c'), 1)
        gl.toneMapping = THREE.ACESFilmicToneMapping
        // ACES compresses the low end hard. Without a little extra exposure the
        // dark palette lands below the visible floor and the whole scene reads
        // as an empty black frame.
        gl.toneMappingExposure = 1.15
        // After every program link three asks the driver for the info log so it
        // can report shader errors. That query is synchronous and blocks the
        // pipeline, and it was 11.8% of all main-thread samples during a
        // scroll — a full stall on every chapter swap. Errors are worth the
        // cost while developing; in production the shaders are already proven.
        gl.debug.checkShaderErrors = process.env.NODE_ENV !== 'production'
        // Fog is tuned to the *world*, not to a scene. The chapters occupy a
        // corridor roughly 700 units deep, so fog has to start well beyond any
        // single chapter's subject and finish far out, or the deeper scenes are
        // rendered as flat background colour.
        scene.fog = new THREE.Fog(new THREE.Color('#050810'), 70, 460)
        // Dev-only: publishes real renderer stats so `npm run perf` can report
        // draw calls and triangles. `requestAnimationFrame` frequency is not a
        // reliable performance signal — it reports the compositor's cadence,
        // not the GPU's actual completion time.
        if (process.env.NODE_ENV !== 'production') {
          ;(window as unknown as Record<string, unknown>).__GL_STATS__ = () => {
            // `renderer.info.render` is reset by the composer's own passes, so
            // `calls` alone is misleading. Walking the graph gives the number
            // that actually predicts per-frame CPU cost: how many objects
            // `updateMatrixWorld` and `projectObject` have to visit.
            let objects = 0
            let meshes = 0
            let materials = 0
            let transmissive = 0
            scene.traverse((object) => {
              objects++
              const mesh = object as THREE.Mesh
              if (mesh.isMesh) meshes++
              const material = (mesh as unknown as { material?: THREE.Material }).material
              if (material) {
                materials++
                const physical = material as unknown as { transmission?: number }
                if ((physical.transmission ?? 0) > 0) transmissive++
              }
            })
            return {
              // `render.frame` counts completed renders, which is the only way
              // to tell a 60fps cap apart from a 75Hz rAF cadence: both look
              // identical if you only sample rAF timestamps.
              frames: gl.info.render.frame,
              calls: gl.info.render.calls,
              triangles: gl.info.render.triangles,
              points: gl.info.render.points,
              geometries: gl.info.memory.geometries,
              textures: gl.info.memory.textures,
              programs: gl.info.programs?.length ?? 0,
              pixelRatio: gl.getPixelRatio(),
              objects,
              meshes,
              materials,
              transmissive,
              drawSize: gl.getDrawingBufferSize(new THREE.Vector2()),
            }
          }
        }
      }}
      // Paced by `FrameGovernor`, not by the display's refresh rate.
      frameloop="never"
    >
      <FrameGovernor maxDpr={caps.maxPixelRatio} />
      <Environment />
      <Lights />
      <CameraRig />
      <Suspense fallback={null}>
        <Cityscape tier={caps.tier} />
        <DataParticles tier={caps.tier} accent="cyan" span={780} />
        <SceneHost tier={caps.tier} />
      </Suspense>
      <Post tier={caps.tier} />
    </Canvas>
  )
}