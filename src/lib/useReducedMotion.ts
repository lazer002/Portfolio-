'use client'

import { useSyncExternalStore } from 'react'

/**
 * Tracks `prefers-reduced-motion`.
 *
 * context.txt: "Respect prefers-reduced-motion. When reduced motion is enabled,
 * keep scene changes but remove aggressive camera and particle motion."
 *
 * Implemented as a subscription to the media query rather than state plus an
 * effect, which means the value is correct on the very first render, updates
 * live if the OS setting changes mid-session, and never triggers a cascading
 * re-render from an effect.
 *
 * The server snapshot is `false`: a server has no preference to read, and
 * rendering without motion is the safer default for content that has not
 * hydrated yet.
 */

const QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(callback: () => void): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) return () => undefined
  const query = window.matchMedia(QUERY)
  query.addEventListener('change', callback)
  return () => query.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia(QUERY).matches
}

function getServerSnapshot(): boolean {
  return false
}

export function useReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}