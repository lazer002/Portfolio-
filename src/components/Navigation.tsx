'use client'

import { SCENES } from '@/config/scenes'
import { scrollToProgress } from '@/lib/timeline'
import { useChapter } from '@/lib/useChapter'

/**
 * Chapter navigation.
 *
 * A rail of fourteen entries with a progress readout, plus the skip link the
 * brief's accessibility rules imply ("Interactive project links must remain
 * keyboard accessible"). Every entry is a real `<button>` with an
 * `aria-current`, so the whole rail is reachable by keyboard without a single
 * custom key handler.
 *
 * Jumping goes through `scrollToProgress`, which asks Lenis to glide to the
 * target rather than teleporting — the scroll position stays deterministic
 * either way, but the arrival does not jerk.
 */
export function Navigation() {
  const chapter = useChapter()

  return (
    <nav className="nav" aria-label="Chapters">
      <a className="skip-link" href="#chapter-index">
        Skip to the written index
      </a>

      <ol className="nav__list">
        {SCENES.map((scene, index) => {
          const current = index === chapter
          return (
            <li key={scene.id}>
              <button
                type="button"
                className={`nav__item${current ? ' is-current' : ''}`}
                aria-current={current ? 'true' : undefined}
                onClick={() => scrollToProgress((scene.progressStart + scene.progressEnd) / 2)}
              >
                <span className="nav__id">{scene.id}</span>
                <span className="nav__title">{scene.title}</span>
                <span className="nav__tick" aria-hidden="true" />
              </button>
            </li>
          )
        })}
      </ol>

      <p className="nav__readout" aria-hidden="true">
        <span className="nav__readout-value">{String(chapter + 1).padStart(2, '0')}</span>
        <span className="nav__readout-total">/ {String(SCENES.length).padStart(2, '0')}</span>
      </p>
    </nav>
  )
}