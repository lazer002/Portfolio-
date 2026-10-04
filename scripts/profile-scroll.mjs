/**
 * CPU profile of a scroll, not of a stationary frame.
 *
 * `scroll-stress.mjs` shows where the time goes in aggregate — 13 chapter-swap
 * hitches and a handful of 300–500ms long tasks — but not which code causes
 * them. `profile-chapter.mjs` profiles a chapter sitting still, which by
 * construction can never catch the cost, because the cost *is* the mount.
 *
 * So this runs the CDP profiler across a continuous scroll through the whole
 * track. Whatever tops the self-time table during the swaps is what to change;
 * a plausible-sounding guess is what the previous round of this build did wrong.
 *
 * Usage:
 *   DEV=1 PROBE_URL=http://localhost:3000 node scripts/profile-scroll.mjs
 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { globSync } from 'node:fs'
import { join } from 'node:path'

import { startServer } from './lib/server.mjs'

const DEV = Boolean(process.env.DEV)

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
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
await page.waitForTimeout(DEV ? 9000 : 4500)

const client = await page.context().newCDPSession(page)
await client.send('Profiler.enable')
await client.send('Profiler.setSamplingInterval', { interval: 120 })
await client.send('Profiler.start')

// Same eased continuous scroll `scroll-stress.mjs` uses.
await page.evaluate(async () => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  const seconds = 22
  const start = performance.now()
  await new Promise((resolve) => {
    const tick = () => {
      const k = Math.min(1, (performance.now() - start) / (seconds * 1000))
      const eased = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2
      window.scrollTo({ top: max * eased, behavior: 'instant' })
      if (performance.now() - start < seconds * 1000) requestAnimationFrame(tick)
      else resolve()
    }
    requestAnimationFrame(tick)
  })
})

const { profile } = await client.send('Profiler.stop')

await browser.close()
await server.stop()

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

const total = [...self.values()].reduce((a, b) => a + b, 0)
if (!total) {
  console.log('no samples')
  process.exit(1)
}

console.log(`\nself-time across a full scroll (${total} samples)\n`)
console.log('  %total   samples   function')
console.log('-'.repeat(96))
for (const [name, count] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 22)) {
  console.log(`${((count / total) * 100).toFixed(1).padStart(6)}%${String(count).padStart(11)}   ${name.slice(0, 70)}`)
}

const buckets = { shaderCompile: 0, geometry: 0, material: 0, html: 0, react: 0, render: 0, other: 0 }
for (const [name, count] of self) {
  if (/compile|WebGLProgram|getProgram|programCache|linkProgram|acquireProgram/i.test(name)) buckets.shaderCompile += count
  else if (/Geometry|BufferAttribute|computeBounding/i.test(name)) buckets.geometry += count
  else if (/Material|texture|PMREM|envmap/i.test(name)) buckets.material += count
  else if (/Html|occlude|calculatePosition/i.test(name)) buckets.html += count
  else if (/react|renderWithHooks|commit|reconcile/i.test(name)) buckets.react += count
  else if (/three|WebGLRenderer|render/i.test(name)) buckets.render += count
  else buckets.other += count
}
console.log('\nbuckets:')
for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) {
  if (v) console.log(`  ${k.padEnd(14)} ${((v / total) * 100).toFixed(1)}%`)
}