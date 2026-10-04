'use client'

import { useMemo, useSyncExternalStore } from 'react'

import { CHAPTERS } from '@/components/chapters/registry'
import { ChapterScope } from '@/components/chapters/ChapterContext'
import { SCENES } from '@/config/scenes'
import { getChapterSnapshot, subscribeChapter } from '@/lib/store'
import type { Tier } from '@/lib/device'

/**
 * The chapter host.
 *
 * context.txt STATE E — EXIT: "Disable expensive interaction effects when the
 * scene leaves the active range… Reduce particle count or intensity when the
 * scene is far outside the viewport." Mounting only a window of chapters is how
 * that is enforced in practice: three scenes exist at a time, and the other
 * eleven have unmounted, disposed their geometries and released their
 * materials.
 *
 * The window is deliberately one wider on each side. A scene one interval away
 * still needs to exist for the incoming transition to land on a real object
 * rather than an empty frame.
 *
 * The active index comes from `useSyncExternalStore` over the frame store, so
 * React re-renders three times per scroll, not sixty times a second. The mounted
 * range is a pure function of that index — no state, no effect, nothing to fall
 * out of sync.
 */

interface SceneHostProps {
  tier: Tier
}

/** How many chapters either side of the active one stay mounted. */
const WINDOW = 1

export function SceneHost({ tier }: SceneHostProps) {
  const active = useSyncExternalStore(subscribeChapter, getChapterSnapshot, getChapterSnapshot)

  const chapters = useMemo(() => {
    const range: number[] = []
    for (let i = active - WINDOW; i <= active + WINDOW; i++) {
      if (i >= 0 && i < CHAPTERS.length) range.push(i)
    }
    return range.map((index) => {
      const Component = CHAPTERS[index]
      return (
        <ChapterScope key={SCENES[index].id} index={index}>
          <Component index={index} tier={tier} />
        </ChapterScope>
      )
    })
  }, [active, tier])

  return <>{chapters}</>
}