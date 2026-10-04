'use client'

import dynamic from 'next/dynamic'

/**
 * The client boundary.
 *
 * `dynamic(..., { ssr: false })` is only supported inside a Client Component —
 * it throws in a Server Component — so this one-line shell exists purely to give
 * the import a legal home. The WebGL layer reads `window`, `matchMedia` and a
 * WebGL context during module evaluation, so it must never be part of the server
 * bundle.
 *
 * Splitting it this way also keeps the server output to the accessible content
 * index, which is the part that has to exist without JavaScript.
 */
const Experience = dynamic(() => import('@/components/Experience').then((m) => m.Experience), {
  ssr: false,
  loading: () => null,
})

export function ExperienceShell() {
  return <Experience />
}