/**
 * Preview stage, transport bar and the playback engine.
 *
 * The engine owns the timeline clock:
 *  - one `requestAnimationFrame` loop drives wall-time deltas while playing
 *    (so a slow frame never stretches the timeline);
 *  - a 2-element `<video>` pool carries the main track, so the incoming clip
 *    preloads while the outgoing picture is still on screen;
 *  - main videos seek only when forced or when drift passes 0.25 s;
 *  - overlay videos follow their own `[start, start + len)` window and are
 *    paused outside it.
 *
 * Neither `<video>` receives `src` from React: the engine writes `src` and the
 * active/inactive display state imperatively, so a polled state refresh cannot
 * re-mount or restart the players.
 */
import React from 'react'
import { playUrl } from './api.js'
import {
  clipAtTime,
  formatTimecode,
  frameOfTime,
  totalFrames,
  stepFrame,
  clampSeek,
  layoutOfState,
  overlayRect,
} from './model.js'
import { FilmIcon, PlayIcon, PauseIcon, StepBackIcon, StepForwardIcon, FitIcon, VolumeIcon } from './icons.jsx'

const DRIFT_LIMIT = 0.25
const PUBLISH_MS = 33

function safeCall(fn) {
  try {
    return fn()
  } catch {
    return undefined
  }
}

function startElement(element) {
  if (element === null || element === undefined) return
  const promise = safeCall(() => element.play())
  if (promise !== null && promise !== undefined && typeof promise.catch === 'function') promise.catch(() => {})
}

function pauseElement(element) {
  if (element === null || element === undefined) return
  safeCall(() => element.pause())
}

/** Contain the project canvas inside a pixel box (fit) or use canvas pixels (actual). */
export function fitStage(box, canvasWidth, canvasHeight, mode) {
  const width = Number.isFinite(box?.width) ? box.width : 0
  const height = Number.isFinite(box?.height) ? box.height : 0
  const canvasW = Number.isFinite(canvasWidth) && canvasWidth > 0 ? canvasWidth : 1920
  const canvasH = Number.isFinite(canvasHeight) && canvasHeight > 0 ? canvasHeight : 1080
  if (mode === 'actual') return { width: canvasW, height: canvasH }
  if (width <= 0 || height <= 0) return { width: 0, height: 0 }
  const aspect = canvasW / canvasH
  let stageWidth = width
  let stageHeight = width / aspect
  if (stageHeight > height) {
    stageHeight = height
    stageWidth = height * aspect
  }
  return { width: Math.max(0, Math.floor(stageWidth)), height: Math.max(0, Math.floor(stageHeight)) }
}

const HIDDEN = 'none'
const SHOWN = 'block'

function setVisible(element, visible) {
  if (element === null || element === undefined) return
  const next = visible ? SHOWN : HIDDEN
  if (element.style.display !== next) element.style.display = next
}

/**
 * The preview pane.
 * @param props - state, sessionId, clock (time bus), playing flag + setter, t, error.
 */
export function Preview(props) {
  const { state, sessionId, clock, playing, onPlaying, t, error, onRegisterApi } = props

  const canvasW = Number.isFinite(state?.width) ? state.width : 1920
  const canvasH = Number.isFinite(state?.height) ? state.height : 1080
  const fps = Number.isFinite(state?.fps) ? state.fps : 30

  const layout = React.useMemo(() => layoutOfState(state), [state])
  const duration = layout.duration

  const clipById = React.useMemo(() => {
    const map = new Map()
    for (const clip of Array.isArray(state?.clips) ? state.clips : []) {
      if (clip !== null && typeof clip === 'object' && typeof clip.id === 'string') map.set(clip.id, clip)
    }
    return map
  }, [state])

  const mediaById = React.useMemo(() => {
    const map = new Map()
    for (const item of Array.isArray(state?.media) ? state.media : []) {
      if (item !== null && typeof item === 'object' && typeof item.id === 'string') map.set(item.id, item)
    }
    return map
  }, [state])

  const overlayClips = React.useMemo(() => {
    const list = Array.isArray(state?.clips) ? state.clips : []
    return list.filter((clip) => clip !== null && typeof clip === 'object' && clip.track === 1).slice(0, 2)
  }, [state])

  const [volume, setVolume] = React.useState(100)
  const [mode, setMode] = React.useState('fit')
  const [timeDisplay, setTimeDisplay] = React.useState(() => clock.get())
  const [playError, setPlayError] = React.useState(null)
  const [box, setBox] = React.useState({ width: 0, height: 0 })

  const wrapRef = React.useRef(null)
  const slotARef = React.useRef(null)
  const slotBRef = React.useRef(null)
  const overlayARef = React.useRef(null)
  const overlayBRef = React.useRef(null)

  const engineRef = React.useRef({
    active: 0,
    loaded: [null, null],
    time: 0,
    raf: 0,
    lastWall: 0,
    lastPublish: 0,
  })

  const playingRef = React.useRef(playing)
  playingRef.current = playing

  /* -------------------------------------------------------------- geometry */
  React.useEffect(() => {
    const element = wrapRef.current
    if (element === null || element === undefined) return undefined
    const measure = () => {
      const width = safeCall(() => element.clientWidth) ?? 0
      const height = safeCall(() => element.clientHeight) ?? 0
      setBox((previous) => (previous.width === width && previous.height === height ? previous : { width, height }))
    }
    measure()
    if (typeof ResizeObserver === 'function') {
      const observer = new ResizeObserver(measure)
      observer.observe(element)
      return () => observer.disconnect()
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('resize', measure)
      return () => window.removeEventListener('resize', measure)
    }
    return undefined
  }, [])

  const stage = fitStage(box, canvasW, canvasH, mode)

  /* -----------------------------------------------------------  volume sync */
  React.useEffect(() => {
    const level = Math.min(1, Math.max(0, volume / 100))
    for (const element of [slotARef.current, slotBRef.current, overlayARef.current, overlayBRef.current]) {
      if (element === null || element === undefined) continue
      safeCall(() => {
        element.volume = level
        element.muted = level <= 0
      })
    }
  }, [volume])

  /* ------------------------------------------------------------ engine core */
  /** Source-local playback position inside one main clip. */
  const localOf = React.useCallback((clip, timelineTime) => {
    const slice = layout.main.find((entry) => entry.clipId === clip.id)
    const start = slice === undefined ? 0 : slice.start
    const sourceIn = Number.isFinite(clip.in) ? clip.in : 0
    const local = sourceIn + (timelineTime - start)
    return Math.max(0, Number.isFinite(local) ? local : 0)
  }, [layout])

  /**
   * Put the main track on screen at `timelineTime`.
   * @param timelineTime - timeline seconds.
   * @param force - seek even when the drift is small.
   */
  const syncMain = React.useCallback((timelineTime, force) => {
    const engine = engineRef.current
    const elementA = slotARef.current
    const elementB = slotBRef.current
    const slice = clipAtTime(layout, timelineTime)
    const clip = slice === null ? null : clipById.get(slice.clipId) ?? null

    if (clip === null) {
      pauseElement(elementA)
      pauseElement(elementB)
      setVisible(elementA, false)
      setVisible(elementB, false)
      return
    }
    const media = mediaById.get(clip.mediaId)
    if (media === undefined) {
      pauseElement(elementA)
      pauseElement(elementB)
      setVisible(elementA, false)
      setVisible(elementB, false)
      return
    }

    let slot = -1
    if (engine.loaded[engine.active] === clip.mediaId) slot = engine.active
    else if (engine.loaded[1 - engine.active] === clip.mediaId) slot = 1 - engine.active

    if (slot === -1) {
      slot = 1 - engine.active
      const incoming = slot === 0 ? elementA : elementB
      engine.loaded[slot] = clip.mediaId
      if (incoming !== null && incoming !== undefined) {
        pauseElement(incoming)
        safeCall(() => {
          incoming.src = playUrl(sessionId, clip.mediaId)
        })
        safeCall(() => incoming.load())
      }
    }

    const element = slot === 0 ? elementA : elementB
    const isActive = slot === engine.active
    if (!isActive) {
      pauseElement(engine.active === 0 ? elementA : elementB)
      engine.active = slot
    }
    setVisible(element, true)
    setVisible(slot === 0 ? elementB : elementA, false)

    if (element === null || element === undefined) return

    const target = localOf(clip, timelineTime)
    const bounded = Number.isFinite(element.duration) && element.duration > 0
      ? Math.min(target, Math.max(0, element.duration - 0.04))
      : target
    const drift = Math.abs(element.currentTime - bounded)
    if (force === true || drift > DRIFT_LIMIT) {
      safeCall(() => {
        element.currentTime = bounded
      })
    }
    if (playingRef.current) startElement(element)
    else pauseElement(element)
  }, [layout, clipById, mediaById, sessionId, localOf])

  /** Put the overlay windows on screen at `timelineTime`. */
  const syncOverlays = React.useCallback((timelineTime, force) => {
    const refs = [overlayARef.current, overlayBRef.current]
    for (let index = 0; index < 2; index += 1) {
      const element = refs[index]
      const clip = overlayClips[index]
      if (element === null || element === undefined || clip === undefined) continue
      const slice = layout.overlays.find((entry) => entry.clipId === clip.id)
      if (slice === undefined || timelineTime < slice.start || timelineTime >= slice.end) {
        pauseElement(element)
        setVisible(element, false)
        continue
      }
      setVisible(element, true)
      const target = Math.max(0, (Number.isFinite(clip.in) ? clip.in : 0) + (timelineTime - slice.start))
      const bounded = Number.isFinite(element.duration) && element.duration > 0
        ? Math.min(target, Math.max(0, element.duration - 0.04))
        : target
      if (force === true || Math.abs(element.currentTime - bounded) > DRIFT_LIMIT) {
        safeCall(() => {
          element.currentTime = bounded
        })
      }
      if (playingRef.current) startElement(element)
      else pauseElement(element)
    }
  }, [layout, overlayClips])

  const syncAt = React.useCallback((timelineTime, force) => {
    engineRef.current.time = timelineTime
    syncMain(timelineTime, force)
    syncOverlays(timelineTime, force)
  }, [syncMain, syncOverlays])

  /* --------------------------------------------------- external seeks (bus) */
  React.useEffect(() => {
    const off = clock.subscribe((value) => {
      const engine = engineRef.current
      if (Math.abs(value - engine.time) < 1e-6) {
        setTimeDisplay(value)
        return
      }
      engine.time = value
      setTimeDisplay(value)
      syncAt(value, true)
    })
    return off
  }, [clock, syncAt])

  /* ----------------------------------------------------------- rAF loop */
  React.useEffect(() => {
    const engine = engineRef.current
    if (!playing) {
      if (engine.raf !== 0) {
        safeCall(() => cancelAnimationFrame(engine.raf))
        engine.raf = 0
      }
      pauseElement(engine.active === 0 ? slotARef.current : slotBRef.current)
      pauseElement(overlayARef.current)
      pauseElement(overlayBRef.current)
      return undefined
    }
    if (duration <= 0) {
      onPlaying(false)
      return undefined
    }
    const nowOf = () => (typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now())
    engine.lastWall = nowOf()
    engine.lastPublish = 0
    let cancelled = false

    const step = () => {
      if (cancelled) return
      const now = nowOf()
      const delta = Math.max(0, Math.min(0.5, (now - engine.lastWall) / 1000))
      engine.lastWall = now
      const next = engine.time + delta
      if (next >= duration) {
        engine.time = duration
        clock.set(duration)
        setTimeDisplay(duration)
        syncAt(duration, true)
        onPlaying(false)
        return
      }
      engine.time = next
      clock.set(next)
      syncAt(next, false)
      if (now - engine.lastPublish >= PUBLISH_MS) {
        engine.lastPublish = now
        setTimeDisplay(next)
      }
      engine.raf = safeCall(() => requestAnimationFrame(step)) ?? 0
    }
    engine.raf = safeCall(() => requestAnimationFrame(step)) ?? 0
    return () => {
      cancelled = true
      if (engine.raf !== 0) {
        safeCall(() => cancelAnimationFrame(engine.raf))
        engine.raf = 0
      }
    }
  }, [playing, duration, clock, syncAt, onPlaying])

  /* -------------------------------------- re-seat the pool on a state swap */
  const poolSignature = React.useMemo(() => {
    const ids = layout.main.map((slice) => {
      const clip = clipById.get(slice.clipId)
      return `${slice.clipId}:${clip === undefined ? '?' : clip.mediaId}:${clip === undefined ? 0 : clip.in}:${clip === undefined ? 0 : clip.out}`
    })
    return `${sessionId}|${state?.revision ?? 0}|${ids.join('|')}`
  }, [sessionId, state, layout, clipById])

  React.useEffect(() => {
    const engine = engineRef.current
    engine.loaded = [null, null]
    engine.active = 0
    pauseElement(slotARef.current)
    pauseElement(slotBRef.current)
    setVisible(slotARef.current, false)
    setVisible(slotBRef.current, false)
    engine.time = Math.max(0, Math.min(engine.time, duration))
    syncAt(engine.time, true)
  }, [poolSignature, duration, syncAt])

  /* ------------------------------------------------------------ transport */
  const current = Math.min(timeDisplay, duration > 0 ? duration : timeDisplay)
  const frame = frameOfTime(current, fps)
  const total = totalFrames(duration, fps)
  const activeSlice = clipAtTime(layout, current)
  const activeClip = activeSlice === null ? null : clipById.get(activeSlice.clipId) ?? null
  const activeMedia = activeClip === null ? null : mediaById.get(activeClip.mediaId) ?? null

  const togglePlay = React.useCallback(() => {
    if (duration <= 0) {
      onPlaying(false)
      return
    }
    if (!playing && current >= duration - 1e-3) {
      engineRef.current.time = 0
      clock.set(0)
      setTimeDisplay(0)
      syncAt(0, true)
    }
    onPlaying(!playing)
  }, [duration, playing, current, clock, syncAt, onPlaying])

  const stepBy = React.useCallback((frames) => {
    onPlaying(false)
    const next = clampSeek(stepFrame(engineRef.current.time, fps, frames), duration)
    engineRef.current.time = next
    clock.set(next)
    setTimeDisplay(next)
    syncAt(next, true)
  }, [onPlaying, clock, fps, duration, syncAt])

  /** Imperative transport surface for the timeline keyboard handler. */
  React.useEffect(() => {
    if (typeof onRegisterApi === 'function') {
      onRegisterApi({
        togglePlay,
        stepBy,
        seek: (seconds) => {
          const next = clampSeek(seconds, duration)
          engineRef.current.time = next
          clock.set(next)
          setTimeDisplay(next)
          syncAt(next, true)
        },
        getTime: () => engineRef.current.time,
      })
      return () => onRegisterApi(null)
    }
    return undefined
  }, [onRegisterApi, togglePlay, stepBy, duration, clock, syncAt])

  const stageStyle = stage.width > 0 || stage.height > 0
    ? { width: stage.width > 0 ? `${stage.width}px` : undefined, height: stage.height > 0 ? `${stage.height}px` : undefined }
    : undefined
  const empty = layout.main.length === 0

  return (
    <section className="ve-preview-pane">
      <div className="ve-stage-wrap" ref={wrapRef}>
        <div className="ve-stage" style={stageStyle}>
          <video ref={slotARef} className="ve-video" playsInline preload="auto" onError={() => setPlayError('main')} />
          <video ref={slotBRef} className="ve-video" playsInline preload="auto" onError={() => setPlayError('main')} />
          {overlayClips.map((clip, index) => {
            const rect = overlayRect(clip, state)
            const slice = layout.overlays.find((entry) => entry.clipId === clip.id)
            const visible = slice !== undefined && current >= slice.start && current < slice.end
            return (
              <video
                key={`overlay-${index}`}
                ref={index === 0 ? overlayARef : overlayBRef}
                className="ve-overlay-video"
                playsInline
                preload="auto"
                src={playUrl(sessionId, clip.mediaId)}
                style={{ left: rect.left, top: rect.top, width: rect.width, display: visible ? SHOWN : HIDDEN }}
                onError={() => setPlayError('overlay')}
              />
            )
          })}
          {empty ? (
            <div className="ve-stage-empty">
              <FilmIcon size={26} />
              <div className="ve-stage-empty-title">{t('preview.empty')}</div>
              <div className="ve-stage-empty-hint">{t('preview.emptyHint')}</div>
            </div>
          ) : null}
          {activeMedia !== null ? (
            <div className="ve-stage-badge">
              <span>{activeMedia.name}</span>
              <span>·</span>
              <span>{`${canvasW}×${canvasH}`}</span>
            </div>
          ) : null}
          {(playError !== null || error !== null) ? (
            <div className="ve-stage-error">
              {error !== null ? error : t('preview.error')}
            </div>
          ) : null}
        </div>
      </div>

      <div className="ve-transport">
        <button
          type="button"
          className={playing ? 've-play-btn ve-play-btn-active' : 've-play-btn'}
          onClick={togglePlay}
          disabled={duration <= 0}
          aria-label={playing ? t('preview.pause') : t('preview.play')}
          title={playing ? t('preview.pause') : t('preview.play')}
        >
          {playing ? <PauseIcon size={12} /> : <PlayIcon size={12} />}
        </button>

        <div className="ve-transport-time">
          <span className="ve-transport-current ve-timecode">{formatTimecode(current, fps)}</span>
          <span className="ve-transport-sep">/</span>
          <span className="ve-transport-total ve-timecode">{formatTimecode(duration, fps)}</span>
          <span className="ve-transport-frame">{t('preview.frame', { frame, total })}</span>
        </div>

        <div className="ve-transport-grow" />

        <button
          type="button"
          className="ve-icon-btn"
          onClick={() => stepBy(-1)}
          disabled={duration <= 0}
          title={t('preview.prevFrame')}
          aria-label={t('preview.prevFrame')}
        >
          <StepBackIcon size={11} />
          <span className="ve-num">-1</span>
        </button>
        <button
          type="button"
          className="ve-icon-btn"
          onClick={() => stepBy(1)}
          disabled={duration <= 0}
          title={t('preview.nextFrame')}
          aria-label={t('preview.nextFrame')}
        >
          <span className="ve-num">+1</span>
          <StepForwardIcon size={11} />
        </button>

        <div className="ve-volume">
          <VolumeIcon size={12} />
          <input
            className="ve-range ve-volume-range"
            type="range"
            min={0}
            max={100}
            step={1}
            value={volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label={t('preview.volume')}
          />
        </div>

        <button
          type="button"
          className={mode === 'actual' ? 've-icon-btn ve-icon-btn-active' : 've-icon-btn'}
          onClick={() => setMode(mode === 'fit' ? 'actual' : 'fit')}
          title={`${t('preview.fit')} / ${t('preview.actual')}`}
        >
          <FitIcon size={11} />
          <span>{mode === 'fit' ? t('preview.fit') : t('preview.actual')}</span>
        </button>
      </div>
    </section>
  )
}
