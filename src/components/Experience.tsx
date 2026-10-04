'use client'

import dynamic from 'next/dynamic'
import { useMemo, useRef, useState } from 'react'

import { A11yContent } from '@/components/A11yContent'
import { ChapterCopy } from '@/components/ChapterCopy'
import { Cursor } from '@/components/Cursor'
import { Loader } from '@/components/Loader'
import { Navigation } from '@/components/Navigation'
import { StaticFallback } from '@/components/StaticFallback'
import { SCROLL_TRACK_VH } from '@/config/scenes'
import { detectCapabilities } from '@/lib/device'
import { useScrollDriver } from '@/lib/timeline'

/**
 * The interactive experience.
 *
 * This component is only ever loaded on the client — `page.tsx` imports it with
 * `ssr: false`, because that option is not permitted in a Server Component.
 * That is what makes a lazy `useState` initialiser safe here: there is no server
 * render for this tree, so reading `window` during the first render cannot
 * produce a hydration mismatch. Capability detection therefore happens exactly
 * once, synchronously, with no effect and no cascading render.
 *
 * If the device cannot run the WebGL layer at all, the same fourteen chapters
 * are rendered as one continuous document instead. The content is identical —
 * only the 3D layer is absent.
 */

const SceneWorld = dynamic(() => import('@/components/three/SceneWorld').then((m) => m.SceneWorld), {
  loading: () => <div className="canvas-placeholder" aria-hidden="true" />,
})

export function Experience() {
  // Lazy initialiser: capabilities are read once, at first render, on a client
  // that has already been detected as capable of running the WebGL layer.
  const [caps] = useState(() => detectCapabilities())
  const [ready, setReady] = useState(false)
  const trackRef = useRef<HTMLDivElement>(null)

  useScrollDriver({ trackRef, onReady: () => setReady(true) })

  const trackStyle = useMemo(() => ({ height: `${SCROLL_TRACK_VH}vh` }), [])

  if (caps.fallback) {
    return (
      <>
        <A11yContent />
        <StaticFallback />
      </>
    )
  }

  return (
    <>
      <A11yContent />
      <Loader ready={ready} />

      <div className="stage">
        <SceneWorld />
      </div>

      <Navigation />
      <ChapterCopy />
      <Cursor />

      {/*
        The scroll surface. Its height is the entire timeline: fourteen fixed
        intervals, each one derived from the chapter table in config/scenes.
      */}
      <div ref={trackRef} className="scroll-track" style={trackStyle} aria-hidden="true" />
    </>
  )
}