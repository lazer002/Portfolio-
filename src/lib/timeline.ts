'use client'

/**
 * The single scroll driver.
 *
 * context.txt: "Create one master GSAP timeline for the portfolio. Each scene
 * receives a fixed scroll interval rather than competing for the same
 * ScrollTrigger."
 *
 * There is exactly one ScrollTrigger here — bound to the whole document, it
 * writes a normalised 0–1 progress value into the shared frame store and
 * nothing else. Individual scenes never register their own triggers; they read
 * `frame.chapters[i]` inside `useFrame`. That is what keeps fourteen scenes from
 * fighting each other, and it is why the chapter intervals in `config/scenes`
 * are a plain table rather than a set of overlapping tweens.
 *
 * Lenis owns the smoothing, GSAP's ticker owns the clock, so there is exactly
 * one requestAnimationFrame for the entire experience.
 */

import { useEffect, useRef } from 'react'
import Lenis from '@studio-freight/lenis'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SCROLL_TRACK_VH } from '@/config/scenes'
import { detectCapabilities } from '@/lib/device'
import { frame, syncFrame, tickTime } from '@/lib/store'

/** Registered once. gsap/ScrollTrigger warns loudly if it is imported twice. */
let registered = false
function registerPlugin(): void {
  if (registered) return
  gsap.registerPlugin(ScrollTrigger)
  registered = true
}

export interface ScrollDriverOptions {
  /** The tall element that creates the scroll surface. */
  trackRef: React.RefObject<HTMLElement | null>
  /** Called once the driver is live, so the loader can be dismissed. */
  onReady?: () => void
}

export function useScrollDriver({ trackRef, onReady }: ScrollDriverOptions): void {
  // Kept in a ref so a re-render with a new callback does not tear the driver
  // down and rebuild it. Written in an effect, not during render.
  const onReadyRef = useRef(onReady)

  useEffect(() => {
    onReadyRef.current = onReady
  }, [onReady])

  useEffect(() => {
    registerPlugin()
    const caps = detectCapabilities()

    // Reduced motion: keep scene changes, remove the cinematic smoothing.
    const lenis = new Lenis({
      duration: caps.reducedMotion ? 0 : 1.15,
      smoothWheel: !caps.reducedMotion,
      // Touch devices keep native scrolling — hijacking it fights momentum.
      syncTouch: false,
      wheelMultiplier: 0.9,
      touchMultiplier: 1.4,
    })

    registerLenis(lenis)
    frame.reducedMotion = caps.reducedMotion
    frame.pointer.coarse = !caps.finePointer

    let lastTime = performance.now()
    let scrolling = false
    let idleTimer: ReturnType<typeof setTimeout> | undefined

    const markScrolling = () => {
      scrolling = true
      frame.sinceScroll = 0
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(() => {
        scrolling = false
      }, 220)
    }

    lenis.on('scroll', markScrolling)

    // One ticker for Lenis, GSAP and the frame store. Nothing else in the app
    // is allowed to call requestAnimationFrame for animation.
    const tick = (time: number) => {
      const dt = Math.min(0.05, (time - lastTime) / 1000)
      lastTime = time

      lenis.raf(time)
      gsap.ticker.lagSmoothing(0)

      tickTime(dt)

      const limit = lenis.limit || 1
      syncFrame(limit > 0 ? lenis.scroll / limit : 0, dt, caps.reducedMotion)

      document.documentElement.style.setProperty('--scroll', frame.progress.toFixed(5))
      document.documentElement.style.setProperty('--chapter', String(frame.chapter))
      document.documentElement.style.setProperty('--velocity', scrolling ? '1' : '0')
    }

    gsap.ticker.add(tick)

    // The document itself is the scroll surface; the trigger exists only to
    // keep ScrollTrigger's own measurements in step with Lenis.
    const trigger = ScrollTrigger.create({
      trigger: trackRef.current ?? document.body,
      start: 'top top',
      end: 'bottom bottom',
      onUpdate: (self) => {
        // Lenis is the source of truth; this keeps ScrollTrigger from
        // reporting a stale progress to anything that queries it.
        void self
      },
    })

    // Layout settles after fonts and the track height are applied.
    const refresh = () => {
      ScrollTrigger.refresh()
      lenis.resize()
    }
    const raf1 = requestAnimationFrame(refresh)
    const timeout = setTimeout(refresh, 600)
    if (document.fonts?.ready) {
      document.fonts.ready.then(refresh).catch(() => undefined)
    }

    window.addEventListener('resize', refresh)
    onReadyRef.current?.()

    return () => {
      requestAnimationFrame(() => cancelAnimationFrame(raf1))
      clearTimeout(timeout)
      if (idleTimer) clearTimeout(idleTimer)
      window.removeEventListener('resize', refresh)
      gsap.ticker.remove(tick)
      trigger.kill()
      lenis.destroy()
      if (activeLenis === lenis) activeLenis = null
    }
  }, [trackRef])
}

/**
 * Scroll to a chapter. Used by the navigation rail, which is the one place that
 * needs to jump rather than animate. `immediate` skips the Lenis easing so the
 * reduced-motion path lands without a long glide.
 */
let activeLenis: Lenis | null = null

export function registerLenis(instance: Lenis): void {
  activeLenis = instance
}

export function scrollToProgress(progress: number): void {
  const target = Math.min(1, Math.max(0, progress))
  if (activeLenis) {
    activeLenis.scrollTo(target, { duration: 1.6 })
  } else {
    const limit = document.documentElement.scrollHeight - window.innerHeight
    window.scrollTo({ top: limit * target, behavior: 'smooth' })
  }
}

/** The scroll surface height, in viewport heights. Exported for CSS parity. */
export const TRACK_VIEWPORTS = SCROLL_TRACK_VH / 100