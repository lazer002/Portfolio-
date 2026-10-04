/**
 * First-arrival CPU profile for a single chapter.
 *
 * The remaining stalls are single multi-hundred-millisecond blocks that happen
 * on a chapter's *first* arrival — 530ms at chapter 0, 428ms at chapter 1,
 * 268ms at chapter 11 — and nowhere on a repeat visit. Nothing measured so far
 * explains them: not particle count, not the Html overlays, not scene-graph
 * size, not transmission, and a pre-warm pass that should have removed exactly
 * this cost made no measurable difference when A/B'd.
 *
 * So this profiles the crossing itself on a *fresh* page load, where the target
 * chapter has genuinely never been rendered. Each run is a new browser page, so
 * every run sees a cold first arrival and the numbers are comparable.
 *
 * Usage:
 *   DEV=1 PROBE_URL=http://localhost:3000 CHAPTER=11 node scripts/profile-arrival.mjs
 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { globSync } from 'node:fs'
import { join } from 'node:path'

import { loadBrowser, startServer } from './lib/server.mjs'

const DEV = Boolean(process.env.DEV)
const CHAPTER = Number(process.env.CHAPTER ?? 11)

function loadPlaywright() {
  try {
    return createRequire(import.meta.url)('playwright')
  } catch {
    const hit = globSync(join(homedir(), 'AppData', 'Local', 'npm-cache', '_npx', '*', 'node_modules', 'playwright', 'index.js'))
    if (!hit.length) throw new Error('playwright not found')
    return createRequire(hit[0])('./index.js')
  }
}

const { chromium } = loadPlaywright()
const server = await startServer({ dev: DEV })
const browser = await chromium.launch({ channel: 'msedge', headless: true })

async function run(label, total) {
  // A fresh page per run: a chapter's first arrival only happens once.
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(e.message))

  await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
  await page.waitForTimeout(DEV ? 9000 : 5000)

  // Long tasks are recorded across the whole session so the arrival block can be
  // lined up against the profile samples.
  await page.evaluate(() => {
    window.__LT__ = []
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) window.__LT__.push({ ms: Math.round(e.duration), at: e.startTime })
      }).observe({ entryTypes: ['longtask'] })
    } catch {
      /* ignore */
    }
  })

  const client = await page.context().newCDPSession(page)
  await client.send('Profiler.enable')
  await client.send('Profiler.setSamplingInterval', { interval: 100 })
  await client.send('Profiler.start')

  const t0 = Date.now()
  await page.evaluate(
    ([index, chapters]) => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      // Sit just before the seam, then cross it: the mount happens on arrival.
      window.scrollTo({ top: max * ((index + 0.97) / chapters), behavior: 'instant' })
    },
    [CHAPTER, total],
  )
  await page.waitForTimeout(300)
  await page.evaluate(
    ([index, chapters]) => {
      const max = document.documentElement.scrollHeight - window.innerHeight
      window.scrollTo({ top: max * ((index + 1.04) / chapters), behavior: 'instant' })
    },
    [CHAPTER, total],
  )
  await page.waitForTimeout(2600)

  const { profile } = await client.send('Profiler.stop')
  const longTasks = await page.evaluate(() => window.__LT__)
  const stats = await page.evaluate(() => (window.__GL_STATS__ ? window.__GL_STATS__() : null))
  await page.close()

  const byId = new Map(profile.nodes.map((n) => [n.id, n]))
  const self = new Map()
  for (const id of profile.samples ?? []) {
    const node = byId.get(id)
    if (!node) continue
    const f = node.callFrame
    const url = f.url || ''
    if (url.includes('devtools') || f.functionName === '(root)' || f.functionName === '(idle)') continue
    const key = `${f.functionName || '(anonymous)'} @ ${url.split('/').slice(-1)[0]}:${f.lineNumber + 1}`
    self.set(key, (self.get(key) ?? 0) + 1)
  }
  const total2 = [...self.values()].reduce((a, b) => a + b, 0)

  console.log(`\n===== ${label} (chapter ${CHAPTER}) — ${Math.round((Date.now() - t0) / 100) / 10}s =====`)
  const worst = [...longTasks].sort((a, b) => b.ms - a.ms).slice(0, 4)
  console.log(`long tasks: ${longTasks.length > 0 ? worst.map((t) => `${t.ms}ms@${Math.round(t.at)}`).join(', ') : 'none'}`)
  if (stats) {
    console.log(`graph: objects=${stats.objects} meshes=${stats.meshes} materials=${stats.materials} programs=${stats.programs}`)
  }
  if (!total2) return
  console.log('\n  %total   samples   function')
  console.log('-'.repeat(94))
  for (const [name, count] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 14)) {
    console.log(`${((count / total2) * 100).toFixed(1).padStart(6)}%${String(count).padStart(11)}   ${name.slice(0, 66)}`)
  }

  const buckets = { shader: 0, geometry: 0, material: 0, html: 0, react: 0, render: 0, dom: 0, other: 0 }
  for (const [name, count] of self) {
    if (/compile|WebGLProgram|getProgram|programCache|linkProgram|ProgramInfoLog/i.test(name)) buckets.shader += count
    else if (/Geometry|BufferAttribute|computeBounding|Torus|Capsule|Lathe|Tube/i.test(name)) buckets.geometry += count
    else if (/Material|PMREM|envmap|Texture|DataTexture/i.test(name)) buckets.material += count
    else if (/Html|occlude|calculatePosition/i.test(name)) buckets.html += count
    else if (/react|renderWithHooks|commit|reconcile|jsx/i.test(name)) buckets.react += count
    else if (/style|layout|paint|getComputedStyle/i.test(name)) buckets.dom += count
    else if (/three|WebGLRenderer|render/i.test(name)) buckets.render += count
    else buckets.other += count
  }
  console.log('\nbuckets:')
  for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) {
    if (v > total2 * 0.01) console.log(`  ${k.padEnd(10)} ${((v / total2) * 100).toFixed(1)}%`)
  }
  if (errors.length) console.log(`\npage errors: ${[...new Set(errors)].slice(0, 3).join(' | ').slice(0, 200)}`)
}

const TOTAL = 14
await run('cold arrival', TOTAL)
// Second visit to the same chapter, same page-load shape: whatever disappears
// here is what is one-time cost rather than steady-state cost.
await run('second arrival (same shape)', TOTAL)

await browser.close()
await server.stop()