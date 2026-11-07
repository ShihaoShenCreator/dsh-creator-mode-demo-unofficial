/**
 * Timeline: ruler, two tracks, clip blocks with filmstrips, trim handles,
 * body drag (reorder on the main track / move start on overlays), playhead,
 * zoom and the keyboard shortcuts.
 *
 * The playhead and the timecode readout are written imperatively from the
 * clock bus, so a 30 Hz playback update does not re-render React at all.
 */
import React from 'react'
import { frameUrl } from './api.js'
import {
  RULER_HEIGHT,
  TRACK_HEIGHT,
  ZOOM_MIN,
  ZOOM_MAX,
  ZOOM_DEFAULT,
  chooseStep,
  clampNumber,
  clampSeek,
  clipDuration,
  fitZoom,
  formatClock,
  formatTimecode,
  layoutOfState,
  reorderIndexAt,
  filmstripTimes,
  MIN_CLIP,
  roundTime,
} from './model.js'
import { PlusIcon, FitIcon, SplitIcon, TrashIcon } from './icons.jsx'

const FILMSTRIP_FRAMES = 6

/** One filmstrip image with a designed fallback. */
function StripFrame(props) {
  const { src, alt } = props
  const [failed, setFailed] = React.useState(false)
  if (failed) return <div className="ve-clip-frame-fallback" aria-hidden="true" />
  return (
    <img
      className="ve-clip-frame"
      src={src}
      alt={alt}
      draggable={false}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  )
}

/** Clip block: filmstrip, label, duration, trim handles. */
function ClipBlock(props) {
  const {
    clip, media, slice, selected, pxPerSec, thumbCount, sessionId, t,
    onSelect, onTrimStart, onBodyDragStart, dragging, dropTarget,
  } = props
  const times = React.useMemo(() => filmstripTimes(clip, thumbCount), [clip, thumbCount])
  const left = slice.start * pxPerSec
  const width = Math.max(6, slice.duration * pxPerSec)
  const dense = width < 96
  const handleDown = (edge) => (event) => {
    event.preventDefault()
    event.stopPropagation()
    onTrimStart(clip, edge, event)
  }
  const bodyDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    event.stopPropagation()
    onSelect(clip.id)
    onBodyDragStart(clip, event)
  }

  const classes = [
    've-clip',
    clip.track === 1 ? 've-clip-overlay' : 've-clip-main',
    selected ? 've-clip-selected' : '',
    dragging ? 've-clip-dragging' : '',
    dropTarget ? 've-clip-droptarget' : '',
  ].filter(Boolean).join(' ')

  return (
    <div
      className={classes}
      data-clip-id={clip.id}
      style={{ left: `${left}px`, width: `${width}px` }}
      onMouseDown={bodyDown}
      role="presentation"
      title={`${media === undefined || media === null ? clip.mediaId : media.name} · ${formatTimecode(slice.duration, props.fps)}`}
    >
      <div className="ve-clip-strip">
        {times.length === 0
          ? <div className="ve-clip-frame-fallback" aria-hidden="true" />
          : times.map((time, index) => (
            <StripFrame
              key={`${clip.id}-frame-${index}`}
              src={frameUrl(sessionId, clip.mediaId, time)}
              alt=""
            />
          ))}
      </div>
      <div className="ve-clip-shade" />
      <div className="ve-clip-label">
        <span className="ve-clip-name">{media === undefined || media === null ? clip.mediaId : media.name}</span>
        {dense ? null : <span className="ve-clip-dur">{formatClock(slice.duration)}</span>}
      </div>
      {clip.track === 1 ? (
        <div className="ve-clip-badge">{`${Math.round((Number.isFinite(clip.scale) ? clip.scale : 0.35) * 100)}%`}</div>
      ) : null}
      <div
        className="ve-clip-handle ve-clip-handle-left"
        role="slider"
        tabIndex={-1}
        aria-label={t('timeline.trim')}
        onMouseDown={handleDown('in')}
      />
      <div
        className="ve-clip-handle ve-clip-handle-right"
        role="slider"
        tabIndex={-1}
        aria-label={t('timeline.trim')}
        onMouseDown={handleDown('out')}
      />
    </div>
  )
}

/** Ruler ticks + labels. */
function Ruler(props) {
  const { duration, pxPerSec, width, onSeekStart } = props
  const step = chooseStep(pxPerSec)
  const total = Math.max(duration, 0)
  const count = Math.ceil((total + step) / step)
  const ticks = []
  for (let index = 0; index <= count; index += 1) {
    const time = index * step
    if (time > total + step) break
    ticks.push(time)
  }
  const handleDown = (event) => {
    if (event.button !== undefined && event.button !== 0) return
    event.preventDefault()
    onSeekStart(event)
  }
  return (
    <div
      className="ve-ruler"
      style={{ width: `${width}px` }}
      onMouseDown={handleDown}
      role="presentation"
      title={formatTimecode(total, 30)}
    >
      {ticks.map((time, index) => {
        const major = index % 2 === 0
        return (
          <React.Fragment key={`tick-${time}`}>
            <div
              className={major ? 've-ruler-tick ve-ruler-tick-major' : 've-ruler-tick'}
              style={{ left: `${time * pxPerSec}px`, height: major ? RULER_HEIGHT : 8 }}
            />
            <div className="ve-ruler-label" style={{ left: `${time * pxPerSec}px` }}>
              {formatClock(time)}
            </div>
          </React.Fragment>
        )
      })}
    </div>
  )
}

/**
 * The timeline surface.
 * @param props - state, session, op, clock, selection and transport helpers, t.
 */
export function Timeline(props) {
  const {
    state, sessionId, op, clock, t, ping,
    selectedClipId, onSelectClip, transport, onImportRequest, busy,
  } = props

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

  const [pxPerSec, setPxPerSec] = React.useState(ZOOM_DEFAULT)
  const [drag, setDrag] = React.useState(null)
  const [dropIndex, setDropIndex] = React.useState(-1)
  const [dropActive, setDropActive] = React.useState(false)
  const [error, setError] = React.useState(null)

  const scrollRef = React.useRef(null)
  const contentRef = React.useRef(null)
  const playheadRef = React.useRef(null)
  const clipAreaRef = React.useRef(null)
  const dragRef = React.useRef(null)

  const trackWidth = Math.max(1, Math.round(Math.max(duration, 12) * pxPerSec + 240))

  /* ------------------------------------------------------------ playhead */
  const paintPlayhead = React.useCallback((time) => {
    const element = playheadRef.current
    if (element === null || element === undefined) return
    const left = `${time * pxPerSec}px`
    if (element.style.left !== left) element.style.left = left
  }, [pxPerSec])

  React.useEffect(() => clock.subscribe((time) => paintPlayhead(time)), [clock, paintPlayhead])

  /* ------------------------------------------------- follow playback */
  React.useEffect(() => clock.subscribe((time) => {
    const scroll = scrollRef.current
    if (scroll === null || scroll === undefined) return
    if (props.playing !== true) return
    const visibleLeft = scroll.scrollLeft
    const visibleRight = visibleLeft + scroll.clientWidth - 96
    const x = time * pxPerSec
    if (x > visibleRight) scroll.scrollLeft = Math.max(0, x - scroll.clientWidth * 0.5)
    else if (x < visibleLeft) scroll.scrollLeft = Math.max(0, x - scroll.clientWidth * 0.2)
  }), [clock, pxPerSec, props.playing])

  /* ------------------------------------------------------- ruler seek drag */
  const seekFromEvent = React.useCallback((clientX) => {
    const content = contentRef.current
    if (content === null || content === undefined) return 0
    const rect = content.getBoundingClientRect()
    const seconds = (clientX - rect.left) / pxPerSec
    return clampSeek(seconds, duration)
  }, [pxPerSec, duration])

  const beginSeek = React.useCallback((event) => {
    const apply = (clientX) => {
      const next = seekFromEvent(clientX)
      clock.set(next)
      if (transport !== null && transport !== undefined && typeof transport.seek === 'function') transport.seek(next)
    }
    apply(event.clientX)
    const move = (moveEvent) => apply(moveEvent.clientX)
    const up = () => {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
    }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }
  }, [seekFromEvent, clock, transport])

  /* ------------------------------------------------------------- trimming */
  const beginTrim = React.useCallback((clip, edge, event) => {
    if (op === null || op === undefined) return
    const media = mediaById.get(clip.mediaId)
    const startX = event.clientX
    const origin = { in: Number(clip.in) || 0, out: Number(clip.out) || 0 }
    let preview = null
    const mediaDuration = media !== undefined && media !== null && Number.isFinite(media.duration) ? media.duration : origin.out

    const move = (moveEvent) => {
      const delta = (moveEvent.clientX - startX) / pxPerSec
      if (edge === 'in') {
        const nextIn = clampNumber(origin.in + delta, 0, origin.out - MIN_CLIP)
        preview = { in: roundTime(nextIn), out: roundTime(origin.out) }
      } else {
        const nextOut = clampNumber(origin.out + delta, origin.in + MIN_CLIP, mediaDuration)
        preview = { in: roundTime(origin.in), out: roundTime(nextOut) }
      }
      const element = clipAreaRef.current
      if (element !== null && element !== undefined && preview !== null) {
        const target = element.querySelector(`[data-clip-id="${clip.id}"]`)
        if (target !== null && target !== undefined) {
          const slice = clip.track === 0
            ? layout.main.find((entry) => entry.clipId === clip.id)
            : layout.overlays.find((entry) => entry.clipId === clip.id)
          if (slice !== undefined) {
            const nextDuration = Math.max(MIN_CLIP, preview.out - preview.in)
            target.style.width = `${Math.max(6, nextDuration * pxPerSec)}px`
            if (clip.track === 1) {
              const start = Math.max(0, Number.isFinite(clip.start) ? clip.start : 0)
              target.style.left = `${start * pxPerSec}px`
            }
          }
        }
      }
    }
    const up = () => {
      removeWindow()
      if (preview === null) return
      const unchanged = Math.abs(preview.in - origin.in) < 1e-3 && Math.abs(preview.out - origin.out) < 1e-3
      if (unchanged) {
        setDrag(null)
        return
      }
      setDrag(null)
      void op({ type: 'trim', clipId: clip.id, in: preview.in, out: preview.out }).then((result) => {
        if (result !== null && result !== undefined && result.ok === false) setError(result.error)
        else setError(null)
      })
    }
    const removeWindow = () => {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
    }
    setDrag({ kind: 'trim', clipId: clip.id, edge })
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }
  }, [op, mediaById, layout, pxPerSec])

  /* ------------------------------------------------- body drag: reorder/move */
  const beginBodyDrag = React.useCallback((clip, event) => {
    if (op === null || op === undefined) return
    const startX = event.clientX
    const originStart = Math.max(0, Number.isFinite(clip.start) ? clip.start : 0)
    const mainIndex = layout.main.findIndex((slice) => slice.clipId === clip.id)
    let target = mainIndex
    let previewStart = originStart

    dragRef.current = { penalty: 0 }

    const move = (moveEvent) => {
      const delta = (moveEvent.clientX - startX) / pxPerSec
      if (clip.track === 1) {
        previewStart = Math.max(0, originStart + delta)
        const target = clipAreaRef.current === null ? null : clipAreaRef.current.querySelector(`[data-clip-id="${clip.id}"]`)
        if (target !== null && target !== undefined) target.style.left = `${previewStart * pxPerSec}px`
        setDrag({ kind: 'overlay-move', clipId: clip.id, start: previewStart })
        return
      }
      const content = contentRef.current
      if (content === null || content === undefined) return
      const rect = content.getBoundingClientRect()
      const seconds = (moveEvent.clientX - rect.left) / pxPerSec
      const nextIndex = reorderIndexAt(layout, seconds, clip.id)
      target = nextIndex
      setDropIndex(nextIndex)
      setDrag({ kind: 'reorder', clipId: clip.id, toIndex: nextIndex })
    }

    const up = () => {
      removeWindow()
      dragRef.current = null
      setDropIndex(-1)
      setDrag(null)
      if (clip.track === 1) {
        if (Math.abs(previewStart - originStart) < 1e-3) return
        void op({ type: 'updateOverlay', clipId: clip.id, start: roundTime(previewStart) }).then((result) => {
          if (result !== null && result !== undefined && result.ok === false) setError(result.error)
          else setError(null)
        })
        return
      }
      if (target === mainIndex || target < 0) return
      void op({ type: 'move', clipId: clip.id, toIndex: target }).then((result) => {
        if (result !== null && result !== undefined && result.ok === false) setError(result.error)
        else setError(null)
      })
    }
    const removeWindow = () => {
      if (typeof window !== 'undefined' && typeof window.removeEventListener === 'function') {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
      }
    }
    setDrag({ kind: clip.track === 1 ? 'overlay-move' : 'reorder', clipId: clip.id, toIndex: mainIndex, start: originStart })
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function') {
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }
  }, [op, layout, pxPerSec])

  /* ---------------------------------------------------------------- zoom */
  const zoomAround = React.useCallback((nextZoom, clientX) => {
    const scroll = scrollRef.current
    const content = contentRef.current
    if (scroll === null || content === null) {
      setPxPerSec(nextZoom)
      return
    }
    const rect = content.getBoundingClientRect()
    const anchor = clientX === undefined ? scroll.clientWidth / 2 : clientX - rect.left
    const seconds = (scroll.scrollLeft + anchor) / pxPerSec
    const clamped = clampNumber(nextZoom, ZOOM_MIN, ZOOM_MAX)
    setPxPerSec(clamped)
    const commit = () => {
      const next = scrollRef.current
      if (next === null || next === undefined) return
      next.scrollLeft = Math.max(0, seconds * clamped - (clientX === undefined ? next.clientWidth / 2 : anchor))
    }
    if (typeof requestAnimationFrame === 'function') requestAnimationFrame(commit)
    else commit()
  }, [pxPerSec])
  const fit = React.useCallback(() => {
    const scroll = scrollRef.current
    const width = scroll === null ? 0 : Math.max(1, scroll.clientWidth - 24)
    const next = fitZoom(duration, width, ZOOM_MIN, ZOOM_MAX)
    setPxPerSec(next)
    if (scroll !== null) scroll.scrollLeft = 0
  }, [duration])

  const onWheel = React.useCallback((event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault()
      const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18
      zoomAround(pxPerSec * factor, event.clientX)
      return
    }
    const scroll = scrollRef.current
    if (scroll === null || scroll === undefined) return
    if (event.deltaY !== 0 && event.deltaX === 0) {
      scroll.scrollLeft += event.deltaY
      event.preventDefault()
    }
  }, [pxPerSec, zoomAround])

  /* Wheel: plain scrolls horizontally, ctrl/meta zooms around the pointer.
     Bound manually because React's onWheel is passive in several browsers, so
     `preventDefault` inside it would not stop the page from scrolling. */
  React.useEffect(() => {
    const scroll = scrollRef.current
    if (scroll === null || scroll === undefined) return undefined
    if (typeof scroll.addEventListener !== 'function') return undefined
    scroll.addEventListener('wheel', onWheel, { passive: false })
    return () => {
      if (typeof scroll.removeEventListener === 'function') scroll.removeEventListener('wheel', onWheel, { passive: false })
    }
  }, [onWheel])


  const split = React.useCallback(() => {
    if (op === null || op === undefined || selectedClipId === null) return
    const clip = clipById.get(selectedClipId)
    if (clip === undefined || clip === null) return
    if (clip.track !== 0) {
      setError('目前只能在主轨道上切分片段')
      return
    }
    const at = clampSeek(clock.get(), duration)
    void op({ type: 'split', clipId: clip.id, at: roundTime(at) }).then((result) => {
      if (result !== null && result !== undefined && result.ok === false) setError(result.error)
      else setError(null)
    })
  }, [op, selectedClipId, clipById, clock, duration])

  const removeSelected = React.useCallback(() => {
    if (op === null || op === undefined || selectedClipId === null) return
    void op({ type: 'delete', clipIds: [selectedClipId] }).then((result) => {
      if (result !== null && result !== undefined && result.ok === false) setError(result.error)
      else {
        setError(null)
        onSelectClip(null)
      }
    })
  }, [op, selectedClipId, onSelectClip])

  const appendMediaAtEnd = React.useCallback((mediaId) => {
    if (op === null || op === undefined) return
    void op({ type: 'addClip', mediaId, track: 0 }).then((result) => {
      if (result !== null && result !== undefined && result.ok === false) setError(result.error)
      else setError(null)
    })
  }, [op])

  /* ------------------------------------------------------ drop from media bin */
  const onDragOver = React.useCallback((event) => {
    if (event.dataTransfer !== null && event.dataTransfer !== undefined) {
      const types = Array.from(event.dataTransfer.types ?? [])
      if (!types.includes('application/x-ve-media')) return
      event.preventDefault()
      event.dataTransfer.dropEffect = 'copy'
      setDropActive(true)
    }
  }, [])

  const onDragLeave = React.useCallback((event) => {
    if (event.currentTarget === event.target) setDropActive(false)
  }, [])

  const onDrop = React.useCallback((event) => {
    const data = event.dataTransfer === null || event.dataTransfer === undefined
      ? ''
      : event.dataTransfer.getData('application/x-ve-media')
    setDropActive(false)
    if (typeof data !== 'string' || data === '') return
    event.preventDefault()
    appendMediaAtEnd(data)
  }, [appendMediaAtEnd])

  /* -------------------------------------------------------------- keyboard */
  const onKeyDown = React.useCallback((event) => {
    const target = event.target
    if (target !== null && target !== undefined) {
      const tag = typeof target.tagName === 'string' ? target.tagName.toLowerCase() : ''
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target.isContentEditable === true) return
    }
    const mod = event.ctrlKey || event.metaKey
    if (event.key === ' ' || event.code === 'Space') {
      event.preventDefault()
      if (transport !== null && transport !== undefined) transport.togglePlay()
      return
    }
    if (mod && (event.key === 'z' || event.key === 'Z')) {
      event.preventDefault()
      void op({ type: event.shiftKey ? 'redo' : 'undo' })
      return
    }
    if (mod && (event.key === 'y' || event.key === 'Y')) {
      event.preventDefault()
      void op({ type: 'redo' })
      return
    }
    if (mod) return
    if (event.key === 's' || event.key === 'S') {
      event.preventDefault()
      split()
      return
    }
    if (event.key === 'Delete' || event.key === 'Backspace') {
      event.preventDefault()
      removeSelected()
      return
    }
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault()
      const direction = event.key === 'ArrowLeft' ? -1 : 1
      if (event.shiftKey) {
        const next = clampSeek(clock.get() + direction * 1, duration)
        clock.set(next)
        if (transport !== null && transport !== undefined) transport.seek(next)
      } else if (transport !== null && transport !== undefined) {
        transport.stepBy(direction)
      }
    }
  }, [op, split, removeSelected, clock, duration, transport])

  /* --------------------------------------------------------------- render */
  const mainSlices = layout.main
  const overlaySlices = layout.overlays
  const total = duration
  const empty = mainSlices.length === 0 && overlaySlices.length === 0
  const thumbCount = Math.max(1, Math.min(FILMSTRIP_FRAMES, Math.round(pxPerSec / 26)))

  const clipNode = (slice) => {
    const clip = clipById.get(slice.clipId)
    if (clip === undefined || clip === null) return null
    const media = mediaById.get(clip.mediaId)
    return (
      <ClipBlock
        key={clip.id}
        clip={clip}
        media={media}
        slice={slice}
        fps={fps}
        selected={selectedClipId === clip.id}
        pxPerSec={pxPerSec}
        thumbCount={thumbCount}
        sessionId={sessionId}
        t={t}
        dragging={drag !== null && drag.clipId === clip.id}
        dropTarget={dropIndex >= 0 && drag !== null && drag.kind === 'reorder' && mainSlices[dropIndex] !== undefined && mainSlices[dropIndex].clipId === clip.id}
        onSelect={onSelectClip}
        onTrimStart={beginTrim}
        onBodyDragStart={beginBodyDrag}
      />
    )
  }

  return (
    <section className="ve-timeline" tabIndex={0} onKeyDown={onKeyDown} aria-label={t('timeline.title')}>
      <div className="ve-tl-head">
        <div className="ve-tl-title">{t('timeline.title')}</div>
        <button
          type="button"
          className="ve-icon-btn"
          onClick={split}
          disabled={selectedClipId === null || busy}
          title={`${t('timeline.splitAtPlayhead')} (S)`}
          aria-label={t('timeline.splitAtPlayhead')}
        >
          <SplitIcon size={11} />
          <span>{t('timeline.split')}</span>
        </button>
        <button
          type="button"
          className="ve-icon-btn"
          onClick={removeSelected}
          disabled={selectedClipId === null || busy}
          title={`${t('timeline.deleteClip')} (Del)`}
          aria-label={t('timeline.deleteClip')}
        >
          <TrashIcon size={11} />
        </button>
        <button
          type="button"
          className="ve-icon-btn"
          onClick={() => onImportRequest()}
          title={t('bin.import')}
          aria-label={t('bin.import')}
        >
          <PlusIcon size={11} />
        </button>
        <div className="ve-tl-grow" />
        <div className="ve-zoom">
          <span>{t('timeline.zoom')}</span>
          <input
            className="ve-range ve-zoom-range"
            type="range"
            min={ZOOM_MIN}
            max={ZOOM_MAX}
            step={10}
            value={Math.round(pxPerSec)}
            onChange={(event) => zoomAround(Number(event.target.value), undefined)}
            aria-label={t('timeline.zoom')}
          />
          <span className="ve-zoom-value">{`${Math.round(pxPerSec)} px/s`}</span>
        </div>
        <button type="button" className="ve-icon-btn" onClick={fit} title={t('timeline.fit')}>
          <FitIcon size={11} />
          <span>{t('timeline.fit')}</span>
        </button>
        <div className="ve-tl-total">
          <span>{t('timeline.total')}</span>
          <span className="ve-timecode">{formatTimecode(total, fps)}</span>
        </div>
      </div>

      {error === null ? null : (
        <div className="ve-error-inline">
          <div className="ve-error-inline-body">{error}</div>
          <button type="button" className="ve-btn ve-btn-ghost" onClick={() => setError(null)}>{t('common.close')}</button>
        </div>
      )}

      <div className="ve-tl-body">
        <div className="ve-tl-labels">
          <div className="ve-labels-spacer" />
          <div className="ve-track-label" style={{ height: `${TRACK_HEIGHT}px` }}>
            <div className="ve-track-label-name">
              <span className="ve-track-label-dot ve-track-label-dot-main" />
              {t('timeline.trackMain')}
            </div>
            <div className="ve-track-label-hint">{t('timeline.mainHint')}</div>
          </div>
          <div className="ve-track-label" style={{ height: `${TRACK_HEIGHT}px` }}>
            <div className="ve-track-label-name">
              <span className="ve-track-label-dot ve-track-label-dot-overlay" />
              {t('timeline.trackOverlay')}
            </div>
            <div className="ve-track-label-hint">{t('timeline.overlayHint')}</div>
          </div>
        </div>

        <div
          className="ve-tl-scroll"
          ref={scrollRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <div className="ve-tl-content" ref={contentRef} style={{ width: `${trackWidth}px` }}>
            <Ruler duration={duration} pxPerSec={pxPerSec} width={trackWidth} onSeekStart={beginSeek} />

            <div className="ve-track-row" ref={clipAreaRef} style={{ width: `${trackWidth}px` }}>
              {mainSlices.map((slice) => clipNode(slice))}
              {dropActive ? <div className="ve-track-drop" /> : null}
            </div>

            <div className="ve-track-row ve-track-row-empty" style={{ width: `${trackWidth}px` }}>
              {overlaySlices.map((slice) => clipNode(slice))}
            </div>

            {empty ? (
              <div className="ve-tl-empty">
                <div className="ve-tl-empty-title">{t('timeline.empty')}</div>
                <div className="ve-tl-empty-hint">{t('timeline.mainHint')}</div>
              </div>
            ) : null}

            <div className="ve-playhead" ref={playheadRef} style={{ left: `${clock.get() * pxPerSec}px` }} />
            <div className="ve-playhead-handle" style={{ left: `${clock.get() * pxPerSec}px` }} onMouseDown={beginSeek} />
          </div>
        </div>
      </div>

      <div className="ve-tl-hintbar">
        <span className="ve-tl-hint-key">{t('timeline.shortcuts')}</span>
        <div className="ve-tl-grow" />
        {ping !== null && ping !== undefined && ping.ffmpeg !== undefined && ping.ffmpeg.available === false ? (
          <span>{t('toolbar.ffmpegMissing')}</span>
        ) : null}
      </div>
    </section>
  )
}
