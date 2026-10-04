'use client'

import { useEffect, useRef } from 'react'
import gsap from 'gsap'

import { frame } from '@/lib/store'

/**
 * The cursor.
 *
 * Two responsibilities, and deliberately only two:
 *  1. Feed the shared frame store with normalised pointer position, so every
 *     scene can react to proximity without installing its own listener.
 *  2. Provide a pointer affordance appropriate to a machine interface.
 *
 * context.txt: "On mobile, cursor interactions become touch interactions."
 * Rather than maintaining a second touch code path, the store carries
 * `pointer.coarse` and the scenes use proximity rather than click semantics — so
 * a finger dragging across the screen produces exactly the response a mouse
 * would.
 *
 * The damping runs on GSAP's ticker rather than its own requestAnimationFrame.
 * The brief asks for a single animation clock ("use requestAnimationFrame only
 * where it cannot be replaced by the render loop"), and this is the DOM's share
 * of it.
 *
 * Every listener is removed and the ticker callback detached on unmount.
 */

export function Cursor() {
  const dotRef = useRef<HTMLDivElement>(null)
  const ringRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const pointer = frame.pointer
    const coarse = !window.matchMedia('(pointer: fine)').matches
    pointer.coarse = coarse

    const onMove = (event: PointerEvent) => {
      pointer.x = (event.clientX / window.innerWidth) * 2 - 1
      pointer.y = -((event.clientY / window.innerHeight) * 2 - 1)
      pointer.active = true
    }

    const onLeave = () => {
      pointer.active = false
    }

    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onMove, { passive: true })
    document.addEventListener('pointerleave', onLeave)
    window.addEventListener('blur', onLeave)

    const tick = () => {
      const dot = dotRef.current
      const ring = ringRef.current
      if (!dot || !ring) return

      // The dot tracks the pointer exactly; the ring lags. That difference is
      // what makes the two read as deliberate rather than broken.
      dot.style.transform = `translate3d(${pointer.x * 50}vw, ${-pointer.y * 50}vh, 0) translate(-50%, -50%)`

      const lambda = frame.reducedMotion ? 1 : 0.12
      pointer.dx += (pointer.x - pointer.dx) * lambda
      pointer.dy += (pointer.y - pointer.dy) * lambda

      const idle = pointer.active ? 1 : 1.6
      const scale = idle + Math.hypot(pointer.dx, pointer.dy) * 0.05
      ring.style.transform = `translate3d(${pointer.dx * 50}vw, ${-pointer.dy * 50}vh, 0) translate(-50%, -50%) scale(${scale})`
      ring.style.opacity = pointer.active ? '1' : '0'
    }

    gsap.ticker.add(tick)

    return () => {
      gsap.ticker.remove(tick)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
      document.removeEventListener('pointerleave', onLeave)
      window.removeEventListener('blur', onLeave)
    }
  }, [])

  return (
    <div className="cursor" aria-hidden="true">
      <div ref={ringRef} className="cursor__ring" />
      <div ref={dotRef} className="cursor__dot" />
    </div>
  )
}