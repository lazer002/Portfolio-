/**
 * Visibility probe.
 *
 * Answers the only question that matters for a dark art direction: is there
 * actually anything on screen?
 *
 * Two measurement traps this had to avoid:
 *   1. `gl.readPixels` returns all zeros because the renderer runs without
 *      `preserveDrawingBuffer`. That reads as "total blackness" for a scene
 *      that is merely dark, and it sent this debugging in the wrong direction.
 *   2. Screenshotting the whole page measures the DOM overlay, not the render.
 *
 * So this hides the overlay, screenshots the compositor's own output, and
 * decodes the PNG.
 *
 * Usage: node scripts/visibility.mjs
 */
import { loadBrowser, scrollToFraction, startServer } from './lib/server.mjs'
import { decodePng, frameStats } from './lib/png.mjs'

const { chromium } = await loadBrowser()
const server = await startServer()

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const pageErrors = []
page.on('pageerror', (e) => pageErrors.push(e.message))
page.on('console', (m) => {
  if (m.type() === 'error') pageErrors.push(m.text())
})

await page.goto(`http://localhost:${server.port}/`, { waitUntil: 'load' })
await page.waitForTimeout(4500)

// Hide the DOM layer so the screenshot is the WebGL render alone.
await page.addStyleTag({
  content: '.chapter-copy, .nav, .cursor, .loader, .sr-only { display: none !important }',
})

const STOPS = [0.05, 0.13, 0.22, 0.3, 0.38, 0.46, 0.54, 0.62, 0.7, 0.78, 0.86, 0.95]
const rows = []

for (const frac of STOPS) {
  await scrollToFraction(page, frac)

  const title = await page.evaluate(
    () => document.querySelector('.chapter-copy__title')?.textContent?.trim() ?? '?',
  )
  const shot = await page.screenshot({ type: 'png' })
  rows.push({ title, ...frameStats(decodePng(shot)) })

  if (frac === 0.05) await page.screenshot({ path: 'scripts/shot-ch01.png' })
  if (frac === 0.38) await page.screenshot({ path: 'scripts/shot-ch05.png' })
  if (frac === 0.7) await page.screenshot({ path: 'scripts/shot-ch11.png' })
}

await browser.close()
await server.stop()

console.log('\ntitle                        mean    lit%  bright%   cyan%  green%  violet%')
console.log('---------------------------------------------------------------')
for (const r of rows) {
  console.log(
    `${r.title.slice(0, 24).padEnd(26)}${String(r.mean).padStart(5)}${String(r.litPct).padStart(8)}` +
      `${String(r.brightPct).padStart(9)}${String(r.cyanPct).padStart(8)}${String(r.greenPct).padStart(8)}` +
      `${String(r.violetPct).padStart(8)}`,
  )
}

const dark = rows.filter((r) => r.litPct < 2)
const flat = rows.filter((r) => r.brightPct < 0.02)

console.log(`\nmean luminance range: ${Math.min(...rows.map((r) => r.mean))} … ${Math.max(...rows.map((r) => r.mean))}`)
console.log(`chapters barely lit (<2%):   ${dark.length}/${rows.length}`)
console.log(`chapters with no highlights: ${flat.length}/${rows.length}`)
if (pageErrors.length) {
  console.log(`\npage errors (${pageErrors.length}):`)
  for (const e of [...new Set(pageErrors)].slice(0, 5)) console.log('  ' + e.slice(0, 160))
}

if (dark.length) {
  console.log('\nFAIL: frames render but there is nothing to see')
  process.exit(1)
}
console.log('\nPASS: every chapter has visible content')