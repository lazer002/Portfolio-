/**
 * Render-rate probe.
 *
 * Frame *intervals* cannot answer "is the cap working". `requestAnimationFrame`
 * fires on the compositor's cadence — 75Hz on the machine this was tuned on — so
 * a page rendering at a capped 60fps and one rendering at the full 75Hz both
 * report a 13.3ms median. The only honest measure is how many frames the
 * renderer actually completed in a known span.
 *
 * So this reads three's own `info.render.frame` counter twice, a second apart,
 * at several chapters. Needs the dev server, because `__GL_STATS__` is
 * development-only by design.
 *
 * Usage: DEV=1 PROBE_URL=http://localhost:3000 node scripts/fps.mjs
 */
import { loadBrowser, scrollToFraction, startServer } from './lib/server.mjs'

const DEV = Boolean(process.env.DEV)
const { chromium } = await loadBrowser()
const server = await startServer({ dev: DEV })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
await page.waitForTimeout(DEV ? 9000 : 4500)

if (!(await page.evaluate(() => Boolean(window.__FRAME_COUNT__ === 0 || window.__FRAME_COUNT__ > 0)))) {
  console.log('__FRAME_COUNT__ unavailable — run against the dev server')
  await browser.close()
  await server.stop()
  process.exit(1)
}

/** Completed renders in a `ms`-long window, via the governor's own counter. */
const rendersIn = (ms) =>
  page.evaluate(async (duration) => {
    const before = window.__FRAME_COUNT__ ?? 0
    const t0 = performance.now()
    await new Promise((r) => setTimeout(r, duration))
    const elapsed = performance.now() - t0
    return {
      count: (window.__FRAME_COUNT__ ?? 0) - before,
      elapsed,
      dpr: window.__GL_STATS__ ? window.__GL_STATS__().pixelRatio : -1,
    }
  }, ms)

/** The display's own refresh rate, from raw rAF intervals. */
const nativeFps = await page.evaluate(async () => {
  const stamps = []
  await new Promise((resolve) => {
    let last = null
    const tick = (t) => {
      if (last !== null) stamps.push(t - last)
      last = t
      if (stamps.length < 120) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
  stamps.sort((a, b) => a - b)
  return 1000 / stamps[Math.floor(stamps.length / 2)]
})

const STOPS = [0.03, 0.25, 0.5, 0.75, 0.93]
console.log(`\nnative refresh: ${nativeFps.toFixed(1)}Hz`)
console.log('\nchapter                       renders    elapsed   fps   dpr')
console.log('-'.repeat(64))

const rates = []
for (const frac of STOPS) {
  await scrollToFraction(page, frac, 1500)
  const r = await rendersIn(3000)
  const fps = r.count / (r.elapsed / 1000)
  rates.push(fps)
  const title = await page.evaluate(
    () => document.querySelector('.chapter-copy__title')?.textContent?.trim() ?? '?',
  )
  console.log(
    `${title.slice(0, 24).padEnd(28)}${String(r.count).padStart(7)}` +
      `${(Math.round(r.elapsed) + 'ms').padStart(11)}${fps.toFixed(1).padStart(7)}${r.dpr.toFixed(2).padStart(7)}`,
  )
}

await browser.close()
await server.stop()

const min = Math.min(...rates)
const max = Math.max(...rates)
console.log(`\nrender rate range: ${min.toFixed(1)} … ${max.toFixed(1)} fps`)

// The governor's contract is not "60 exactly": a frame cap is only reachable at
// rates the display clock can express. On a 75Hz monitor the options are 75,
// 37.5, 25 — so it keeps 75 rather than halving to 37.5. What must hold is that
// it never exceeds the display, and never falls into slideshow territory.
if (max > nativeFps + 2) {
  console.log(`FAIL: rendering faster than the display (${nativeFps.toFixed(1)}Hz)`)
  process.exit(1)
}
if (min < 50) {
  console.log('FAIL: rate collapsed below the 50fps floor — pacing is being traded away')
  process.exit(1)
}
console.log(`PASS: paced at or below the ${nativeFps.toFixed(0)}Hz display, never below 50fps`)