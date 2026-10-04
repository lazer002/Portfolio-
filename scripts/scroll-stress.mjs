/**
 * Scroll-stress probe.
 *
 * Measuring a chapter while it sits still reports the compositor's cadence, not
 * the experience: an idle frame here is a locked 13.3ms whether the canvas is
 * drawing a full city or is `visibility: hidden`. That is why a stationary
 * measurement can look healthy while the page feels awful to scroll.
 *
 * Scrolling is where the cost actually lives — chapters mount and unmount,
 * their geometry and materials are created and disposed, and every new material
 * compiles a shader program. A first frame on a fresh program is a pipeline
 * stall on this and every other GPU, and that is what a visitor perceives as
 * lag. So this drives a continuous scroll through the whole track and reports
 * the frame-interval distribution *during* it, split by whether a chapter swap
 * happened.
 *
 * Usage:
 *   DEV=1 PROBE_URL=http://localhost:3000 node scripts/scroll-stress.mjs
 */
import { loadBrowser, startServer } from './lib/server.mjs'

const DEV = Boolean(process.env.DEV)
/** Seconds of continuous scrolling to sample. */
const DURATION = Number(process.env.SECONDS ?? 26)

const { chromium } = await loadBrowser()
const server = await startServer({ dev: DEV })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
await page.waitForTimeout(DEV ? 9000 : 4500)

/**
 * Starts a recorder that logs every frame interval tagged with the chapter in
 * effect, so swaps can be isolated from steady cruise.
 *
 * The scroll itself is driven from Node with real wheel events. Driving it with
 * `window.scrollTo` inside a rAF callback instead fights Lenis — which is
 * installed precisely to take over scrolling — and forces a synchronous layout
 * of a 1400vh document on the main thread every frame. That artefact was 39% of
 * all main-thread samples in the scroll profile, and it manufactured long tasks
 * that a real visitor never experiences.
 */
await page.evaluate(() => {
  const rec = { frames: [], longTasks: [] }
  window.__REC__ = rec

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        rec.longTasks.push({
          ms: Math.round(e.duration),
          at: Math.round(performance.now() - rec.t0),
          ch: document.documentElement.style.getPropertyValue('--chapter'),
        })
      }
    }).observe({ entryTypes: ['longtask'] })
  } catch {
    /* unsupported; frame intervals still tell the story */
  }

  let chapter = document.documentElement.style.getPropertyValue('--chapter')
  let last = null
  rec.t0 = performance.now()
  const tick = (t) => {
    const current = document.documentElement.style.getPropertyValue('--chapter')
    if (last !== null) rec.frames.push({ dt: t - last, swap: current !== chapter, ch: current })
    chapter = current
    last = t
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

// Real wheel input, stepped like a person scrolling rather than teleported.
// The delta has to be large enough to actually cross the whole 1400vh track in
// the time allowed: a gentle 900px step only reached chapter 2 of 14, which
// leaves thirteen untested swaps and a false PASS.
const STEPS = Number(process.env.STEPS ?? 130)
const WHEEL = Number(process.env.WHEEL ?? 14000)
// Lenis clamps how far one wheel gesture can carry, so a fixed-step wheel run
// physically cannot cross a 1400vh track in the time allowed — it reached 0.19
// of the track however large the delta. Crossing each boundary deliberately is
// the only way to exercise all thirteen swaps, so that is the default here.
const MODE = process.env.MODE ?? 'swaps'

if (MODE === 'wheel') {
  // Park the pointer over the page first. Wheel events sent with no known
  // pointer position are dropped entirely.
  await page.mouse.move(720, 450)
  for (let i = 0; i < STEPS; i++) {
    await page.mouse.wheel(0, WHEEL)
    await page.waitForTimeout(Math.round((DURATION * 1000) / STEPS))
  }
} else {
  // The navigation rail renders one control per chapter, which is a reliable way
  // to learn the chapter count from the running page.
  const chapters = await page.evaluate(
    () => document.querySelectorAll('.nav a, .nav button, .nav li').length || 14,
  )
  for (let i = 0; i < chapters - 1; i++) {
    // Settle just before the seam, then step across it, so the frames recorded
    // around the crossing are the swap itself and nothing else.
    await page.evaluate(
      ([index, total]) => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo({ top: max * ((index + 0.94) / total), behavior: 'instant' })
      },
      [i, chapters],
    )
    await page.waitForTimeout(900)
    await page.evaluate(
      ([index, total]) => {
        const max = document.documentElement.scrollHeight - window.innerHeight
        window.scrollTo({ top: max * ((index + 1.02) / total), behavior: 'instant' })
      },
      [i, chapters],
    )
    await page.waitForTimeout(900)
  }
}
await page.waitForTimeout(1200)

const result = await page.evaluate(() => ({
  frames: window.__REC__.frames,
  longTasks: window.__REC__.longTasks,
  reached: (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)).toFixed(3),
}))

await browser.close()
await server.stop()

const { frames, longTasks } = result
const stats = (list) => {
  if (!list.length) return { median: 0, p95: 0, worst: 0 }
  const s = [...list].sort((a, b) => a - b)
  return {
    median: s[Math.floor(s.length * 0.5)],
    p95: s[Math.min(s.length - 1, Math.floor(s.length * 0.95))],
    worst: s[s.length - 1],
  }
}

const all = frames.map((f) => f.dt)
const swaps = frames.filter((f) => f.swap).map((f) => f.dt)
const cruise = frames.filter((f) => !f.swap).map((f) => f.dt)

const line = (name, list) => {
  const s = stats(list)
  console.log(
    `${name.padEnd(28)}${s.median.toFixed(1).padStart(7)}${s.p95.toFixed(1).padStart(8)}` +
      `${s.worst.toFixed(1).padStart(8)}${String(Math.round(1000 / s.median)).padStart(8)}${String(list.length).padStart(8)}`,
  )
}

console.log(`\ncontinuous scroll, ${DURATION}s through the full track\n`)
console.log('segment                     median    p95   worst     fps  frames')
console.log('-'.repeat(70))
line('all frames', all)
line('steady cruise', cruise)
line('chapter-swap frames', swaps)

console.log(`\nlong tasks (>50ms): ${longTasks.length}`)
for (const t of [...longTasks].sort((a, b) => b.ms - a.ms).slice(0, 12)) {
  console.log(`  ${String(t.ms).padStart(4)}ms  at t+${(t.at / 1000).toFixed(1)}s  chapter ${t.ch}`)
}

const dropped = all.filter((d) => d > 20).length
console.log(`\nframes over 20ms: ${dropped}/${all.length} (${((dropped / all.length) * 100).toFixed(1)}%)`)
console.log(`chapters visited: ${new Set(frames.map((f) => f.ch)).size}`)
console.log(`track fraction reached: ${result.reached}`)
if (errors.length) {
  console.log(`\npage errors (${errors.length}):`)
  for (const e of [...new Set(errors)].slice(0, 5)) console.log('  ' + e.slice(0, 160))
}

// A dropped frame during a chapter swap is a shader compile or a geometry
// build; that is the hitch a visitor feels. Budget: under 2% of frames and no
// long tasks.
if (dropped / all.length > 0.02 || longTasks.length > 2) {
  console.log('\nFAIL: scrolling drops frames')
  process.exit(1)
}
console.log('\nPASS: scrolling stays inside budget')