'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

import { engineer } from '@/config/content'

/**
 * The loader.
 *
 * context.txt STATE A — PRELOAD: "Load only the assets required for this scene
 * and its immediate predecessor. Keep the scene invisible while assets
 * initialize. Do not block the entire application on optional project media."
 *
 * There is no project media to block on, and nothing here waits on a network
 * asset — the whole experience is procedural geometry. So the loader is honest
 * about what it is: a short boot sequence that holds the curtain until the
 * WebGL layer has drawn its first frame, then gets out of the way.
 *
 * It never traps the visitor. `MAX_DURATION` guarantees dismissal even if the
 * first frame is slow on a weak device.
 */

const BOOT_LINES = [
  'BOOTING CYBERPUNK RENDER CORE',
  'MOUNTING SCENE GRAPH',
  'CALIBRATING SCROLL TIMELINE',
]

/** Hard ceiling. A loader that can stall forever is a bug, not a feature. */
const MAX_DURATION = 2600

export function Loader({ ready }: { ready: boolean }) {
  const [visible, setVisible] = useState(true)
  const [line, setLine] = useState(0)

  useEffect(() => {
    // Cycle the boot lines while the scene warms up.
    const step = window.setInterval(() => {
      setLine((current) => Math.min(current + 1, BOOT_LINES.length - 1))
    }, 620)

    // Dismiss on ready, or on the ceiling — whichever comes first.
    const dismiss = window.setTimeout(() => setVisible(false), MAX_DURATION)
    const onReady = () => {
      // A short beat so the last boot line is legible before the curtain lifts.
      window.setTimeout(() => setVisible(false), 380)
    }

    if (ready) onReady()
    return () => {
      window.clearInterval(step)
      window.clearTimeout(dismiss)
    }
  }, [ready])

  useEffect(() => {
    document.documentElement.classList.toggle('is-loading', visible)
    return () => document.documentElement.classList.remove('is-loading')
  }, [visible])

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          className="loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: [0.22, 0.61, 0.36, 1] }}
          role="status"
          aria-live="polite"
          aria-label="Loading the experience"
        >
          <p className="loader__name">{engineer.name.toUpperCase()}</p>
          <p className="loader__line">{BOOT_LINES[line]}</p>
          <div className="loader__bar" aria-hidden="true">
            <motion.span
              className="loader__bar-fill"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: MAX_DURATION / 1000, ease: 'linear' }}
            />
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}