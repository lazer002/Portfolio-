'use client'

import { createContext, useContext, type FC, type ReactNode } from 'react'

import { useChapter } from '@/lib/useChapter'

/**
 * Tells a 3D component which chapter owns it, and whether that chapter is the
 * active one.
 *
 * This exists for one specific bug. `SceneHost` mounts a window of three chapters
 * so objects can hand off to each other, and each chapter hides its own geometry
 * with `group.visible = alive > 0.01` when it is not in range. But drei's
 * `<Html>` portals its element into a DOM overlay and ignores the parent's
 * visibility flag — so a neighbouring chapter's labels stayed on screen,
 * floating in front of whatever the camera was actually looking at.
 *
 * Three-dimensional objects respect `visible`. DOM labels need to be told
 * explicitly, and this is how.
 */

const ChapterContext = createContext<{ index: number; active: boolean }>({
  index: -1,
  active: true,
})

export function ChapterScope({ index, children }: { index: number; children: ReactNode }) {
  const active = useChapter()
  return <ChapterContext.Provider value={{ index, active: active === index }}>{children}</ChapterContext.Provider>
}

export function useChapterScope(): { index: number; active: boolean } {
  return useContext(ChapterContext)
}

/** Convenience for components that only care whether they are on screen. */
export function useIsActiveChapter(): boolean {
  return useChapterScope().active
}

export type ChapterAware<T> = FC<T>