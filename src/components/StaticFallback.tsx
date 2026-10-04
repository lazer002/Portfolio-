'use client'

import { CHAPTER_COPY } from '@/components/copy'
import { SCENES } from '@/config/scenes'

/**
 * The no-WebGL fallback.
 *
 * context.txt: "Mobile keeps the storytelling but simplifies expensive effects"
 * and "Provide readable HTML equivalents for important text." When the device
 * cannot run the WebGL layer at all, the storytelling still has to survive — so
 * this is the same fourteen chapters as one continuous, scrollable document.
 *
 * It is not a degraded copy: the same copy components render, so the content is
 * identical. Only the 3D layer is absent, and the page says so plainly rather
 * than pretending.
 */

export function StaticFallback() {
  return (
    <main className="fallback" id="chapter-index">
      <p className="fallback__notice">
        This device cannot run the 3D layer. The full written portfolio is below.
      </p>

      {SCENES.map((scene, index) => {
        const copy = CHAPTER_COPY[index]
        const Body = copy.Body
        return (
          <section key={scene.id} className="fallback__section" aria-labelledby={`fallback-${scene.id}`}>
            <p className="fallback__eyebrow">
              {scene.id} · {scene.eyebrow.toUpperCase()}
            </p>
            <h2 className="fallback__title" id={`fallback-${scene.id}`}>
              {copy.heading}
            </h2>
            <p className="fallback__intent">{scene.intent}</p>
            <Body reduced={true} />
          </section>
        )
      })}
    </main>
  )
}