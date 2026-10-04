# CYBERPUNK 3D PORTFOLIO

An immersive, scroll-driven portfolio for **Ajit Kumar**, Software Engineer — backend, microservices, e-commerce and event-driven systems.

Fourteen cinematic scenes on one continuous master scroll timeline, built with Next.js App Router, React Three Fiber, GSAP/ScrollTrigger, Lenis and GLSL.

```bash
npm install
npm run dev     # http://localhost:3000
npm run build   # production build
npm run lint    # eslint
npm run smoke   # render the built site in Edge and assert it actually paints
```

---

## The one rule that shapes everything

`context.txt` is explicit: **do not invent employment history, projects, metrics, clients, awards or technologies.** So there are exactly two places a fact can live:

- **`src/config/content.ts`** — every resume-verified fact. Name, roles, dates, projects with their real URLs, the thirty-one skills and their relationships, contact channels.
- **`src/config/scenes.ts`** — the fourteen-chapter timeline: anchors, camera keys, scroll weights, accents and transition mechanisms.

No scene hard-codes a string. If a fact is not in `content.ts`, it does not exist on screen. Where the resume supplied a channel name but no URL — LinkedIn, GitHub, email — the contact action renders as a labelled, non-linked element rather than a guess.

---

## Architecture

### One clock, one trigger, one store

The hardest constraint in the brief is *"do not let independent animation loops fight GSAP-controlled transforms."* The solution is structural:

```
GSAP ticker ──┬─▶ Lenis.raf()          one requestAnimationFrame, total
              ├─▶ tickTime(dt)         shared clock
              └─▶ syncFrame(progress)  writes to `lib/store`
                                             │
        ┌────────────────────────────────────┼────────────────────────────┐
        ▼                                    ▼                            ▼
  CameraRig reads                     DOM overlay reads          Chapters read
  progress + anchors                  chapter index              frame.chapters[i]
  (once per frame)                    (14 renders per visit)    (inside useFrame)
```

- **`lib/timeline.ts`** owns exactly one ScrollTrigger for the whole document. It writes a normalised `0–1` progress into a plain mutable object and does nothing else. Scenes never register their own triggers.
- **`lib/store.ts`** is that mutable object. Scenes read it inside `useFrame` — never React state. DOM components subscribe through `useSyncExternalStore` to the *chapter index only*, so the overlay re-renders fourteen times in a visit instead of sixty times a second.
- Idle motion blends into scroll motion rather than replacing it: scenes damp toward the scroll-owned value, and the idle contribution fades in only once `sinceScroll` exceeds a threshold.

### Rendering budget

| Layer | Cost |
|---|---|
| `<Canvas>` | **one** for all fourteen scenes — fourteen contexts would exhaust the browser's WebGL limit |
| Mounted chapters | three (active ± 1) — the rest unmount and dispose |
| Environment | three instanced draw calls for the whole background |
| Particles | one `THREE.Points`, animated entirely in the vertex shader |
| Labels | drei `<Html>` — real DOM, no web-font fetch at runtime |

`SceneHost` enforces the brief's exit rule directly: *"disable expensive interaction effects when the scene leaves the active range."* A scene one interval either side stays mounted so an incoming transition lands on a real object rather than an empty frame.

### Capability tiers

`lib/device.ts` detects a tier once on the client and every expensive thing budgets from it — particle counts, instanced object counts (the 2,400-node user field in Scene 11, the database shards in Scene 08), antialiasing, bloom. **If there is no usable WebGL context, the experience does not degrade into a slideshow:** `StaticFallback` renders the same fourteen chapters from the same copy components as one continuous document.

### Reduced motion

`prefers-reduced-motion` is read in two places. The camera rig snaps its damping from 3.4 to 12 and disables pointer parallax and shake. The frame clock runs at quarter speed. Scene *changes* still happen — the brief asks for them — but nothing aggressive moves. All DOM transitions collapse to opacity.

---

## The fourteen chapters

| # | Chapter | Primary object | Transition out |
|---|---|---|---|
| 01 | The Neon Core | Glass-metal torus, six mechanical rings, luminous circuitry | Digital shutter |
| 02 | Engineer Profile | Layered identity panel, six service modules | Folding data blade |
| 03 | Microservice City | Service towers, curved request packets | Data tunnel |
| 04 | Commerce Machine | Eleven-station order-lifecycle machine | Packet launch |
| 05 | Event Rail | FIFO rails, dedup gate, backoff loops, DLQ | Rail exit |
| 06 | Shopify Nexus | Hexagonal API core, split REST/GraphQL paths, traffic meter | Mechanical rotation |
| 07 | ERP Bridge | Two terminals, animated SOAP ribbons, scanning beam | Fragment collapse |
| 08 | Data Vault | Four vaults drawn as four *data shapes* | Compression to a cube |
| 09 | Product Gallery | Seven real project slabs, walked past horizontally | Mechanical door |
| 10 | Mobile Wealth Node | React Native device, layered UI, Hedera lattice | Lattice expansion |
| 11 | Access Grid | Four-level RBAC tower, instanced user field | Grid fracture |
| 12 | Control Room | Frozen red packet, six diagnostic panels | Signal resolution |
| 13 | Stack Matrix | 31 skill tiles, real relationship edges | Collapse to core |
| 14 | The Core | Refined core carrying fragments of all thirteen | Slow controlled fade |

Every boundary uses a **different** mechanism. The fullscreen transition shader (`shaders/transition.ts`) branches fourteen ways on a single envelope uniform and is dark for 99% of the session.

Metaphors are physical — rails, bridges, vaults, machines, terminals, towers, control rooms, data cores. There is no star field, no nebula, no planet anywhere in the build. In Scene 08 the four databases are drawn as the *shape of their data* (loose shards, rigid grid, immovable mass, thin memory layer) rather than as logos.

---

## Layout

```
src/
  config/
    content.ts          every resume-verified fact — the only source of claims
    scenes.ts           the 14-chapter timeline: anchors, weights, camera keys
  lib/
    timeline.ts         Lenis + ScrollTrigger + the single shared clock
    store.ts            mutable per-frame state; low-frequency chapter store
    device.ts           capability tier and per-tier budgets
    math.ts             damping, easing, deterministic noise and RNG
    useChapter.ts       chapter index for the DOM layer
    useReducedMotion.ts media-query subscription
  shaders/
    dataParticles.ts    GPU lane-flow particle field
    transition.ts       the boundary transition effect (14 mechanisms)
  components/
    chapters/           01–14, one isolated R3F component each
    three/              Canvas, camera rig, host, materials, primitives, post
    copy.tsx            all fourteen chapters' readable copy
    Experience.tsx      client root: stage, overlay, navigation, track
  app/
    layout.tsx          metadata drawn from content.ts
    page.tsx            server component: accessible content index only
```

### Why the content lives in the DOM

context.txt: *"Keep detailed text in readable DOM overlays… Do not attempt to render all typography inside WebGL… Provide readable HTML equivalents for important text."*

The 3D layer carries structure and atmosphere. Every word a visitor needs is real DOM: one chapter at a time in the fixed overlay, animated by Framer Motion with `translateY` and opacity only — no springs, no bounce. `A11yContent` renders the full fourteen-chapter index for screen readers and crawlers, and `page.tsx` is a Server Component so that text exists in the initial HTML before any JavaScript runs.

---

## Two deliberate engineering decisions

**`react-hooks/immutability` is off for the WebGL layer only.** The React Compiler rules assume pure render. An R3F scene mutates materials and transforms inside `useFrame`, outside React entirely — which is simultaneously the correct R3F pattern and exactly what the brief's performance rules ask for. The rule is disabled in `eslint.config.mjs` for `three/`, `chapters/` and `shaders/`, with the reasoning written down, and stays on everywhere else. `set-state-in-effect` and `refs` were **not** disabled — they caught four real problems and the code was fixed instead.

**No contact URLs are guessed.** The resume names LinkedIn, GitHub and email without links. They render as disabled, visibly-labelled actions with a caption saying why. Filling them in is a one-line change in `content.ts`, and every contact surface updates from that single edit.

---

## Verification

```
npx tsc --noEmit   clean
npx eslint src     clean
npm run build      clean
npm run smoke      canvas mounted · 6 chapters advanced · no console errors
```

Every listener, ticker callback, animation frame, geometry and material is released on unmount.

### Why `npm run smoke` exists

`tsc`, `eslint` and `next build` all passed green while the entire 3D layer was crashing on mount. Two real bugs got through them:

1. A temporal dead zone error in `DataLink` — the `useMemo` body referenced the binding it was still assigning. Every `DataLink` threw during render, so no chapter mounted at all.
2. A GLSL type error in the transition shader's `fade` branch — a `float` assigned to a `vec2`. The shader failed to compile at runtime, which TypeScript has no way to see.

Both are invisible to static analysis: one needs a React render, the other needs a GPU context. `scripts/smoke.mjs` runs the production build in the Edge already installed on the machine (no browser download) and fails on a missing canvas, a thrown page error, a console error, or an overlay that stops advancing.

If you would rather not rely on Edge, `npm i -D playwright` and change the `channel: 'msedge'` to `chromium`.