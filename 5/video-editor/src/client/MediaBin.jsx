/**
 * Media bin: import (picker / drop / host path), poster thumbnails, add-to-
 * timeline and remove.
 */
import React from 'react'
import { posterUrl, uploadMedia, importPaths } from './api.js'
import { formatClock } from './model.js'
import { PlusIcon, TrashIcon, UploadIcon, PathIcon, FilmIcon, CloseIcon } from './icons.jsx'

/** Poster thumbnail with a graceful fallback. */
function Poster(props) {
  const { src, alt } = props
  const [failed, setFailed] = React.useState(false)
  React.useEffect(() => {
    setFailed(false)
  }, [src])
  if (failed || src === undefined || src === null) {
    return (
      <div className="ve-bin-thumb" aria-hidden="true">
        <FilmIcon size={16} />
      </div>
    )
  }
  return (
    <div className="ve-bin-thumb">
      <img src={src} alt={alt} draggable={false} loading="lazy" onError={() => setFailed(true)} />
    </div>
  )
}

/**
 * The media library column.
 * @param props - state, sessionId, op, refresh, t, onAddClip, onRequestImport, registerImport.
 */
export function MediaBin(props) {
  const { state, sessionId, op, refresh, t, onAddClip, adoptState, busy } = props
  const registerImport = props.registerImport
  const media = Array.isArray(state?.media) ? state.media : []

  const [dropActive, setDropActive] = React.useState(false)
  const [uploading, setUploading] = React.useState(0)
  const [pathOpen, setPathOpen] = React.useState(false)
  const [pathValue, setPathValue] = React.useState('')
  const [error, setError] = React.useState(null)
  const [notice, setNotice] = React.useState(null)
  const fileRef = React.useRef(null)

  const openPicker = React.useCallback(() => {
    const input = fileRef.current
    if (input === null || input === undefined) return
    input.click()
  }, [])

  // The workbench listens for `dsh-video-editor:open`; the dock dispatches it.
  // Wiring the import action is the documented reaction.
  React.useEffect(() => {
    if (typeof registerImport !== 'function') return undefined
    registerImport(openPicker)
    return () => registerImport(null)
  }, [registerImport, openPicker])

  const uploadFiles = React.useCallback(async (files) => {
    const list = Array.from(files ?? []).filter((file) => file !== null && file !== undefined && typeof file.name === 'string')
    if (list.length === 0) return
    setError(null)
    setNotice(null)
    for (const file of list) {
      setUploading((count) => count + 1)
      const result = await uploadMedia(sessionId, file)
      setUploading((count) => Math.max(0, count - 1))
      if (!result.ok) {
        setError(t('error.upload', { message: result.error }))
        continue
      }
      // The upload response carries the authoritative state; adopt it directly
      // so the bin updates without a second round trip.
      if (typeof adoptState === 'function' && result.state !== undefined) adoptState(result.state)
      else if (typeof refresh === 'function') await refresh()
      const item = result.media
      if (item !== null && item !== undefined && typeof item.id === 'string') {
        setNotice(`+ ${item.name}`)
      }
    }
  }, [sessionId, refresh, t, adoptState])

  const onFileChange = React.useCallback((event) => {
    const files = event.target.files
    if (files === null || files === undefined) return
    void uploadFiles(files)
    event.target.value = ''
  }, [uploadFiles])

  const onDragOver = React.useCallback((event) => {
    if (event.dataTransfer === null || event.dataTransfer === undefined) return
    const hasFiles = Array.from(event.dataTransfer.types ?? []).includes('Files')
    const hasMedia = Array.from(event.dataTransfer.types ?? []).includes('application/x-ve-media')
    if (!hasFiles && !hasMedia) return
    event.preventDefault()
    event.dataTransfer.dropEffect = hasFiles ? 'copy' : 'move'
    setDropActive(true)
  }, [])

  const onDragLeave = React.useCallback((event) => {
    if (event.currentTarget === event.target) setDropActive(false)
  }, [])

  const onDrop = React.useCallback((event) => {
    if (event.dataTransfer === null || event.dataTransfer === undefined) return
    const files = event.dataTransfer.files
    setDropActive(false)
    if (files !== null && files !== undefined && files.length > 0) {
      event.preventDefault()
      void uploadFiles(files)
    }
  }, [uploadFiles])

  const importPathValue = React.useCallback(async () => {
    const paths = pathValue
      .split(/[\n,]+/)
      .map((entry) => entry.trim())
      .filter((entry) => entry !== '')
    if (paths.length === 0) {
      setError(t('bin.pathEmpty'))
      return
    }
    const result = await importPaths(sessionId, paths)
    if (!result.ok) {
      setError(result.error)
      return
    }
    if (Array.isArray(result.skipped) && result.skipped.length > 0) {
      setNotice(`${result.skipped.length} skipped`)
    }
    setPathOpen(false)
    setPathValue('')
    setError(null)
    if (typeof adoptState === 'function' && result.state !== undefined) adoptState(result.state)
    else if (typeof refresh === 'function') await refresh()
  }, [pathValue, sessionId, refresh, adoptState, t])

  const removeMedia = React.useCallback(async (mediaId) => {
    const result = await op({ type: 'removeMedia', mediaId })
    if (result !== null && result !== undefined && result.ok === false) setError(result.error)
    else setError(null)
  }, [op])

  return (
    <aside className="ve-bin">
      <div className="ve-bin-head">
        <span className="ve-bin-title">{t('bin.title')}</span>
        <span className="ve-bin-count">{t('bin.count', { count: media.length })}</span>
        <div className="ve-bin-grow" />
        <button
          type="button"
          className="ve-icon-btn"
          onClick={() => setPathOpen((value) => !value)}
          title={t('bin.path')}
          aria-label={t('bin.path')}
        >
          <PathIcon size={11} />
        </button>
        <button
          type="button"
          className="ve-btn"
          onClick={openPicker}
          title={t('bin.import')}
        >
          <UploadIcon size={11} />
          <span>{t('bin.import')}</span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="video/*"
          multiple
          style={{ display: 'none' }}
          onChange={onFileChange}
        />
      </div>

      {pathOpen ? (
        <div className="ve-bin-pathbar">
          <textarea
            className="ve-textarea"
            value={pathValue}
            placeholder={t('bin.pathPlaceholder')}
            onChange={(event) => setPathValue(event.target.value)}
            aria-label={t('bin.path')}
          />
          <div className="ve-row-end">
            <button type="button" className="ve-icon-btn" onClick={() => { setPathOpen(false); setPathValue('') }}>
              <CloseIcon size={11} />
              <span>{t('bin.pathCancel')}</span>
            </button>
            <button type="button" className="ve-btn ve-btn-primary" onClick={() => void importPathValue()}>
              {t('bin.pathConfirm')}
            </button>
          </div>
        </div>
      ) : null}

      {error === null ? null : (
        <div className="ve-error-inline">
          <div className="ve-error-inline-body">{error}</div>
          <button type="button" className="ve-mini-btn" onClick={() => setError(null)} aria-label={t('common.close')}>
            <CloseIcon size={10} />
          </button>
        </div>
      )}
      {notice === null ? null : (
        <div className="ve-bin-uploading">
          <span>{notice}</span>
        </div>
      )}

      {media.length === 0 ? (
        <div
          className="ve-bin-list ve-bin-empty"
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <FilmIcon size={26} />
          <div className="ve-bin-empty-title">{t('bin.empty')}</div>
          <div className="ve-bin-empty-hint">{t('bin.emptyHint')}</div>
        </div>
      ) : (
        <div className="ve-bin-list" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
          {media.map((item) => (
            <div
              key={item.id}
              className="ve-bin-row"
              draggable
              onDragStart={(event) => {
                if (event.dataTransfer === null || event.dataTransfer === undefined) return
                event.dataTransfer.setData('application/x-ve-media', item.id)
                event.dataTransfer.effectAllowed = 'copy'
              }}
              title={item.name}
            >
              <Poster src={posterUrl(sessionId, item.id)} alt={item.name} />
              <div className="ve-bin-meta">
                <div className="ve-bin-name">{item.name}</div>
                <div className="ve-bin-sub">
                  <span className="ve-duration">{formatClock(item.duration)}</span>
                  <span className="ve-dot" />
                  <span>{`${item.width}×${item.height}`}</span>
                  {item.hasAudio === true ? <span className="ve-dot" /> : null}
                  {item.hasAudio === true ? <span>{t('bin.hasAudio')}</span> : null}
                </div>
              </div>
              <div className="ve-bin-actions">
                <button
                  type="button"
                  className="ve-mini-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    onAddClip(item.id)
                  }}
                  title={t('bin.addToTimeline')}
                  aria-label={t('bin.addToTimeline')}
                  disabled={busy}
                >
                  <PlusIcon size={10} />
                </button>
                <button
                  type="button"
                  className="ve-mini-btn ve-mini-btn-danger"
                  onClick={(event) => {
                    event.stopPropagation()
                    void removeMedia(item.id)
                  }}
                  title={t('bin.remove')}
                  aria-label={t('bin.remove')}
                  disabled={busy}
                >
                  <TrashIcon size={10} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {uploading > 0 ? (
        <div className="ve-bin-uploading">
          <span className="ve-spin" />
          <span>{t('bin.uploading')}</span>
        </div>
      ) : null}

      {dropActive ? (
        <div className="ve-bin-drop">
          <UploadIcon size={22} />
          <div>{t('bin.dropHint')}</div>
        </div>
      ) : null}
    </aside>
  )
}
