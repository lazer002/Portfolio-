/**
 * Scene-graph probe.
 *
 * `diagnose.mjs` reports that a chapter is slow; `profile-chapter.mjs` reports
 * which JS function is slow. Neither says how big the graph got, which is the
 * input `updateMatrixWorld` and `projectObject` scale with. That is the number
 * to check first when a chapter drops to half rate: a scene with a few hundred
 * objects cannot be costing 13ms of traversal, and one with tens of thousands
 * can be regardless of how little work its `useFrame` does.
 *
 * Usage:
 *   DEV=1 PROBE_URL=http://localhost:3000 node scripts/graph.mjs
 */
import { loadBrowser, scrollToFraction, startServer } from './lib/server.mjs'

const DEV = Boolean(process.env.DEV)

const { chromium } = await loadBrowser()
const server = await startServer({ dev: DEV })

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errors = []
page.on('pageerror', (e) => errors.push(e.message))

await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
await page.waitForTimeout(DEV ? 9000 : 4500)

const STOPS = [0.03, 0.11, 0.19, 0.27, 0.35, 0.43, 0.51, 0.59, 0.67, 0.75, 0.83, 0.89, 0.97]
const rows = []

for (const frac of STOPS) {
  await scrollToFraction(page, frac, 1600)
  rows.push(
    await page.evaluate(() => {
      const s = window.__GL_STATS__ ? window.__GL_STATS__() : null
      return {
        chapter: document.documentElement.style.getPropertyValue('--chapter'),
        title: document.querySelector('.chapter-copy__title')?.textContent?.trim() ?? '?',
        labels: document.querySelectorAll('.holo-label').length,
        dom: document.querySelectorAll('*').length,
        ...(s ?? {}),
      }
    }),
  )
}

await browser.close()
await server.stop()

console.log('\nch  title                       objects  meshes  mats  trans  labels   dom   buffer')
console.log('-'.repeat(88))
for (const r of rows) {
  console.log(
    `${String(r.chapter).padStart(2)}  ${r.title.slice(0, 24).padEnd(26)}` +
      `${String(r.objects ?? -1).padStart(7)}${String(r.meshes ?? -1).padStart(8)}` +
      `${String(r.materials ?? -1).padStart(6)}${String(r.transmissive ?? -1).padStart(7)}` +
      `${String(r.labels).padStart(8)}${String(r.dom).padStart(6)}` +
      `${String(r.drawSize ? `${r.drawSize.x}x${r.drawSize.y}` : '-').padStart(10)}`,
  )
}

const peak = rows.reduce((a, b) => ((b.objects ?? 0) > (a.objects ?? 0) ? b : a), rows[0])
console.log(`\npeak objects: ${peak.objects} (${peak.title})`)
console.log(`peak transmissive materials: ${Math.max(...rows.map((r) => r.transmissive ?? 0))}`)
if (errors.length) {
  console.log(`\npage errors (${errors.length}):`)
  for (const e of [...new Set(errors)].slice(0, 5)) console.log('  ' + e.slice(0, 160))
}