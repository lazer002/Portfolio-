'use client'

import { Html } from '@react-three/drei'
import { memo, type ReactNode } from 'react'

import { ACCENT } from '@/config/scenes'
import { useIsActiveChapter } from '@/components/chapters/ChapterContext'

/**
 * A holographic label anchored to a point in the world.
 *
 * context.txt: "Keep detailed text in readable DOM overlays" and "3D text
 * should be used sparingly." So labels are real DOM elements positioned in 3D
 * rather than SDF text meshes — crisper, reachable by screen readers, and no
 * web-font fetch at runtime (troika's default would pull Roboto from Google
 * Fonts, which is exactly the kind of runtime dependency a portfolio should not
 * have).
 *
 * Visibility is a prop, not a per-frame read: scenes pass `visible` from their
 * chapter range, which changes a handful of times per session rather than sixty
 * times a second.
 */

export type LabelAccent = keyof typeof ACCENT

export interface HoloLabelProps {
  /** World position of the label anchor. */
  position: [number, number, number]
  children: ReactNode
  accent?: LabelAccent
  /** Small uppercase technical label — the default register. */
  variant?: 'technical' | 'title' | 'body'
  /** Scales the label with distance, like a physical sign. */
  distanceFactor?: number
  /** Render behind solid geometry. Off for labels sitting inside machines. */
  occlude?: boolean
  visible?: boolean
  /**
   * Hide the label unless its own chapter is the active one. Defaults to true.
   * drei's Html ignores parent `visible`, so without this a neighbouring
   * chapter's labels float over the current scene.
   */
  onlyWhenActive?: boolean
  /** Adds a small tick connecting the label to its anchor. */
  tick?: boolean
}

function HoloLabelBase({
  position,
  children,
  accent = 'cyan',
  variant = 'technical',
  distanceFactor,
  occlude = false,
  visible = true,
  onlyWhenActive = true,
  tick = false,
}: HoloLabelProps) {
  const isActive = useIsActiveChapter()
  if (!visible || (onlyWhenActive && !isActive)) return null

  return (
    <Html
      position={position}
      center
      distanceFactor={distanceFactor}
      zIndexRange={[20, 0]}
      occlude={occlude ? 'blending' : false}
      style={{ ['--label-accent' as string]: ACCENT[accent] }}
      className={`holo-label holo-label--${variant}${tick ? ' holo-label--tick' : ''}`}
    >
      <span className="holo-label__text">{children}</span>
    </Html>
  )
}

export const HoloLabel = memo(HoloLabelBase)