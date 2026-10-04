/**
 * A/B experiment for a single chapter's frame cost.
 *
 * When `diagnose.mjs` says one chapter is slow and `profile-chapter.mjs` points
 * at three.js internals that scale with object count, yet the graph turns out to
 * hold only a few hundred objects, the profiler is describing normal overhead
 * rather than the cause. Guessing from that table produced a "fix" (removing
 * `transmission` from 31 tiles) that changed nothing measurable.
 *
 * So this measures the same thing repeatedly while changing exactly one thing:
 * labels hidden, their text-shadows removed, the canvas shrunk, particles
 * removed. Whatever moves the median is the thing that was costing the frames.
 *
 * Usage:
 *   DEV=1 PROBE_URL=http://localhost:3000 FRAC=0.89 node scripts/ablate.mjs
 */
import { loadBrowser, startServer } from './lib/server.mjs'

const DEV = Boolean(process.env.DEV)
const FRAC = Number(process.env.FRAC ?? 0.89)

const { chromium } = await loadBrowser()
const server = await startServer({ dev: DEV })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
await page.waitForTimeout(DEV ? 9000 : 4500)

await page.evaluate((f) => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  window.scrollTo({ top: max * f, behavior: 'instant' })
}, FRAC)
await page.waitForTimeout(3000)

/** Samples frame intervals for `ms`, returning median/p95. */
async function measure(ms = 2500) {
  return page.evaluate(async (duration) => {
    const frames = []
    let last = null
    await new Promise((resolve) => {
      const tick = (t) => {
        if (last !== null) frames.push(t - last)
        last = t
        if (frames.length * 17 > duration) resolve()
        else requestAnimationFrame(tick)
      }
      requestAnimationFrame(tick)
    })
    frames.sort((a, b) => a - b)
    const pick = (q) => frames[Math.min(frames.length - 1, Math.floor(frames.length * q))]
    return { median: pick(0.5), p95: pick(0.95), n: frames.length }
  }, ms)
}

async function withCss(css) {
  const handle = css ? await page.addStyleTag({ content: css }) : null
  await page.waitForTimeout(900)
  const result = await measure()
  if (handle) await handle.evaluate((el) => el.remove())
  await page.waitForTimeout(600)
  return result
}

const title = await page.evaluate(
  () => document.querySelector('.chapter-copy__title')?.textContent?.trim() ?? '?',
)
const labels = await page.evaluate(() => document.querySelectorAll('.holo-label').length)

console.log(`\nchapter at fraction ${FRAC}: "${title}"  (${labels} holo labels)\n`)
console.log('condition                          median    p95     fps')
console.log('-'.repeat(62))

const CASES = [
  ['baseline', ''],
  ['labels display:none', '.holo-label{display:none!important}'],
  ['label text-shadow off', '.holo-label__text{text-shadow:none!important}'],
  ['canvas at 1/4 size', '.scene-canvas{width:720px!important;height:450px!important}'],
  ['canvas hidden', '.scene-canvas{visibility:hidden!important}'],
]

const results = []
for (const [name, css] of CASES) {
  const r = await withCss(css)
  results.push([name, r])
  console.log(
    `${name.padEnd(34)}${r.median.toFixed(1).padStart(6)}${r.p95.toFixed(1).padStart(8)}` +
      `${String(Math.round(1000 / r.median)).padStart(8)}`,
  )
}

await browser.close()
await server.stop()

const base = results[0][1].median
console.log('')
for (const [name, r] of results.slice(1)) {
  const delta = base - r.median
  console.log(
    `${name.padEnd(34)}${delta > 0.05 ? `-${delta.toFixed(1)}ms` : `+${(-delta).toFixed(1)}ms`}` +
      `${delta > 1 ? '   <- matters' : ''}`,
  )
}