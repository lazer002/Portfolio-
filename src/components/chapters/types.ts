import type { FC } from 'react'

import type { Tier } from '@/lib/device'

/**
 * The contract every chapter satisfies.
 *
 * context.txt: "Create the scene root as an isolated React Three Fiber
 * component." Each chapter is mounted on its own, reads its own progress from
 * the shared frame store inside `useFrame`, and shares no React state with its
 * neighbours. Nothing is passed down except what the host already knows.
 */
export interface ChapterProps {
  /** Index into `config/scenes` — this chapter's own entry. */
  index: number
  /** Capability tier, so a chapter can budget its own object counts. */
  tier: Tier
}

export type Chapter = FC<ChapterProps>