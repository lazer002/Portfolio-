/**
 * CPU self-time profile for a single chapter.
 *
 * `scripts/diagnose.mjs` says *that* a chapter is slow. This says *which code* is
 * slow, using the CDP profiler's own self-time attribution rather than a list of
 * plausible suspects. Guessing between "31 transmissive materials", "31 drei
 * <Html> overlays" and "per-frame React work" is exactly how a previous round of
 * this build produced a comfortable-looking GPU number next to an unwatchable
 * page.
 *
 * Usage:
 *   node scripts/profile-chapter.mjs            # production build
 *   DEV=1 node scripts/profile-chapter.mjs      # dev server
 *   FRAC=0.85 node scripts/profile-chapter.mjs  # scroll fraction to profile
 */
import { homedir } from 'node:os'
import { globSync } from 'node:fs'
import { join } from 'node:path'
import { createRequire } from 'node:module'

import { startServer } from './lib/server.mjs'

const DEV = Boolean(process.env.DEV)
const FRAC = Number(process.env.FRAC ?? 0.85)

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

await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
await page.waitForTimeout(DEV ? 10000 : 5000)

// Scroll to the target and let it settle: shader compilation and chapter mount
// happen on arrival, and profiling those would rank one-time setup as though it
// were steady-state cost.
await page.evaluate((f) => {
  const max = document.documentElement.scrollHeight - window.innerHeight
  window.scrollTo({ top: max * f, behavior: 'instant' })
}, FRAC)
await page.waitForTimeout(3000)

const client = await page.context().newCDPSession(page)
await client.send('Profiler.enable')
await client.send('Profiler.setSamplingInterval', { interval: 100 })
await client.send('Profiler.start')

// 3s of steady-state frames, which at 25fps is the ~75 frames that matter.
await page.waitForTimeout(3000)

const { profile } = await client.send('Profiler.stop')

await browser.close()
await server.stop()

/** Aggregates samples by function, keeping self time only. */
const byId = new Map(profile.nodes.map((n) => [n.id, n]))
const self = new Map()

for (const id of profile.samples ?? []) {
  const node = byId.get(id)
  if (!node) continue
  const f = node.callFrame
  // Skip the profiler's own bookkeeping and the rAF driver itself: every frame
  // passes through them and they would top the table without being the cause.
  const url = f.url || ''
  if (url.includes('devtools') || f.functionName === '(root)' || f.functionName === '(idle)') continue

  const key = `${f.functionName || '(anonymous)'} @ ${url.split('/').slice(-1)[0]}:${f.lineNumber + 1}`
  self.set(key, (self.get(key) ?? 0) + 1)
}

const total = [...self.values()].reduce((a, b) => a + b, 0)
if (total === 0) {
  console.log('no samples captured')
  process.exit(1)
}

console.log(`\nscroll fraction ${FRAC} — chapter:`, await Promise.resolve('(server stopped)'))
console.log(`\ntop self-time functions over ~3s (${total} samples)\n`)
console.log('  %total   samples   function')
console.log('-'.repeat(96))
for (const [name, count] of [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 25)) {
  const pct = ((count / total) * 100).toFixed(1)
  console.log(`${pct.padStart(6)}%${String(count).padStart(11)}   ${name.slice(0, 68)}`)
}

// Group into buckets so the verdict is legible rather than a wall of frames.
const buckets = { html: 0, materials: 0, react: 0, three: 0, gsap: 0, other: 0 }
for (const [name, count] of self) {
  if (/Html|occlude|calculatePosition/i.test(name)) buckets.html += count
  else if (/Material|shader|compile|transmission/i.test(name)) buckets.materials += count
  else if (/react|useFrame|renderWithHooks|commit/i.test(name)) buckets.react += count
  else if (/three|WebGLRenderer|BufferGeometry/i.test(name)) buckets.three += count
  else if (/gsap|lenis|ScrollTrigger|ticker/i.test(name)) buckets.gsap += count
  else buckets.other += count
}

console.log('\nbuckets:')
for (const [k, v] of Object.entries(buckets).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(10)} ${((v / total) * 100).toFixed(1)}%`)
}