'use client'

import { AnimatePresence, motion } from 'framer-motion'

import { CHAPTER_COPY } from '@/components/copy'
import { SCENES } from '@/config/scenes'
import { useChapter } from '@/lib/useChapter'
import { useReducedMotion } from '@/lib/useReducedMotion'

/**
 * The DOM overlay.
 *
 * context.txt FRAMER MOTION DOM LAYER: "Do not attempt to render all typography
 * inside WebGL… Use AnimatePresence only for UI elements that genuinely enter and
 * leave… Keep the primary heading visible long enough for the visitor to
 * understand the section… Avoid exaggerated bounce animations."
 *
 * So: headings and labels live here, in real DOM, animated with translateY and
 * opacity only. AnimatePresence wraps exactly one thing — the chapter copy block
 * — because that genuinely enters and leaves. Nothing else uses it.
 *
 * All factual content comes from `components/copy`, which in turn imports only
 * from `config/content` and `config/scenes`.
 */

const variants = {
  hidden: { opacity: 0, y: 26 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -16 },
}

/** No springs, no overshoot: the easing is a decelerating cubic. */
const transition = { duration: 0.5, ease: [0.22, 0.61, 0.36, 1] as const }

export function ChapterCopy() {
  const chapter = useChapter()
  const reduced = useReducedMotion()
  const scene = SCENES[chapter]
  const copy = CHAPTER_COPY[chapter]
  const Body = copy.Body

  return (
    <div className="chapter-copy">
      <AnimatePresence mode="wait" initial={false}>
        <motion.section
          key={scene.id}
          className="chapter-copy__section"
          initial={reduced ? { opacity: 0 } : 'hidden'}
          animate={reduced ? { opacity: 1 } : 'visible'}
          exit={reduced ? { opacity: 0 } : 'exit'}
          variants={reduced ? undefined : variants}
          transition={transition}
          aria-labelledby={`chapter-${scene.id}-title`}
        >
          <p className="chapter-copy__eyebrow">
            <span className="chapter-copy__index">{scene.id}</span>
            <span className="chapter-copy__rule" aria-hidden="true" />
            <span>{scene.eyebrow.toUpperCase()}</span>
          </p>
          <h2 className="chapter-copy__title" id={`chapter-${scene.id}-title`}>
            {copy.heading}
          </h2>
          <Body reduced={reduced} />
        </motion.section>
      </AnimatePresence>
    </div>
  )
}