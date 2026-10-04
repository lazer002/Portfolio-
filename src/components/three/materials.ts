import * as THREE from 'three'

import { ACCENT } from '@/config/scenes'

/**
 * Shared materials.
 *
 * context.txt: "Most surfaces are dark and restrained. Glow is reserved for
 * active data, interaction and key edges." So the default surface here is
 * nearly-black glass, and the emissive helpers exist specifically for the three
 * things allowed to glow.
 *
 * Materials are created once and cached — a scene that allocated a
 * MeshPhysicalMaterial per frame would be re-uploading its uniforms every time.
 */

export type AccentName = keyof typeof ACCENT

const colorCache = new Map<string, THREE.Color>()
export function accentColor(name: AccentName): THREE.Color {
  const key = String(name)
  let c = colorCache.get(key)
  if (!c) {
    c = new THREE.Color(ACCENT[name])
    colorCache.set(key, c)
  }
  return c
}

/** Base dark glass. The default for every structural surface in the build. */
export function glassMaterial(options: {
  color?: AccentName | string
  roughness?: number
  metalness?: number
  transmission?: number
  thickness?: number
  opacity?: number
} = {}): THREE.MeshPhysicalMaterial {
  const tint =
    typeof options.color === 'string' && options.color.startsWith('#')
      ? new THREE.Color(options.color)
      : accentColor((options.color as AccentName) ?? 'cyan')
  return new THREE.MeshPhysicalMaterial({
    // 0.06 rendered as pure black under this scene's lighting. 0.22 is still
    // deep, restrained glass, but it survives as a readable surface.
    color: tint.clone().multiplyScalar(0.22),
    metalness: options.metalness ?? 0.9,
    roughness: options.roughness ?? 0.22,
    transmission: options.transmission ?? 0.35,
    thickness: options.thickness ?? 0.8,
    ior: 1.42,
    transparent: true,
    opacity: options.opacity ?? 1,
    envMapIntensity: 1.4,
  })
}

/** Matte structural body — buildings, panels, machinery casings. */
export function shellMaterial(shade = 0.21): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(shade, shade * 1.05, shade * 1.25),
    metalness: 0.65,
    roughness: 0.62,
  })
}

/** Reserved for active data: emissive, unlit, additive where appropriate. */
export function dataMaterial(color: AccentName, intensity = 2.4): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: accentColor(color).multiplyScalar(intensity),
    toneMapped: false,
  })
}

/** Reserved for key edges: thin emissive trim that reads as architecture. */
export function edgeMaterial(color: AccentName, intensity = 1.6): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: accentColor(color).clone().multiplyScalar(0.18),
    emissive: accentColor(color),
    emissiveIntensity: intensity,
    metalness: 0.4,
    roughness: 0.35,
  })
}

/** The shared environment reflections the glass needs to read as glass. */
export function buildEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const pmrem = new THREE.PMREMGenerator(renderer)
  const scene = new THREE.Scene()

  // A restrained two-light studio: a cold overhead wash and a warm neon kick
  // from below. Not a rainbow — the palette has to stay coherent in reflections.
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(24, 16, 24),
    new THREE.MeshBasicMaterial({ color: 0x05070d, side: THREE.BackSide }),
  )
  scene.add(shell)

  const panel = (color: number, intensity: number, pos: [number, number, number], scale: [number, number]) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(scale[0], scale[1]),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }),
    )
    m.position.set(...pos)
    m.lookAt(0, 0, 0)
    scene.add(m)
  }

  panel(0x9fd8ff, 2.6, [0, 7, 0], [18, 10])
  panel(0x22e6ff, 1.1, [-9, 1, -4], [8, 12])
  panel(0xa06bff, 0.7, [9, -2, 3], [8, 12])
  panel(0x9dff4d, 0.35, [0, -7, 6], [14, 6])

  const target = pmrem.fromScene(scene, 0.04)

  shell.geometry.dispose()
  ;(shell.material as THREE.Material).dispose()
  scene.traverse((child) => {
    if (child instanceof THREE.Mesh && child !== shell) {
      child.geometry.dispose()
      ;(child.material as THREE.Material).dispose()
    }
  })
  pmrem.dispose()

  return target.texture
}

export const COLORS = ACCENT