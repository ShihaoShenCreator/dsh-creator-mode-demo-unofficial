/**
 * Pure timeline math. No React, no DOM, no fetch: everything here is a
 * deterministic function of the project state so it can be unit-tested.
 *
 * The layout mirrors the Host rule: track-0 clips are magnetic and laid out
 * contiguously in array order; track-1 clips keep their own `start` and extend
 * the project duration when they run past the main track.
 */

export const MIN_CLIP = 0.2
export const ZOOM_MIN = 40
export const ZOOM_MAX = 400
export const ZOOM_DEFAULT = 110
export const RULER_HEIGHT = 26
export const TRACK_HEIGHT = 56

export const EMPTY_LAYOUT = { main: [], overlays: [], duration: 0 }

/** Round to milliseconds so repeated float arithmetic stays stable. */
export function roundTime(value) {
  return Math.round(value * 1000) / 1000
}

export function clampNumber(value, low, high) {
  if (!Number.isFinite(value)) return low
  return Math.min(Math.max(value, low), high)
}

export function clampInteger(value, low, high) {
  return Math.round(clampNumber(value, low, high))
}

/** `MM:SS` clock, used by the ruler and the media bin. */
export function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0))
  const minutes = Math.floor(total / 60)
  const rest = total % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}

/** `MM:SS:FF` timecode with tabular frames. */
export function formatTimecode(seconds, fps) {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30
  const value = Math.max(0, Number.isFinite(seconds) ? seconds : 0)
  const totalSeconds = Math.floor(value)
  const minutes = Math.floor(totalSeconds / 60)
  const secs = totalSeconds % 60
  let frames = Math.floor((value - totalSeconds) * safeFps + 1e-6)
  if (frames >= safeFps) frames = safeFps - 1
  return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}:${String(frames).padStart(2, '0')}`
}

/** Frame index of a timeline time (display counter). */
export function frameOfTime(seconds, fps) {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30
  return Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * safeFps))
}

export function totalFrames(duration, fps) {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30
  return Math.max(0, Math.round((Number.isFinite(duration) ? duration : 0) * safeFps))
}

/** Step exactly one frame, quantizing onto the frame grid first. */
export function stepFrame(seconds, fps, direction) {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30
  const frame = Math.round((Number.isFinite(seconds) ? seconds : 0) * safeFps)
  return Math.max(0, (frame + Math.sign(direction)) / safeFps)
}

/** Ruler tick spacing in seconds for a given zoom (1/2/5/10/30/60 s steps). */
export function chooseStep(pxPerSec) {
  const target = 64
  const candidates = [1, 2, 5, 10, 30, 60, 120, 300, 600]
  for (const candidate of candidates) {
    if (candidate * pxPerSec >= target) return candidate
  }
  return 600
}

/** Source window length of a clip in seconds. */
export function clipDuration(clip) {
  if (clip === null || clip === undefined) return 0
  const from = Number(clip.in)
  const to = Number(clip.out)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return roundTime(Math.max(0, to - from))
}

/** Timeline layout computed from the clip list (Host-compatible). */
export function layoutClips(clips) {
  const list = Array.isArray(clips) ? clips : []
  const main = []
  let cursor = 0
  for (const clip of list) {
    if (clip === null || clip === undefined || clip.track !== 0) continue
    const duration = clipDuration(clip)
    const start = roundTime(cursor)
    main.push({ clipId: clip.id, start, end: roundTime(cursor + duration), duration })
    cursor = roundTime(cursor + duration)
  }
  // An overlay is a window INSIDE the programme: the main track defines the
  // programme length. An overlay cannot start past the end, and one that would
  // run past the end is clipped there (its own in/out are untouched). This is
  // the Host rule — keeping preview, timeline and export on one duration.
  const total = roundTime(cursor)
  const overlays = []
  for (const clip of list) {
    if (clip === null || clip === undefined || clip.track !== 1) continue
    const duration = clipDuration(clip)
    // Same rule as the Host (and the renderer's `enable` window): the requested
    // start is respected, the overlay is clipped at the programme end, and an
    // overlay parked entirely past the end slides back so it still shows.
    const wanted = Math.min(duration, total)
    let start = Math.min(Math.max(0, Number.isFinite(clip.start) ? clip.start : 0), total)
    let visible = roundTime(Math.min(duration, total - start))
    if (visible < 0.01 && wanted >= 0.01) {
      start = roundTime(Math.max(0, total - wanted))
      visible = wanted
    }
    overlays.push({ clipId: clip.id, start: roundTime(start), end: roundTime(start + visible), duration: visible })
  }
  return { main, overlays, duration: total }
}

/** Layout for a wire state, tolerating a missing/invalid `clips` array. */
export function layoutOfState(state) {
  if (state === null || state === undefined) return EMPTY_LAYOUT
  return layoutClips(state.clips)
}

/** Clip map keyed by id. */
export function clipIndex(state) {
  const map = new Map()
  const list = state !== null && state !== undefined && Array.isArray(state.clips) ? state.clips : []
  for (const clip of list) {
    if (clip !== null && clip !== undefined && typeof clip.id === 'string') map.set(clip.id, clip)
  }
  return map
}

/** Media map keyed by id. */
export function mediaIndex(state) {
  const map = new Map()
  const list = state !== null && state !== undefined && Array.isArray(state.media) ? state.media : []
  for (const item of list) {
    if (item !== null && item !== undefined && typeof item.id === 'string') map.set(item.id, item)
  }
  return map
}

/** The main-track slice covering `time`, or null when the track is empty. */
export function clipAtTime(layout, time) {
  if (layout === null || layout === undefined || layout.main.length === 0) return null
  const target = Number.isFinite(time) ? time : 0
  for (const slice of layout.main) {
    if (target >= slice.start && target < slice.end) return slice
  }
  if (target <= 0) return layout.main[0]
  const last = layout.main[layout.main.length - 1]
  return target >= last.end ? last : null
}

/** Overlay slices active at `time`, in array order. */
export function overlaysAtTime(layout, time) {
  if (layout === null || layout === undefined || layout.overlays.length === 0) return []
  const target = Number.isFinite(time) ? time : 0
  return layout.overlays.filter((slice) => target >= slice.start && target < slice.end)
}

/** Index of a clip inside the main track, or -1. */
export function mainIndexOf(layout, clipId) {
  if (layout === null || layout === undefined) return -1
  return layout.main.findIndex((slice) => slice.clipId === clipId)
}

/**
 * Drop index for a main-track reorder: how many of the *other* clips have their
 * centre left of the drop position.
 */
export function reorderIndexAt(layout, seconds, draggedId) {
  if (layout === null || layout === undefined) return 0
  let index = 0
  for (const slice of layout.main) {
    if (slice.clipId === draggedId) continue
    if (seconds >= (slice.start + slice.end) / 2) index += 1
  }
  return index
}

/** Source times for an N-frame filmstrip (evenly spaced midpoints). */
export function filmstripTimes(clip, count) {
  const total = Math.max(1, Math.round(count))
  const duration = clipDuration(clip)
  if (duration <= 0) return []
  const from = Number(clip.in) || 0
  const times = []
  for (let index = 0; index < total; index += 1) {
    const offset = (duration * (index + 0.5)) / total
    times.push(roundTime(Math.min(from + offset, Number(clip.out) - 0.001)))
  }
  return times
}

/** Overlay geometry as percentages of the project canvas. */
export function overlayRect(clip, state) {
  const width = state !== null && state !== undefined && Number.isFinite(state.width) ? state.width : 1920
  const height = state !== null && state !== undefined && Number.isFinite(state.height) ? state.height : 1080
  const x = Number.isFinite(clip?.x) ? clip.x : 0
  const y = Number.isFinite(clip?.y) ? clip.y : 0
  const scale = clampNumber(Number.isFinite(clip?.scale) ? clip.scale : 0.35, 0.05, 1)
  return {
    left: `${(x / width) * 100}%`,
    top: `${(y / height) * 100}%`,
    width: `${scale * 100}%`,
  }
}

/** Trim one edge of a clip against its source window and media duration. */
export function trimEdge(clip, mediaDuration, edge, deltaSeconds) {
  if (clip === null || clip === undefined) return null
  const from = Number(clip.in) || 0
  const to = Number(clip.out) || 0
  const limit = Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration : Math.max(to, from + MIN_CLIP)
  if (edge === 'in') {
    const nextIn = clampNumber(from + deltaSeconds, 0, to - MIN_CLIP)
    return { in: roundTime(nextIn), out: roundTime(to) }
  }
  const nextOut = clampNumber(to + deltaSeconds, from + MIN_CLIP, limit)
  return { in: roundTime(from), out: roundTime(nextOut) }
}

/** Seek target clamped into the project. */
export function clampSeek(seconds, duration) {
  const total = Number.isFinite(duration) ? Math.max(0, duration) : 0
  return clampNumber(Number.isFinite(seconds) ? seconds : 0, 0, total)
}

/** Zoom that fits the whole timeline into `viewportWidth` pixels. */
export function fitZoom(duration, viewportWidth, min = ZOOM_MIN, max = ZOOM_MAX) {
  const safeWidth = Number.isFinite(viewportWidth) ? viewportWidth : 0
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0
  if (safeDuration <= 0) return ZOOM_DEFAULT
  return clampNumber(safeWidth / safeDuration, min, max)
}

/** Whether the wire state still contains the selected clip. */
export function hasClip(state, clipId) {
  if (clipId === null || clipId === undefined) return false
  const clips = state !== null && state !== undefined && Array.isArray(state.clips) ? state.clips : []
  return clips.some((clip) => clip !== null && clip !== undefined && clip.id === clipId)
}
