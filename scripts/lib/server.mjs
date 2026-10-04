/**
 * Shared probe server helper.
 *
 * `next start` on Windows detaches from the shell that spawned it, so
 * `pkill -f next` does not reliably kill it. An orphaned server from an earlier
 * run then keeps answering on the same port, and a probe silently measures a
 * STALE BUILD and reports a failure that does not exist in the current code.
 * That cost hours of debugging time once already.
 *
 * So: bind port 0, ask the OS for a genuinely free port, and use that. Nothing
 * stale can be listening on a port the OS just handed out.
 */
import { createServer } from 'node:http'
import { spawn } from 'node:child_process'

/** Asks the OS for a free port by binding and immediately releasing it. */
export function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.unref()
    probe.on('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close(() => resolve(port))
    })
  })
}

/**
 * Boots `next start` (or `next dev`) on a free port and waits for it to answer.
 * Returns the port and a stop function that kills the whole process tree.
 */
export async function startServer({ dev = false, timeout = dev ? 90000 : 45000 } = {}) {
  // Reuse an already-running server when asked. Next refuses to start a second
  // `next dev` for the same directory ("Another next dev server is already
  // running"), so probing while the author has one open used to fail outright
  // rather than measure the thing that is actually on screen.
  const external = process.env.PROBE_URL
  if (external) {
    const url = new URL(external)
    const res = await fetch(url.origin)
    if (!res.ok) throw new Error(`PROBE_URL ${external} answered ${res.status}`)
    return { port: Number(url.port || 80), external: true, async stop() {} }
  }

  const port = await freePort()

  const child = spawn('npx', ['next', dev ? 'dev' : 'start', '--port', String(port)], {
    stdio: 'ignore',
    shell: true,
    detached: true, // its own process group, so we can kill the tree on Windows
  })

  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://localhost:${port}/`)
      if (res.ok) {
        return {
          port,
          async stop() {
            try {
              // Negative PID targets the process group on POSIX; on Windows
              // taskkill /T takes the tree.
              if (process.platform === 'win32') {
                spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' })
              } else {
                process.kill(-child.pid, 'SIGTERM')
              }
            } catch {
              /* already gone */
            }
          },
        }
      }
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 400))
  }

  throw new Error(`next ${dev ? 'dev' : 'start'} did not come up on port ${port}`)
}

/** Loads Playwright from the project, falling back to the npx cache. */
export async function loadBrowser() {
  const { createRequire } = await import('node:module')
  const { homedir } = await import('node:os')
  const { globSync } = await import('node:fs')
  const { join } = await import('node:path')
  const require = createRequire(import.meta.url)
  try {
    return require('playwright')
  } catch {
    const hit = globSync(join(homedir(), 'AppData', 'Local', 'npm-cache', '_npx', '*', 'node_modules', 'playwright', 'index.js'))
    if (!hit.length) throw new Error('playwright not found; run: npm i -D playwright')
    return createRequire(hit[0])('./index.js')
  }
}

/** Scrolls to a fraction of the page and lets the frame settle. */
export async function scrollToFraction(page, fraction, settle = 1400) {
  await page.evaluate((f) => {
    const max = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: max * f, behavior: 'instant' })
  }, fraction)
  await page.waitForTimeout(settle)
}