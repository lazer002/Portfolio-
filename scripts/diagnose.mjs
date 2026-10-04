/**
 * Main-thread lag probe.
 *
 * `scripts/perf.mjs` measures GPU time via `gl.finish()`. That only answers "is
 * the GPU the bottleneck". The complaint this exists to diagnose is *lag* — the
 * experience stuttering, feeling heavy to scroll — which is overwhelmingly a
 * **main-thread** problem, and which a GPU-only probe reports as perfectly
 * healthy. That is exactly how you end up with a scene measuring 7ms of GPU
 * time while the page is visibly janky.
 *
 * So this measures the three things that actually cause perceived lag:
 *
 *   1. Frame interval, sampled from rAF timestamps over a window, reporting
 *      median / p95 / worst. A dropped frame is a main-thread stall.
 *   2. Long tasks (>50ms) via PerformanceObserver, which is the browser's own
 *      definition of "the main thread was blocked".
 *   3. Where the time goes: DOM node count (drei `<Html>` labels each mount a
 *      real element and are repositioned every frame), plus GPU time for
 *      comparison, so the two can be attributed to the right subsystem.
 *
 * Usage:
 *   node scripts/diagnose.mjs             # production build
 *   DEV=1 node scripts/diagnose.mjs       # dev server, where __GL_STATS__ exists
 */
import { homedir } from 'node:os'
import { globSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

import { startServer } from './lib/server.mjs'

const DEV = Boolean(process.env.DEV)

function loadPlaywright() {
  try {
    return createRequire(import.meta.url)('playwright')
  } catch {
    const hit = globSync(join(homedir(), 'AppData', 'Local', 'npm-cache', '_npx', '*', 'node_modules', 'playwright', 'index.js'))
    if (!hit.length) throw new Error('playwright not found; run: npm i -D playwright')
    return createRequire(hit[0])('./index.js')
  }
}

const { chromium } = loadPlaywright()

const server = await startServer({ dev: DEV })
const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const consoleErrors = []
page.on('console', (m) => {
  if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200))
})
page.on('pageerror', (e) => consoleErrors.push(`pageerror: ${e.message}`.slice(0, 200)))

await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
await page.waitForTimeout(DEV ? 10000 : 5000)

/**
 * Installed once. Records frame intervals and long tasks for the whole session
 * so each sample can report the window since the previous sample rather than
 * needing a fresh observer per scroll stop.
 */
await page.evaluate(() => {
  window.__PERF__ = { frames: [], longTasks: 0, longTaskMs: 0, last: null }

  try {
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        window.__PERF__.longTasks++
        window.__PERF__.longTaskMs += entry.duration
      }
    }).observe({ entryTypes: ['longtask'] })
  } catch {
    /* longtask observer unsupported; frame intervals still tell the story */
  }

  const tick = (t) => {
    const p = window.__PERF__
    if (p.last !== null) p.frames.push(t - p.last)
    p.last = t
    requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
})

const STOPS = [0, 0.09, 0.18, 0.27, 0.36, 0.45, 0.54, 0.63, 0.72, 0.81, 0.9, 0.99]

/** Drains the frame/long-task buffers since the last call. */
const drain = () =>
  page.evaluate(async () => {
    const p = window.__PERF__
    const frames = p.frames.slice()
    p.frames.length = 0
    const longTasks = p.longTasks
    const longTaskMs = p.longTaskMs
    p.longTasks = 0
    p.longTaskMs = 0

    frames.sort((a, b) => a - b)
    const pick = (q) => (frames.length ? frames[Math.min(frames.length - 1, Math.floor(frames.length * q))] : -1)

    // GPU time for comparison, so main-thread and GPU cost can be attributed.
    const stats = window.__GL_STATS__ ? window.__GL_STATS__() : {}
    const canvas = document.querySelector('canvas')
    const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    let gpuMs = -1
    if (gl) {
      const px = new Uint8Array(4)
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      const t0 = performance.now()
      for (let i = 0; i < 10; i++) gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      gl.finish()
      gpuMs = Math.round(((performance.now() - t0) / 10) * 100) / 100
    }

    return {
      n: frames.length,
      median: pick(0.5),
      p95: pick(0.95),
      worst: frames.length ? frames[frames.length - 1] : -1,
      longTasks,
      longTaskMs: Math.round(longTaskMs),
      calls: stats.calls ?? -1,
      tris: stats.triangles ?? -1,
      gpuMs,
      domNodes: document.querySelectorAll('*').length,
      labels: document.querySelectorAll('.holo-label').length,
      chapter: document.documentElement.style.getPropertyValue('--chapter'),
      title: document.querySelector('.chapter-copy__title')?.textContent?.trim() ?? '?',
    }
  })

const rows = []
for (const frac of STOPS) {
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: max * f, behavior: 'instant' })
  }, frac)
  // Settle, then discard the frames the settle produced: a chapter swap is
  // always expensive (mount, compile shaders) and would flatter the steady-state
  // numbers if it were included.
  await page.waitForTimeout(1200)
  await drain()
  await page.waitForTimeout(2000)
  rows.push(await drain())
}

const renderer = await page.evaluate(() => {
  const c = document.createElement('canvas')
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  if (!gl) return 'no context'
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
})

await browser.close()
await server.stop()

const f1 = (v) => (v > 0 ? v.toFixed(1) : '-')
console.log('\nrenderer:', renderer, DEV ? '(dev)' : '(production)')
console.log('\nch  title                       med    p95   worst  long  gpu   dom  labels  calls')
console.log('-'.repeat(92))
for (const r of rows) {
  console.log(
    `${String(r.chapter).padStart(2)}  ${r.title.slice(0, 26).padEnd(27)}` +
      `${f1(r.median).padStart(5)}${f1(r.p95).padStart(7)}${f1(r.worst).padStart(7)}` +
      `${String(r.longTasks).padStart(6)}${f1(r.gpuMs).padStart(6)}` +
      `${String(r.domNodes).padStart(6)}${String(r.labels).padStart(7)}${String(r.calls).padStart(7)}`,
  )
}

const med = rows.map((r) => r.median).filter((v) => v > 0)
const worstMed = Math.max(...med)
const totalLong = rows.reduce((a, r) => a + r.longTasks, 0)
const peakDom = Math.max(...rows.map((r) => r.domNodes))
const peakLabels = Math.max(...rows.map((r) => r.labels))
const peakGpu = Math.max(...rows.map((r) => r.gpuMs))

console.log(`\nworst median frame: ${worstMed.toFixed(1)}ms  (${Math.round(1000 / worstMed)} fps)`)
console.log(`long tasks total:   ${totalLong}`)
console.log(`peak DOM nodes:     ${peakDom}`)
console.log(`peak holo labels:   ${peakLabels}`)
console.log(`peak gpu ms:        ${peakGpu}`)
if (consoleErrors.length) {
  console.log(`\nconsole errors (${consoleErrors.length}):`)
  for (const e of consoleErrors.slice(0, 8)) console.log('  -', e)
}

// Frame budget is 16.7ms at 60fps. Sustained medians well above that are the
// lag the visitor is reporting; long tasks above zero are what causes the
// stutter during scroll.
const LAGGY = worstMed > 24
if (LAGGY || totalLong > 4) {
  console.log(`\nFAIL: main thread is over budget${totalLong ? ` (${totalLong} long tasks)` : ''}`)
  process.exit(1)
}
console.log('\nPASS')