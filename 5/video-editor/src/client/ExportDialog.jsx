/**
 * Export modal: filename, quality, progress polling, download link and the
 * host output path.
 */
import React from 'react'
import { exportFileUrl, getExportJob, startExport, EXPORT_POLL_MS } from './api.js'
import { formatClock, layoutOfState } from './model.js'
import { ExportIcon, DownloadIcon, CloseIcon, WarningIcon } from './icons.jsx'

/** Default file name: `edit-YYYYMMDD-HHmmss.mp4`. */
export function defaultName(now) {
  const stamp = now === undefined ? new Date() : now
  const pad = (value) => String(value).padStart(2, '0')
  return `edit-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.mp4`
}

function jobStatusKey(job) {
  if (job === null || job === undefined) return 'export.queued'
  if (job.status === 'done') return 'export.done'
  if (job.status === 'error') return 'export.failed'
  if (job.status === 'running') return 'export.running'
  return 'export.queued'
}

/**
 * The export dialog.
 * @param props - sessionId, state, ping, t, open, onClose, onStarted.
 */
export function ExportDialog(props) {
  const { sessionId, state, ping, t, open, onClose, onStarted } = props
  const layout = React.useMemo(() => layoutOfState(state), [state])
  const [filename, setFilename] = React.useState(() => defaultName())
  const [quality, setQuality] = React.useState('high')
  const [jobId, setJobId] = React.useState(null)
  const [job, setJob] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [submitting, setSubmitting] = React.useState(false)

  const ffmpegMissing = ping !== null && ping !== undefined && ping.ffmpeg !== undefined && ping.ffmpeg.available === false
  const cycle = layout.duration > 0

  React.useEffect(() => {
    if (open === true) {
      setError(null)
      if (jobId === null) setFilename(defaultName())
    }
  }, [open])

  const status = job === null || job === undefined ? null : job.status
  const settled = status === 'done' || status === 'error'

  /* progress polling while a job is unfinished (interval lives until settled) */
  React.useEffect(() => {
    if (jobId === null || settled) return undefined
    let alive = true
    const tick = () => {
      void getExportJob(sessionId, jobId).then((result) => {
        if (!alive) return
        if (result.ok) setJob(result.job)
        else setError(result.error)
      })
    }
    const timer = setInterval(tick, EXPORT_POLL_MS)
    tick()
    return () => {
      alive = false
      clearInterval(timer)
    }
  }, [sessionId, jobId, settled])

  const start = React.useCallback(async () => {
    if (ffmpegMissing || !cycle) return
    setSubmitting(true)
    setError(null)
    const result = await startExport(sessionId, { filename, quality })
    setSubmitting(false)
    if (!result.ok) {
      setError(result.error)
      return
    }
    setJobId(result.jobId)
    setJob(result.job ?? { id: result.jobId, status: 'queued', progress: 0, filename })
    if (typeof onStarted === 'function') onStarted(result.jobId)
  }, [sessionId, filename, quality, ffmpegMissing, cycle, onStarted])

  if (open !== true) return null

  const percent = job === null || job === undefined || !Number.isFinite(job.progress)
    ? 0
    : Math.round(Math.max(0, Math.min(1, job.progress)) * 100)
  const running = submitting || (jobId !== null && job !== null && job !== undefined && (job.status === 'running' || job.status === 'queued'))
  const done = job !== null && job !== undefined && job.status === 'done'
  const failed = job !== null && job !== undefined && job.status === 'error'

  return (
    <div className="ve-modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
      <div className="ve-modal" role="dialog" aria-modal="true" aria-label={t('export.title')}>
        <div className="ve-modal-head">
          <ExportIcon size={13} />
          <div className="ve-modal-title">{t('export.title')}</div>
          <div className="ve-modal-grow" />
          <button type="button" className="ve-mini-btn" onClick={onClose} aria-label={t('export.close')}>
            <CloseIcon size={11} />
          </button>
        </div>

        <div className="ve-modal-body">
          {ffmpegMissing ? (
            <div className="ve-error-inline" style={{ margin: 0 }}>
              <WarningIcon size={12} />
              <div className="ve-error-inline-body">{t('export.ffmpegMissing')}</div>
            </div>
          ) : null}
          {!cycle ? (
            <div className="ve-modal-note">{t('export.empty')}</div>
          ) : null}

          <div className="ve-form-row">
            <label className="ve-form-label" htmlFor="ve-export-name">{t('export.filename')}</label>
            <input
              id="ve-export-name"
              className="ve-input ve-input-mono"
              value={filename}
              onChange={(event) => setFilename(event.target.value)}
              disabled={running}
            />
          </div>

          <div className="ve-form-row">
            <label className="ve-form-label" htmlFor="ve-export-quality">{t('export.quality')}</label>
            <select
              id="ve-export-quality"
              className="ve-select"
              value={quality}
              onChange={(event) => setQuality(event.target.value)}
              disabled={running}
            >
              <option value="high">{t('export.qualityHigh')}</option>
              <option value="fast">{t('export.qualityFast')}</option>
            </select>
          </div>

          <div className="ve-progress">
            <div className="ve-progress-bar" style={{ width: `${done ? 100 : percent}%` }} />
          </div>
          <div className="ve-progress-meta">
            <span>{job === null || job === undefined ? t('export.queued') : t(jobStatusKey(job))}</span>
            {job !== null && job !== undefined && Number.isFinite(job.duration) && job.duration > 0 ? (
              <span>{formatClock(job.duration)}</span>
            ) : null}
            <span className="ve-progress-percent">{done ? 100 : percent}%</span>
          </div>

          {failed ? (
            <div className="ve-modal-error">{job.error === undefined || job.error === null ? t('export.failed') : String(job.error)}</div>
          ) : null}
          {error === null ? null : <div className="ve-modal-error">{error}</div>}

          {done ? (
            <div className="ve-form-row">
              <span className="ve-form-label">{t('export.outputPath')}</span>
              <div className="ve-output-path">{job.outputPath ?? t('common.unknown')}</div>
              <div className="ve-modal-note">{t('export.openHint')}</div>
            </div>
          ) : null}
        </div>

        <div className="ve-modal-foot">
          <button type="button" className="ve-btn ve-btn-ghost" onClick={onClose}>
            {t('export.close')}
          </button>
          <div className="ve-modal-grow" />
          {done ? (
            <a
              className="ve-link"
              href={exportFileUrl(sessionId, job.id)}
              download={job.filename ?? undefined}
            >
              <DownloadIcon size={12} />
              <span>{t('export.download')}</span>
            </a>
          ) : null}
          {done ? (
            <button
              type="button"
              className="ve-btn"
              onClick={() => {
                setJob(null)
                setJobId(null)
                setError(null)
                setFilename(defaultName())
              }}
            >
              <ExportIcon size={12} />
              <span>{t('export.again')}</span>
            </button>
          ) : (
            <button
              type="button"
              className="ve-btn ve-btn-primary"
              onClick={() => void start()}
              disabled={running || ffmpegMissing || !cycle}
            >
              {running ? <span className="ve-spin" /> : <ExportIcon size={12} />}
              <span>{running ? t('export.running') : t('export.start')}</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
