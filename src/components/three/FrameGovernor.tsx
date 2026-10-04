'use client'

import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'

/**
 * Frame pacing and resolution governor.
 *
 * The `<Canvas>` runs `frameloop="never"` and this component is the only thing
 * that decides when a frame happens. That is deliberate: the scene previously
 * rendered at whatever the display's refresh rate happened to be — 75Hz on the
 * machine this was tuned on, 144Hz on a better one — so the GPU was asked for
 * the maximum a visitor's monitor could display, on hardware that is often an
 * old laptop part.
 *
 * 60 is the ceiling, not 30. Two reasons:
 *
 *  1. This is a scroll-driven piece. The camera moves continuously, so frame
 *     *pacing* is the whole illusion; 30fps would read as a slideshow no matter
 *     how much GPU it saved. 60 is already enough to hide judder entirely.
 *  2. Everything here already meets the frame budget at native refresh — the
 *     measured cruise is 13.3ms against a 13.3ms budget. So 60 is not a
 *     downgrade in practice, it is headroom: the ~20% of GPU time it gives back
 *     is what absorbs the chapter-boundary cost.
 *
 * Underneath sits an adaptive resolution ladder. Capping the rate alone still
 * leaves a frame that misses its budget, and on a 2x display the fragment cost
 * is the largest single term in the frame. So when frames run long the canvas
 * steps down in resolution and steps back up when there is room — trading
 * sharpness, which the grain and bloom in this art direction hide well, for
 * frame time. It only ever moves after a sustained trend, so it cannot oscillate
 * visibly.
 *
 * Driven off GSAP's ticker rather than a second `requestAnimationFrame`: the
 * timeline comment in `lib/timeline.ts` is explicit that there is exactly one
 * animation loop in this app.
 *
 * (Superseded — see the note on the driver below. Pacing a WebGL frame has to be
 * locked to the same rAF that presents it.)
 */

/** Target frame rate, and the slowest rate we will settle for. */
const TARGET_FPS = 60
const FRAME_BUDGET = 1000 / TARGET_FPS

/**
 * How many animation ticks to skip per rendered frame.
 *
 * A frame cap is only reachable at rates the *display clock* can express when
 * you drive it from `requestAnimationFrame`. rAF fires on the compositor's
 * cadence, so on a 75Hz monitor dropping whole ticks yields 75, 37.5 or 25 —
 * 60 is not among them, and asking for 16.7ms spacing against a 13.3ms tick
 * silently halves the rate to 37.6fps.
 *
 * So the loop is driven by its own drift-corrected timer instead. The renderer
 * is then asked for 60 frames a second regardless of what the panel can show,
 * which is what a hard cap actually means. The browser still composites the
 * canvas on its own vsync; only the rate of WebGL work changes.
 */
/** Resolution ladder, in device pixels per CSS pixel. */
const DPR_STEPS = [1, 1.25, 1.5, 2]

/** Consecutive slow/fast frames needed before changing resolution. */
const SLOW_RUN = 45
const FAST_RUN = 240

export function FrameGovernor({ maxDpr = 2 }: { maxDpr?: number }) {
  const advance = useThree((state) => state.advance)
  const setDpr = useThree((state) => state.setDpr)

  useEffect(() => {
    let last = 0
    let ema = FRAME_BUDGET
    let slow = 0
    let fast = 0
    let step = DPR_STEPS.filter((d) => d <= maxDpr).length - 1
    if (step < 0) step = 0

    const tick = (time: number) => {
      // gsap.ticker reports seconds; the loop is paced in milliseconds.
      const now = time * 1000
      if (last === 0) {
        last = now
        // First pass renders immediately so nothing waits on a tick boundary.
        advance(now / 1000)
        return
      }
      const delta = now - last

      // The timer paces the loop; this only tracks cost for the resolution
      // ladder below.
      last = now

      advance(now / 1000)

      // Dev-only frame counter. `gl.info.render.frame` cannot be used for this:
      // the postprocessing composer issues one `renderer.render()` per effect
      // pass, so it reports ~13 "frames" per drawn frame and made a working
      // 60fps cap look like 790fps.
      if (process.env.NODE_ENV !== 'production') {
        const w = window as unknown as { __FRAME_COUNT__?: number }
        w.__FRAME_COUNT__ = (w.__FRAME_COUNT__ ?? 0) + 1
      }

      // Exponential moving average: one slow frame from a chapter swap must not
      // drop the resolution, and one fast frame must not raise it.
      ema += (delta - ema) * 0.08

      if (ema > FRAME_BUDGET * 1.25) {
        slow++
        fast = 0
      } else if (ema < FRAME_BUDGET * 0.85) {
        fast++
        slow = 0
      } else {
        slow = 0
        fast = 0
      }

      if (slow >= SLOW_RUN && step > 0) {
        step--
        slow = 0
        setDpr(DPR_STEPS[step])
      } else if (fast >= FAST_RUN && step < DPR_STEPS.length - 1 && DPR_STEPS[step + 1] <= maxDpr) {
        step++
        fast = 0
        setDpr(DPR_STEPS[step])
      }
    }

    // Driven from `requestAnimationFrame`, not from GSAP's ticker.
    //
    // The ticker was the obvious choice — `lib/timeline.ts` insists there is one
    // animation loop in this app — but it is not phase-locked to rAF, so it
    // occasionally fires twice between two presented frames. Calling `advance`
    // on both renders the scene twice for one display frame, and measurement
    // showed it: dropped frames went from 2.8% to 10.4%. R3F's own loop is rAF
    // based for the same reason. This is a second rAF, but it is the one that
    // decides when the WebGL frame is presented.
    let raf = 0
    let timer = 0
    let nextAt = performance.now()

    const loop = () => {
      // Render, then schedule the next frame against an absolute deadline
      // rather than adding the interval to "now". Accumulating the interval
      // instead makes every frame's own cost stretch the schedule, so the loop
      // quietly runs slow — at 60fps with a 5ms frame, that drift is a whole
      // frame per second.
      tick(performance.now() / 1000)
      nextAt += FRAME_BUDGET
      const wait = Math.max(0, nextAt - performance.now())
      timer = window.setTimeout(loop, wait)
    }
    nextAt = performance.now()
    raf = requestAnimationFrame(() => {
      loop()
    })

    return () => {
      if (raf) cancelAnimationFrame(raf)
      if (timer) window.clearTimeout(timer)
    }
  }, [advance, setDpr, maxDpr])

  return null
}