/**
 * The workbench page: toolbar, media bin, preview and timeline, wired to the
 * `useWorkbench` polling hook.
 *
 * Crash safety is layered:
 *  1. every `op`/fetch failure is an inline, dismissible message (never a throw);
 *  2. `WorkbenchBody` wraps its own render body in `try/catch`;
 *  3. a class-based `ViewErrorBoundary` catches anything thrown by descendants
 *     and renders the compact card with Retry.
 */
import React from 'react'
import { useWorkbench, usePing } from './api.js'
import { createTimeBus } from './timebus.js'
import { layoutOfState, hasClip } from './model.js'
import { MediaBin } from './MediaBin.jsx'
import { Preview } from './Preview.jsx'
import { Timeline } from './Timeline.jsx'
import { ExportDialog } from './ExportDialog.jsx'
import {
  FilmIcon,
  ExportIcon,
  UndoIcon,
  RedoIcon,
  WarningIcon,
  RetryIcon,
  UploadIcon,
  CloseIcon,
} from './icons.jsx'

const PRESETS = [
  { id: '1920x1080', width: 1920, height: 1080, key: 'preset.landscape1080' },
  { id: '1280x720', width: 1280, height: 720, key: 'preset.landscape720' },
  { id: '1080x1920', width: 1080, height: 1920, key: 'preset.portrait1080' },
  { id: '1080x1080', width: 1080, height: 1080, key: 'preset.square1080' },
  { id: '3840x2160', width: 3840, height: 2160, key: 'preset.uhd4k' },
]

const FPS_OPTIONS = [24, 25, 30, 50, 60]

function currentPreset(state) {
  const width = Number.isFinite(state?.width) ? state.width : 1920
  const height = Number.isFinite(state?.height) ? state.height : 1080
  const match = PRESETS.find((preset) => preset.width === width && preset.height === height)
  return match === undefined ? 'custom' : match.id
}

/** The actual page body. Any render-time throw is caught by the caller. */
function WorkbenchBody(props) {
  const { sessionId, t, initialFocus, openBus } = props
  const { state, error, busy, loading, op, refresh, setError, clearError, adoptState } = useWorkbench(sessionId)
  const ping = usePing(sessionId)

  const clock = React.useMemo(() => createTimeBus(0), [])
  const [playing, setPlaying] = React.useState(false)
  const [selectedClipId, setSelectedClipId] = React.useState(null)
  const [exportOpen, setExportOpen] = React.useState(false)
  const [titleEditing, setTitleEditing] = React.useState(false)
  const [titleDraft, setTitleDraft] = React.useState('')
  const [transport, setTransport] = React.useState(null)

  const titleRef = React.useRef(null)
  const importRef = React.useRef(null)
  const focusRequest = React.useRef(initialFocus)

  const registerImport = React.useCallback((handler) => {
    importRef.current = typeof handler === 'function' ? handler : null
  }, [])

  const registerTransport = React.useCallback((api) => {
    setTransport(api === null || api === undefined ? null : api)
  }, [])

  const requestImport = React.useCallback(() => {
    if (importRef.current !== null) {
      importRef.current()
      return
    }
    if (typeof document === 'undefined') return
    const trigger = document.querySelector('[data-ve-import-trigger="true"]')
    if (trigger !== null && trigger !== undefined && typeof trigger.focus === 'function') trigger.focus()
  }, [])

  /* ------------------------------------------------------- open requests */
  React.useEffect(() => {
    if (openBus === null || openBus === undefined || typeof openBus.register !== 'function') return undefined
    const off = openBus.register(() => requestImport())
    return () => {
      if (typeof off === 'function') off()
    }
  }, [requestImport, openBus])

  React.useEffect(() => {
    const focus = focusRequest.current
    focusRequest.current = null
    if (focus === null || focus === undefined) return undefined
    if (typeof window === 'undefined' || typeof window.setTimeout !== 'function') return undefined
    const timer = window.setTimeout(() => requestImport(), 0)
    return () => window.clearTimeout(timer)
  }, [requestImport])

  /* ------------------------------------------------ selection housekeeping */
  React.useEffect(() => {
    if (selectedClipId === null) return
    if (!hasClip(state, selectedClipId)) setSelectedClipId(null)
  }, [state, selectedClipId])

  const duration = layoutOfState(state).duration
  React.useEffect(() => {
    if (duration <= 0 && playing) setPlaying(false)
  }, [duration, playing])

  /* ------------------------------------------------------- toolbar actions */
  const setProject = React.useCallback((patch) => {
    void op({ type: 'setProject', ...patch }).then((result) => {
      if (result !== null && result !== undefined && result.ok === false) setError(result.error)
    })
  }, [op, setError])

  const startTitleEdit = React.useCallback(() => {
    if (state === null || state === undefined) return
    setTitleDraft(state.title ?? '')
    setTitleEditing(true)
  }, [state])

  React.useEffect(() => {
    if (!titleEditing) return
    const input = titleRef.current
    if (input === null || input === undefined) return
    if (typeof input.focus === 'function') input.focus()
    if (typeof input.select === 'function') input.select()
  }, [titleEditing])

  const commitTitle = React.useCallback(() => {
    setTitleEditing(false)
    const next = titleDraft.trim()
    if (next === '' || (state !== null && state !== undefined && next === state.title)) return
    setProject({ title: next })
  }, [titleDraft, state, setProject])

  const addMediaClip = React.useCallback((mediaId) => {
    void op({ type: 'addClip', mediaId, track: 0 }).then((result) => {
      if (result !== null && result !== undefined && result.ok === false) setError(result.error)
    })
  }, [op, setError])

  const undo = React.useCallback(() => {
    void op({ type: 'undo' }).then((result) => {
      if (result !== null && result !== undefined && result.ok === false) setError(result.error)
    })
  }, [op, setError])

  const redo = React.useCallback(() => {
    void op({ type: 'redo' }).then((result) => {
      if (result !== null && result !== undefined && result.ok === false) setError(result.error)
    })
  }, [op, setError])

  /* ----------------------------------------------------------------- render */
  if (error !== null && state === null) {
    return (
      <div className="ve-root">
        <div className="ve-error-card" style={{ marginTop: 'auto', marginBottom: 'auto' }}>
          <WarningIcon size={16} />
          <div className="ve-error-card-body">
            <div className="ve-error-card-title">{t('error.load')}</div>
            <div className="ve-error-card-detail">{error}</div>
          </div>
          <button type="button" className="ve-btn" onClick={() => { void refresh(); clearError() }}>
            <RetryIcon size={12} />
            <span>{t('error.retry')}</span>
          </button>
        </div>
      </div>
    )
  }

  const preset = currentPreset(state)
  const ffmpegMissing = ping !== null && ping !== undefined && ping.ffmpeg !== undefined && ping.ffmpeg.available === false
  const title = state === null || state === undefined ? t('toolbar.titlePlaceholder') : String(state.title ?? t('toolbar.titlePlaceholder'))
  const fps = Number.isFinite(state?.fps) ? state.fps : 30
  const canUndo = state !== null && state !== undefined && state.canUndo === true
  const canRedo = state !== null && state !== undefined && state.canRedo === true

  return (
    <div className="ve-root">
      <div className="ve-toolbar">
        <div className="ve-brand">
          <FilmIcon size={15} />
          <span className="ve-brand-dot" />
        </div>

        {titleEditing ? (
          <input
            ref={titleRef}
            className="ve-title ve-title-input"
            value={titleDraft}
            onChange={(event) => setTitleDraft(event.target.value)}
            onBlur={commitTitle}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                commitTitle()
              }
              if (event.key === 'Escape') {
                event.preventDefault()
                setTitleEditing(false)
              }
            }}
            maxLength={80}
            aria-label={t('toolbar.titleEdit')}
          />
        ) : (
          <div
            className="ve-title"
            role="button"
            tabIndex={0}
            onDoubleClick={startTitleEdit}
            onKeyDown={(event) => {
              if (event.key === 'Enter') startTitleEdit()
            }}
            title={t('toolbar.titleEdit')}
          >
            {title}
          </div>
        )}

        <div className="ve-spacer" />

        <div className="ve-field">
          <span className="ve-field-label">{t('toolbar.canvas')}</span>
          <select
            className="ve-select"
            value={preset}
            onChange={(event) => {
              const next = PRESETS.find((item) => item.id === event.target.value)
              if (next === undefined) return
              setProject({ width: next.width, height: next.height })
            }}
            aria-label={t('toolbar.canvas')}
          >
            {PRESETS.map((item) => (
              <option key={item.id} value={item.id}>{t(item.key)}</option>
            ))}
            {preset === 'custom' ? <option value="custom">{t('toolbar.custom')}</option> : null}
          </select>
        </div>

        <div className="ve-field">
          <span className="ve-field-label">{t('toolbar.fps')}</span>
          <select
            className="ve-select"
            value={fps}
            onChange={(event) => setProject({ fps: Number(event.target.value) })}
            aria-label={t('toolbar.fps')}
          >
            {FPS_OPTIONS.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
          </select>
        </div>

        <button
          type="button"
          className="ve-icon-btn"
          onClick={undo}
          disabled={!canUndo || busy || loading}
          title={`${t('toolbar.undo')} · Ctrl+Z`}
          aria-label={t('toolbar.undo')}
        >
          <UndoIcon size={12} />
        </button>
        <button
          type="button"
          className="ve-icon-btn"
          onClick={redo}
          disabled={!canRedo || busy || loading}
          title={`${t('toolbar.redo')} · Ctrl+Y`}
          aria-label={t('toolbar.redo')}
        >
          <RedoIcon size={12} />
        </button>

        <button
          type="button"
          className="ve-btn"
          data-ve-import-trigger="true"
          onClick={requestImport}
        >
          <UploadIcon size={11} />
          <span>{t('toolbar.import')}</span>
        </button>
        <button
          type="button"
          className="ve-btn ve-btn-primary"
          onClick={() => setExportOpen(true)}
          disabled={ffmpegMissing || duration <= 0}
        >
          <ExportIcon size={12} />
          <span>{t('toolbar.export')}</span>
        </button>

        {ffmpegMissing ? (
          <div className="ve-warn-chip" title={t('toolbar.ffmpegHint')}>
            <WarningIcon size={11} />
            <span>{t('toolbar.ffmpegMissing')}</span>
          </div>
        ) : null}
        {busy ? (
          <div className="ve-busy-chip">
            <span className="ve-spin" />
            <span>{t('toolbar.busy')}</span>
          </div>
        ) : null}
      </div>

      <div className="ve-main">
        <MediaBin
          state={state}
          sessionId={sessionId}
          op={op}
          refresh={refresh}
          adoptState={adoptState}
          t={t}
          onAddClip={addMediaClip}
          busy={busy}
          registerImport={registerImport}
        />
        <Preview
          state={state}
          sessionId={sessionId}
          clock={clock}
          playing={playing}
          onPlaying={setPlaying}
          t={t}
          error={null}
          onRegisterApi={registerTransport}
        />
      </div>

      <Timeline
        state={state}
        sessionId={sessionId}
        op={op}
        clock={clock}
        t={t}
        ping={ping}
        selectedClipId={selectedClipId}
        onSelectClip={setSelectedClipId}
        transport={transport}
        onImportRequest={requestImport}
        busy={busy}
        playing={playing}
      />

      {error === null ? null : (
        <div className="ve-error-inline" style={{ position: 'absolute', left: 8, right: 8, bottom: 6, margin: 0, zIndex: 7 }}>
          <WarningIcon size={12} />
          <div className="ve-error-inline-body">{t('error.op', { message: error })}</div>
          <button type="button" className="ve-mini-btn" onClick={clearError} aria-label={t('common.close')}>
            <CloseIcon size={10} />
          </button>
        </div>
      )}

      <ExportDialog
        sessionId={sessionId}
        state={state}
        ping={ping}
        t={t}
        open={exportOpen}
        onClose={() => setExportOpen(false)}
      />
    </div>
  )
}

/** Compact reusable error card. */
function ErrorCard(props) {
  const { t, message, onRetry } = props
  return (
    <div className="ve-root">
      <div className="ve-error-card">
        <WarningIcon size={16} />
        <div className="ve-error-card-body">
          <div className="ve-error-card-title">{t('error.title')}</div>
          <div className="ve-error-card-detail">{message}</div>
        </div>
        <button type="button" className="ve-btn" onClick={onRetry}>
          <RetryIcon size={12} />
          <span>{t('error.retry')}</span>
        </button>
      </div>
    </div>
  )
}

/**
 * Catch-all boundary for the view subtree: reports every descendant throw into
 * a retry card instead of tearing the conversation shell down.
 */
class ViewErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { failure: null }
    this.handleRetry = this.handleRetry.bind(this)
  }

  static getDerivedStateFromError(failure) {
    return { failure }
  }

  componentDidCatch(failure, info) {
    // eslint-disable-next-line no-console
    console.error('[video-editor] workbench render failed:', failure, info)
  }

  handleRetry() {
    this.setState({ failure: null })
  }

  render() {
    const { t } = this.props
    if (this.state.failure !== null) {
      const message = String((this.state.failure && this.state.failure.message) || this.state.failure)
      return <ErrorCard t={t} message={message} onRetry={this.handleRetry} />
    }
    return this.props.children
  }
}

/**
 * The view component rendered by the `conversation.view` slot.
 * @param props - composed slot props: `sessionId` (session scope) and `t` (locale seat).
 */
export function Workbench(props) {
  const t = props !== null && props !== undefined && typeof props.t === 'function' ? props.t : (key) => key
  const sessionId = props !== null && props !== undefined && typeof props.sessionId === 'string' && props.sessionId !== ''
    ? props.sessionId
    : undefined

  if (sessionId === undefined) {
    return <ErrorCard t={t} message={t('error.noSession')} onRetry={() => {}} />
  }

  let body
  try {
    body = (
      <WorkbenchBody
        sessionId={sessionId}
        t={t}
        initialFocus={props.viewRequest}
        openBus={props.openBus}
      />
    )
  } catch (failure) {
    const message = String((failure && failure.message) || failure)
    return <ErrorCard t={t} message={message} onRetry={() => {}} />
  }
  return <ViewErrorBoundary t={t}>{body}</ViewErrorBoundary>
}
