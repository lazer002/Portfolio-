'use client'

/**
 * The one mutable frame-state object.
 *
 * context.txt is explicit about the architecture problem: GSAP owns scroll
 * progression, idle animation owns everything GSAP is not currently touching,
 * and "do not let independent animation loops fight GSAP-controlled transforms".
 * The way to guarantee that is a single shared mutable object written once per
 * frame and read inside `useFrame` — never React state. Re-rendering a scene
 * every frame would be both slower and a correctness hazard.
 *
 * DOM components that genuinely need React (chapter copy, navigation) read
 * `chapter` through the tiny external store below, which only notifies when the
 * chapter index actually changes — a handful of times across the whole session.
 */

import { SCENE_COUNT, boundaryIntensity, chapterFromProgress, localProgress } from '@/config/scenes'

export interface PointerState {
  /** Normalised -1..1 across the viewport. */
  x: number
  y: number
  /** Damped pointer, used for anything that should feel weighted. */
  dx: number
  dy: number
  /** True while the pointer is inside the window. */
  active: boolean
  /** True on coarse pointers, so scenes substitute touch behaviour. */
  coarse: boolean
}

export interface FrameState {
  /** Document scroll progress, 0..1. Written by the scroll driver. */
  progress: number
  /** Active chapter index. */
  chapter: number
  /** Active chapter's local progress, 0..1. */
  local: number
  /** Per-chapter local progress. Kept so off-screen chapters can still blend. */
  chapters: Float32Array
  /**
   * 0 → 1 → 0 ramp as the active chapter changes. Scenes use it to hand
   * objects off to the next chapter instead of hard-cutting.
   */
  presence: number
  /** Transition intensity at boundaries; 0 for most of the session. */
  boundary: number
  /** Seconds since the last scroll input — drives idle-motion return. */
  sinceScroll: number
  /** Seconds since mount, already scaled by reduced-motion preference. */
  time: number
  /** Pointer state, shared by every scene. */
  pointer: PointerState
  /** Global 0–1 "how alive is the machine" factor for particle intensity. */
  energy: number
  reducedMotion: boolean
  /** Set once the loader has finished and the canvas may fade in. */
  ready: boolean
}

export const frame: FrameState = {
  progress: 0,
  chapter: 0,
  local: 0,
  chapters: new Float32Array(SCENE_COUNT),
  presence: 0,
  boundary: 0,
  sinceScroll: 99,
  time: 0,
  pointer: { x: 0, y: 0, dx: 0, dy: 0, active: false, coarse: false },
  energy: 1,
  reducedMotion: false,
  ready: false,
}

/* ------------------------------------------------------------------ */
/* Minimal external store for the low-frequency values DOM needs.      */
/* ------------------------------------------------------------------ */

type Listener = () => void

const listeners = new Set<Listener>()

/** Subscribe to chapter-range changes only. */
export function subscribeChapter(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function getChapterSnapshot(): number {
  return frame.chapter
}

/**
 * Called once per frame by the scroll driver. Everything a DOM component needs
 * is recomputed here so the scene components never have to.
 */
export function syncFrame(progress: number, dt: number, reducedMotion: boolean): void {
  const chapter = chapterFromProgress(progress)
  const previous = frame.chapter
  frame.chapter = chapter
  frame.progress = progress
  frame.local = localProgress(chapter, progress)
  frame.boundary = boundaryIntensity(progress)
  frame.sinceScroll += dt
  frame.reducedMotion = reducedMotion

  for (let i = 0; i < SCENE_COUNT; i++) {
    frame.chapters[i] = localProgress(i, progress)
  }

  // Presence ramps 0 → 1 as the chapter becomes readable and back down as the
  // next one takes over, so a scene fades rather than cuts at the seam.
  const sceneSpan = 1 / SCENE_COUNT
  const into = (progress - (chapter / SCENE_COUNT)) / sceneSpan
  const away = (progress - ((chapter + 1) / SCENE_COUNT)) / sceneSpan
  const target = Math.min(smooth(into), 1 - smooth(away))
  frame.presence = lerpPresence(frame.presence, target, dt)

  if (chapter !== previous && listeners.size > 0) {
    for (const listener of listeners) listener()
  }
}

function smooth(t: number): number {
  const x = t < 0 ? 0 : t > 1 ? 1 : t
  return x * x * (3 - 2 * x)
}

function lerpPresence(current: number, target: number, dt: number): number {
  const k = 1 - Math.exp(-7 * dt)
  return current + (target - current) * k
}

/** Advance wall-clock time. Motion is slowed, never removed, under reduced motion. */
export function tickTime(dt: number): void {
  const scaled = frame.reducedMotion ? dt * 0.25 : dt
  frame.time += scaled
  frame.energy = frame.reducedMotion ? 0.25 : Math.min(1, 0.55 + frame.local * 0.45)
}

/** Convenience: pointer in a scene's local space, already damped. */
export function pointerDamped(): { x: number; y: number } {
  return { x: frame.pointer.dx, y: frame.pointer.dy }
}