/**
 * The master scroll timeline.
 *
 * context.txt: "Create one master GSAP timeline for the portfolio. Each scene
 * receives a fixed scroll interval rather than competing for the same
 * ScrollTrigger. Scene progress must be deterministic from scroll position."
 *
 * So: one table, normalised once at module load. `progressStart` /
 * `progressEnd` are fractions of total document scroll, and `weight` is the
 * relative scroll length a chapter buys itself. Heavy chapters (the machine, the
 * rail, the vault, the matrix) get more scroll so the storytelling has room;
 * the hero gets a long runway; the contact scene gets a short, calm one.
 *
 * Nothing here animates. It is pure data plus the derived camera keys and
 * transition metadata that `lib/timeline` and the scene components read.
 */

/** Neon cyan is the default accent; the palette never becomes a rainbow. */
export const ACCENT = {
  cyan: '#22e6ff',
  green: '#9dff4d',
  violet: '#a06bff',
  white: '#eaf6ff',
  amber: '#ffb347',
  red: '#ff3b5c',
} as const

export type AccentKey = keyof typeof ACCENT

/**
 * Every scene has an identifiable transition mechanism and no two scenes share
 * one, per the TRANSITION RULES in context.txt.
 */
export type TransitionKind =
  | 'shutter' // 01 — horizontal scanline shutter, sideways noise displace
  | 'fold' // 02 — identity panel folds into a vertical data blade
  | 'tunnel' // 03 — camera follows a packet through an accelerating tunnel
  | 'launch' // 04 — order packet becomes a webhook event and launches
  | 'railExit' // 05 — final successful event exits the queue as a signed packet
  | 'rotate' // 06 — gateway rotates 90° into one side of the bridge
  | 'collapse' // 07 — bridge collapses into falling data fragments
  | 'compress' // 08 — four vaults compress into a single data cube
  | 'door' // 09 — final project slab opens like a mechanical door
  | 'expand' // 10 — blockchain lattice expands to fill the viewport
  | 'fracture' // 11 — hierarchy grid fractures into diagnostic windows
  | 'resolve' // 12 — red packet resolves to a stable green/white signal
  | 'core' // 13 — matrix compresses into one luminous geometric core
  | 'fade' // 14 — slow controlled fade, grain, identity stays visible

export interface SceneDef {
  /** '01' … '14' — used for DOM ids and test hooks. */
  id: string
  /** Zero-based index. Derived, not hand-maintained. */
  index: number
  title: string
  /** Small uppercase technical label above the title. */
  eyebrow: string
  /** The scene's fixed scroll interval, in relative units. */
  weight: number
  /**
   * Where the scene sits in the world. Chapters share one continuous space, so
   * each one is a physical location the camera travels to rather than a fresh
   * stage. Y is up; the camera path runs along -Z.
   */
  anchor: [number, number, number]
  /**
   * Camera keys, expressed as OFFSETS FROM THE ANCHOR — not absolute world
   * coordinates. `CameraRig` computes `anchor + key`, so a key is how far from
   * the chapter's own centre the camera sits and looks.
   *
   * This distinction is not cosmetic. When the keys were written as absolute
   * positions, the anchor was added a second time and every camera ended up
   * 70–110 units behind its own scene, pointed at empty fog: fourteen chapters
   * rendering nothing at all. See `scripts/visibility.mjs`, which is the test
   * that catches it.
   */
  camera: {
    start: [number, number, number]
    end: [number, number, number]
    /** Look-at target, also relative to the anchor. */
    target: [number, number, number]
  }
  /** Scene accent, drawn from the constrained palette. */
  accent: AccentKey
  /** The outgoing transition mechanism. */
  transition: TransitionKind
  /**
   * Camera shake, 0–1. Only the debugging control room earns real shake; the
   * rest stay calm so hierarchy survives.
   */
  shake: number
  /** True once the chapter has a mounted 3D implementation. */
  implemented: boolean
  /** One-line summary of what the scene must communicate. */
  intent: string
}

type SceneSeed = Omit<SceneDef, 'index' | 'progressStart' | 'progressEnd'>

const SEEDS: SceneSeed[] = [
  {
    id: '01',
    title: 'The Neon Core',
    eyebrow: 'Identity',
    weight: 1.5,
    anchor: [0, 0, 0],
    camera: {
      start: [0, 0.6, 9.5],
      end: [0, 0.1, 2.2],
      target: [0, 0, 0],
    },
    accent: 'cyan',
    transition: 'shutter',
    shake: 0,
    implemented: true,
    intent: 'One machine, one engineer. The core is the whole portfolio in miniature.',
  },
  {
    id: '02',
    title: 'Engineer Profile',
    eyebrow: 'Human + System',
    weight: 1.25,
    anchor: [0, 0, -40],
    camera: {
      start: [5.4, 1.4, 7],
      end: [0, 0.3, 9],
      target: [0, 0, 0],
    },
    accent: 'cyan',
    transition: 'fold',
    shake: 0,
    implemented: true,
    intent: 'Separate the person from the stack: identity panel plus six service modules.',
  },
  {
    id: '03',
    title: 'Microservice City',
    eyebrow: 'Architecture',
    weight: 1.4,
    anchor: [0, 0, -84],
    camera: {
      start: [7, 11, 14],
      end: [-3, 1.6, -11],
      target: [0, 2, -4],
    },
    accent: 'green',
    transition: 'tunnel',
    shake: 0,
    implemented: true,
    intent: 'Backend architecture as a city: descend between service towers, travel the network.',
  },
  {
    id: '04',
    title: 'Commerce Machine',
    eyebrow: 'Nicobar Platform',
    weight: 1.6,
    anchor: [0, 0, -140],
    camera: {
      start: [0, 5.5, 14],
      end: [0, 2.2, -8],
      target: [0, 1.2, 0],
    },
    accent: 'green',
    transition: 'launch',
    shake: 0,
    implemented: true,
    intent: 'The flagship project. Follow one order through checkout to settlement.',
  },
  {
    id: '05',
    title: 'Event Rail',
    eyebrow: 'AWS SQS',
    weight: 1.45,
    anchor: [0, 0, -196],
    camera: {
      start: [-8, 1.6, 10],
      end: [8, 1.6, 10],
      target: [0, 0.4, 0],
    },
    accent: 'violet',
    transition: 'railExit',
    shake: 0,
    implemented: true,
    intent: 'Explain ordered delivery, dedup, delay, backoff and DLQ with real geometry.',
  },
  {
    id: '06',
    title: 'Shopify Nexus',
    eyebrow: 'API + Webhooks',
    weight: 1.3,
    anchor: [0, 0, -248],
    camera: {
      start: [0, 0.6, 10],
      end: [3.2, 1.8, -3],
      target: [0, 0.8, 0],
    },
    accent: 'cyan',
    transition: 'rotate',
    shake: 0,
    implemented: true,
    intent: 'REST and GraphQL on separate paths; signed webhooks in from outside.',
  },
  {
    id: '07',
    title: 'ERP Bridge',
    eyebrow: 'SOAP Contracts',
    weight: 1.25,
    anchor: [0, 0, -302],
    camera: {
      start: [-2.5, 1.6, 11],
      end: [2.5, 1.6, 11],
      target: [0, 0, 0],
    },
    accent: 'violet',
    transition: 'collapse',
    shake: 0,
    implemented: true,
    intent: 'Two terminals across a gap. Payload out, response back, scan for malformed segments.',
  },
  {
    id: '08',
    title: 'Data Vault',
    eyebrow: 'Persistence',
    weight: 1.4,
    anchor: [0, 0, -356],
    camera: {
      start: [0, 6, 12],
      end: [0, 1.4, -10],
      target: [0, 0, 0],
    },
    accent: 'cyan',
    transition: 'compress',
    shake: 0,
    implemented: true,
    intent: 'Four vaults, four data shapes. Redis sits closest to the request path.',
  },
  {
    id: '09',
    title: 'Product Gallery',
    eyebrow: 'Real Work',
    weight: 1.5,
    anchor: [0, 0, -412],
    camera: {
      start: [0, 1.2, 12],
      end: [0, 1.2, -26],
      target: [0, 0.6, 0],
    },
    accent: 'green',
    transition: 'door',
    shake: 0,
    implemented: true,
    intent: 'Walk a physical archive of the seven real projects. Links stay clickable.',
  },
  {
    id: '10',
    title: 'Mobile Wealth Node',
    eyebrow: 'Plexify',
    weight: 1.3,
    anchor: [0, 0, -474],
    camera: {
      start: [0, 0.4, 7],
      end: [4.6, 1.2, 2],
      target: [0, 0.2, 0],
    },
    accent: 'violet',
    transition: 'expand',
    shake: 0,
    implemented: true,
    intent: 'React Native device, layered glass UI, secondary Hedera lattice.',
  },
  {
    id: '11',
    title: 'Access Grid',
    eyebrow: 'RBAC + Routing',
    weight: 1.35,
    anchor: [0, 0, -528],
    camera: {
      start: [0, -3, 16],
      end: [0, 8, 10],
      target: [0, 2, 0],
    },
    accent: 'cyan',
    transition: 'fracture',
    shake: 0,
    implemented: true,
    intent: 'Climb the role hierarchy. Each level unlocks another layer of the tower.',
  },
  {
    id: '12',
    title: 'Control Room',
    eyebrow: 'Debugging',
    weight: 1.35,
    anchor: [0, 0, -582],
    camera: {
      start: [0, 0.6, 8],
      end: [0, 0.4, -8],
      target: [0, 0, 0],
    },
    accent: 'red',
    transition: 'resolve',
    shake: 0.55,
    implemented: true,
    intent: 'A method, not a fabricated incident: log → payload → queue → record → cause → fix.',
  },
  {
    id: '13',
    title: 'Stack Matrix',
    eyebrow: 'Technical DNA',
    weight: 1.4,
    anchor: [0, 0, -636],
    camera: {
      start: [0, 0, 16],
      end: [0, 0, -10],
      target: [0, 0, 0],
    },
    accent: 'green',
    transition: 'core',
    shake: 0,
    implemented: true,
    intent: 'All thirty-one skills as physical tiles in three rings, connected by real relationships.',
  },
  {
    id: '14',
    title: 'The Core',
    eyebrow: 'Contact',
    weight: 1.2,
    anchor: [0, 0, -690],
    camera: {
      start: [0, 0.2, 12],
      end: [0, 1.4, 28],
      target: [0, 0, 0],
    },
    accent: 'white',
    transition: 'fade',
    shake: 0,
    implemented: true,
    intent: 'The opening core again, now carrying fragments of every scene. Calm close.',
  },
]

export interface Scene extends SceneDef {
  progressStart: number
  progressEnd: number
}

const TOTAL_WEIGHT = SEEDS.reduce((sum, s) => sum + s.weight, 0)

export const SCROLL_TRACK_VH = 1400
/** Height of the visible scroll surface, in viewport heights. */
export const SCROLL_TRACK_V = SCROLL_TRACK_VH

function normalise(): Scene[] {
  let cursor = 0
  return SEEDS.map((seed, index) => {
    const progressStart = cursor / TOTAL_WEIGHT
    const progressEnd = (cursor + seed.weight) / TOTAL_WEIGHT
    cursor += seed.weight
    return { ...seed, index, progressStart, progressEnd }
  })
}

export const SCENES: Scene[] = normalise()

/**
 * Sanity check for the camera-key convention documented above.
 *
 * A camera key is an offset from the anchor. No chapter's subject is larger
 * than about 16 world units, so an offset of 60 or more almost certainly means
 * someone has written an absolute world position into an offset field — the
 * exact mistake that put all fourteen cameras 70–110 units behind their own
 * scenes and made the entire experience render as empty fog.
 *
 * This runs at module load and throws in development rather than failing
 * silently for the length of a testing session.
 */
if (process.env.NODE_ENV !== 'production') {
  for (const scene of SCENES) {
    for (const [key, value] of [
      ['camera.start', scene.camera.start],
      ['camera.end', scene.camera.end],
    ] as const) {
      const distance = Math.hypot(value[0], value[1], value[2])
      if (distance > 40) {
        throw new Error(
          `Scene ${scene.id} (${scene.title}): ${key} is ${distance.toFixed(0)} units from its anchor. ` +
            `Camera keys are OFFSETS from the anchor, not absolute world positions.`,
        )
      }
    }
    // `target` is an offset too, so it is measured against the origin, not
    // against the anchor. Comparing an offset to an absolute anchor is a
    // category error: it flagged the perfectly correct `target: [0, 0, 0]`
    // ("look at my own subject") on every scene with a non-zero anchor, and
    // took the whole app down with a 500 at module load.
    const targetOffset = Math.hypot(...scene.camera.target)
    if (targetOffset > 20) {
      throw new Error(
        `Scene ${scene.id} (${scene.title}): camera.target is offset ${targetOffset.toFixed(0)} units from its own ` +
          `subject. Camera keys are OFFSETS from the anchor, not absolute world positions.`,
      )
    }
  }
}

export const SCENE_COUNT = SCENES.length

/** Total scrollable length in pixels for the given viewport height. */
export function scrollTrackLength(viewportHeight: number): number {
  return (SCROLL_TRACK_VH - 100) * viewportHeight
}

/** Lookup helpers — scenes are addressed by index far more often than by id. */
export function sceneAt(index: number): Scene {
  return SCENES[Math.min(SCENE_COUNT - 1, Math.max(0, index))]
}

export function sceneById(id: string): Scene | undefined {
  return SCENES.find((s) => s.id === id)
}

/**
 * Normalised 0–1 document progress → chapter index. Deterministic, no state:
 * the same scroll position always resolves to the same chapter, which is what
 * "scene progress must be deterministic from scroll position" asks for.
 */
export function chapterFromProgress(progress: number): number {
  const p = clamp01(progress)
  for (let i = 0; i < SCENES.length; i++) {
    if (p < SCENES[i].progressEnd) return i
  }
  return SCENE_COUNT - 1
}

/** Normalised 0–1 progress of a chapter within its own interval. */
export function localProgress(index: number, progress: number): number {
  const scene = sceneAt(index)
  const span = scene.progressEnd - scene.progressStart
  if (span <= 0) return 0
  return clamp01((clamp01(progress) - scene.progressStart) / span)
}

/**
 * How close the document is to a chapter boundary, 0 at rest and 1 exactly at
 * the seam. The fullscreen transition shader is driven by this so effects only
 * exist at boundaries — never permanently active.
 */
export function boundaryIntensity(progress: number): number {
  let closest = 1
  for (let i = 1; i < SCENES.length; i++) {
    closest = Math.min(closest, Math.abs(progress - SCENES[i].progressStart))
  }
  // Narrow on purpose. At 0.06 the effect stayed "active" for roughly 78vh of
  // scroll either side of a seam, which smeared every frame. A transition
  // should be a punctuation mark at the boundary, not the resting state.
  const window = 0.014
  if (closest >= window) return 0
  const t = 1 - closest / window
  return t * t * (3 - 2 * t)
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v
}