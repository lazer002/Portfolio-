'use client'

import { useSyncExternalStore } from 'react'

import { getChapterSnapshot, subscribeChapter } from '@/lib/store'

/**
 * The active chapter index, as React state.
 *
 * The frame store is mutable and updated sixty times a second; subscribing to
 * it wholesale would re-render the DOM layer on every frame. This hook
 * subscribes only to the chapter index, which changes fourteen times across an
 * entire visit — the DOM layer therefore re-renders fourteen times, not ten
 * thousand.
 */
export function useChapter(): number {
  return useSyncExternalStore(subscribeChapter, getChapterSnapshot, getChapterSnapshot)
}