/**
 * Render smoke test.
 *
 * Typecheck, lint and `next build` all passed while the entire 3D layer was
 * crashing on mount — those gates compile code, they do not execute a React
 * render. This script executes one, against the real production build, in the
 * Edge already installed on the machine (no browser download).
 *
 * Usage:  node scripts/smoke.mjs
 * Exits non-zero if the canvas never mounts, if a page error is thrown, or if
 * the console reports an error.
 */
import { createRequire } from 'node:module'
import { homedir } from 'node:os'
import { globSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Playwright is resolved from the npx cache rather than installed as a project
 * dependency: the goal is to verify a render, not to add a dev dependency or
 * download a browser. `channel: 'msedge'` below drives the Edge already on the
 * machine. If you would rather have it as a real devDependency, run
 * `npm i -D playwright` and this whole block collapses to one import.
 */
function loadPlaywright() {
  try {
    return createRequire(import.meta.url)('playwright')
  } catch {
    const cache = join(homedir(), 'AppData', 'Local', 'npm-cache', '_npx')
    const candidates = globSync(join(cache, '*', 'node_modules', 'playwright', 'index.js'))
    if (!candidates.length) throw new Error('playwright not found; run: npm i -D playwright')
    return createRequire(candidates[0])('./index.js')
  }
}

const { chromium } = loadPlaywright()
import { spawn } from 'node:child_process'

const PORT = 3210

/**
 * The production server is used rather than a hand-rolled static file server,
 * because the real one is what resolves hashed assets, RSC payloads and the
 * client bundle correctly. A hand-rolled one reports failures that belong to
 * the harness, not the app.
 */
const server = spawn('npx', ['next', 'start', '--port', String(PORT)], {
  stdio: 'ignore',
  shell: true,
})

// Poll until it answers, rather than guessing a sleep duration.
async function waitForServer(timeoutMs = 40000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${PORT}/`)
      if (res.ok) return
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 400))
  }
  throw new Error('server did not start')
}

await waitForServer()

const browser = await chromium.launch({ channel: 'msedge', headless: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

const errors = []
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
page.on('console', (m) => {
  if (m.type() === 'error') errors.push(`console: ${m.text()}`)
})

await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' })

// Give the loader, the dynamic WebGL import and the first frames time to run.
await page.waitForTimeout(3500)

const canvas = await page.evaluate(() => {
  const el = document.querySelector('canvas')
  if (!el) return null
  const gl = el.getContext('webgl2') ?? el.getContext('webgl')
  return { width: el.width, height: el.height, hasContext: Boolean(gl) }
})

// Walk through several chapters and confirm the overlay keeps up.
const chapters = []
for (const y of [0, 0.15, 0.32, 0.5, 0.68, 0.86]) {
  await page.evaluate((frac) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: max * frac, behavior: 'instant' })
  }, y)
  await page.waitForTimeout(900)
  chapters.push(
    await page.evaluate(() => ({
      chapter: document.documentElement.style.getPropertyValue('--chapter'),
      eyebrow: document.querySelector('.chapter-copy__eyebrow')?.textContent?.trim() ?? null,
      title: document.querySelector('.chapter-copy__title')?.textContent?.trim() ?? null,
      canvasPixels: (() => {
        const el = document.querySelector('canvas')
        return el ? el.width * el.height : 0
      })(),
    })),
  )
}

await browser.close()
server.kill()

console.log('\ncanvas:', JSON.stringify(canvas))
console.log('\nchapters walked:')
for (const c of chapters) console.log(`  --chapter=${c.chapter}  ${c.title}  [${c.eyebrow}]`)

if (!canvas) {
  console.log('\nFAIL: no canvas mounted')
  process.exit(1)
}
if (errors.length) {
  console.log(`\nFAIL: ${errors.length} error(s)`)
  for (const e of [...new Set(errors)].slice(0, 12)) console.log('  ' + e)
  process.exit(1)
}
const titles = new Set(chapters.map((c) => c.title))
if (titles.size < 4) {
  console.log(`\nFAIL: only ${titles.size} distinct chapters rendered, expected the overlay to advance`)
  process.exit(1)
}
console.log('\nPASS: canvas mounted, chapters advanced, no console errors')