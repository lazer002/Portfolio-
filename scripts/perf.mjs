/**
 * Performance probe.
 *
 * `scripts/smoke.mjs` proves the thing renders. This reports what the renderer
 * is actually doing, because frame rate measured with `requestAnimationFrame`
 * is not trustworthy: rAF fires on the compositor's cadence, which stays at the
 * display refresh rate even while the GPU is minutes behind. That is how a
 * scene can measure a comfortable 75fps and still be unwatchable.
 *
 * What this reports instead:
 *   - draw calls and triangles per frame, from three.js `renderer.info`
 *   - GPU time per frame, measured with `gl.finish()` so the CPU cannot run ahead
 *
 * Usage:
 *   node scripts/perf.mjs              # production build
 *   DEV=1 node scripts/perf.mjs        # dev server, where __GL_STATS__ is exposed
 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { globSync } from 'node:fs'
import { join } from 'node:path'
import { spawn } from 'node:child_process'

function loadPlaywright() {
  try {
    return createRequire(import.meta.url)('playwright')
  } catch {
    const cache = join(homedir(), 'AppData', 'Local', 'npm-cache', '_npx')
    const hit = globSync(join(cache, '*', 'node_modules', 'playwright', 'index.js'))
    if (!hit.length) throw new Error('playwright not found; run: npm i -D playwright')
    return createRequire(hit[0])('./index.js')
  }
}
const { chromium } = loadPlaywright()

const PORT = 3211
const DEV = Boolean(process.env.DEV)
const server = spawn('npx', ['next', DEV ? 'dev' : 'start', '--port', String(PORT)], {
  stdio: 'ignore',
  shell: true,
})

async function waitForServer(timeout = DEV ? 90000 : 40000) {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      if ((await fetch(`http://localhost:${PORT}/`)).ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('server did not start')
}
await waitForServer()

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })
await page.waitForTimeout(DEV ? 10000 : 4500)

const STOPS = [0, 0.08, 0.15, 0.23, 0.31, 0.38, 0.46, 0.54, 0.62, 0.7, 0.77, 0.85, 0.92, 0.99]

const sample = () =>
  page.evaluate(async () => {
    const stats = window.__GL_STATS__ ? window.__GL_STATS__() : {}

    // Force the GPU to finish the frame before timing it. Without this the
    // measurement is just how fast the CPU can queue commands.
    const canvas = document.querySelector('canvas')
    const gl = canvas && (canvas.getContext('webgl2') || canvas.getContext('webgl'))
    let gpuMs = -1
    if (gl) {
      const px = new Uint8Array(4)
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px) // warm
      const t0 = performance.now()
      const FRAMES = 20
      for (let i = 0; i < FRAMES; i++) {
        gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px)
      }
      gl.finish()
      gpuMs = Math.round(((performance.now() - t0) / FRAMES) * 100) / 100
    }

    return {
      calls: stats.calls ?? -1,
      tris: stats.triangles ?? -1,
      programs: stats.programs ?? -1,
      gpuMs,
      chapter: document.documentElement.style.getPropertyValue('--chapter'),
      title: document.querySelector('.chapter-copy__title')?.textContent?.trim() ?? '?',
      labels: document.querySelectorAll('.holo-label').length,
    }
  })

const results = []
for (const frac of STOPS) {
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: max * f, behavior: 'instant' })
  }, frac)
  await page.waitForTimeout(800)
  results.push(await sample())
}

const renderer = await page.evaluate(() => {
  const c = document.createElement('canvas')
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  if (!gl) return 'no context'
  const dbg = gl.getExtension('WEBGL_debug_renderer_info')
  return dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER)
})

await browser.close()
server.kill()

console.log('\nrenderer:', renderer, DEV ? '(dev)' : '(production)')
console.log('\nch   title                        calls      tris  programs  labels   gpu ms')
console.log('----------------------------------------------------------------------')
for (const r of results) {
  const ch = String(r.chapter).padStart(2)
  const title = r.title.slice(0, 24).padEnd(25)
  console.log(
    `${ch}   ${title}${String(r.calls).padStart(7)}${String(r.tris).padStart(10)}` +
      `${String(r.programs).padStart(10)}${String(r.labels).padStart(8)}${String(r.gpuMs).padStart(9)}`,
  )
}

const peakCalls = Math.max(...results.map((r) => r.calls))
const peakGpu = Math.max(...results.map((r) => r.gpuMs))
const peakPrograms = Math.max(...results.map((r) => r.programs))
console.log(`\npeak draw calls: ${peakCalls}`)
console.log(`peak programs:   ${peakPrograms}`)
console.log(`peak gpu ms:     ${peakGpu}  (${peakGpu > 0 ? Math.round(1000 / peakGpu) : '?'} fps ceiling)`)

if (peakCalls > 500) {
  console.log('\nFAIL: draw-call count too high for smooth rendering')
  process.exit(1)
}
console.log('\nPASS')