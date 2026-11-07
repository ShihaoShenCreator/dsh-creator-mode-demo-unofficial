/**
 * Fetch layer for the workbench routes plus the two polling hooks.
 *
 * Every URL is derived from the Session id — no absolute paths, no URLs
 * hardcoded anywhere else in the client half. Business failures arrive as
 * HTTP 200 with `{ok:false,error}`, so every helper returns a discriminated
 * result object and never throws for a normal failure.
 */
import React from 'react'

const ROUTE_PREFIX = '/video-editor'
const SESSION_RE = /^[A-Za-z0-9._-]{1,120}$/

export const STATE_POLL_MS = 900
export const DOCK_POLL_MS = 1500
export const EXPORT_POLL_MS = 600

export function isSessionId(value) {
  return typeof value === 'string' && SESSION_RE.test(value)
}

/** Base path of one Session's workbench API. */
export function sessionBase(sessionId) {
  const id = typeof sessionId === 'string' ? sessionId : ''
  return `${ROUTE_PREFIX}/s/${encodeURIComponent(id)}`
}

export function stateUrl(sessionId) {
  return `${sessionBase(sessionId)}/state`
}

export function opUrl(sessionId) {
  return `${sessionBase(sessionId)}/op`
}

export function mediaUploadUrl(sessionId) {
  return `${sessionBase(sessionId)}/media`
}

export function importUrl(sessionId) {
  return `${sessionBase(sessionId)}/import`
}

export function pingUrl(sessionId) {
  return `${sessionBase(sessionId)}/ping`
}

export function exportUrl(sessionId, jobId) {
  return jobId === undefined ? `${sessionBase(sessionId)}/export` : `${sessionBase(sessionId)}/export/${encodeURIComponent(jobId)}`
}

export function exportFileUrl(sessionId, jobId) {
  return `${exportUrl(sessionId, jobId)}/file`
}

export function playUrl(sessionId, mediaId) {
  return `${sessionBase(sessionId)}/media/${encodeURIComponent(mediaId)}`
}

export function posterUrl(sessionId, mediaId) {
  return `${sessionBase(sessionId)}/media/${encodeURIComponent(mediaId)}/poster.jpg`
}

/** Filmstrip frame URL for a source time. */
export function frameUrl(sessionId, mediaId, time) {
  const stamp = Math.max(0, Math.round((Number.isFinite(time) ? time : 0) * 1000) / 1000)
  return `${sessionBase(sessionId)}/media/${encodeURIComponent(mediaId)}/frame.jpg?t=${stamp}`
}

async function readJson(response) {
  try {
    return await response.json()
  } catch {
    return null
  }
}

async function requestJson(url, init) {
  let response
  try {
    response = await fetch(url, init)
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error || 'network error'), network: true }
  }
  const payload = await readJson(response)
  if (!response.ok) {
    const message = payload !== null && typeof payload === 'object' && payload.error !== undefined
      ? String(payload.error)
      : `HTTP ${response.status}`
    return { ok: false, error: message, status: response.status, payload }
  }
  if (payload === null || typeof payload !== 'object') {
    return { ok: false, error: '响应不是合法 JSON' }
  }
  if (payload.ok === false) {
    return { ok: false, error: String(payload.error === undefined ? '操作失败' : payload.error) }
  }
  return { ok: true, payload }
}

function jsonInit(body) {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }
}

function guardSession(sessionId) {
  return isSessionId(sessionId)
}

/** GET state. */
export async function getState(sessionId) {
  if (!guardSession(sessionId)) return { ok: false, error: 'invalid session id' }
  const result = await requestJson(stateUrl(sessionId), { method: 'GET' })
  if (!result.ok) return result
  const state = result.payload.state
  return state !== null && typeof state === 'object'
    ? { ok: true, state, payload: result.payload }
    : { ok: false, error: 'missing state' }
}

/** POST one operation; a successful result carries the new authoritative state. */
export async function postOp(sessionId, op) {
  if (!guardSession(sessionId)) return { ok: false, error: 'invalid session id' }
  const result = await requestJson(opUrl(sessionId), jsonInit({ op }))
  if (!result.ok) return result
  const state = result.payload.state
  return state !== null && typeof state === 'object'
    ? { ok: true, state, payload: result.payload }
    : { ok: false, error: 'missing state' }
}

/** POST raw upload bytes for one browser File. */
export async function uploadMedia(sessionId, file) {
  if (!guardSession(sessionId)) return { ok: false, error: 'invalid session id' }
  if (file === null || file === undefined) return { ok: false, error: 'no file' }
  const name = typeof file.name === 'string' && file.name !== '' ? file.name : 'upload.mp4'
  let response
  try {
    response = await fetch(mediaUploadUrl(sessionId), {
      method: 'POST',
      headers: {
        'content-type': typeof file.type === 'string' && file.type !== '' ? file.type : 'application/octet-stream',
        'x-file-name': encodeURIComponent(name),
      },
      body: file,
    })
  } catch (error) {
    return { ok: false, error: String((error && error.message) || error || 'network error'), network: true }
  }
  const payload = await readJson(response)
  if (!response.ok) {
    return { ok: false, error: String(payload && payload.error !== undefined ? payload.error : `HTTP ${response.status}`) }
  }
  if (payload === null || typeof payload !== 'object') return { ok: false, error: '响应不是合法 JSON' }
  if (payload.ok === false) return { ok: false, error: String(payload.error === undefined ? '上传失败' : payload.error) }
  return { ok: true, state: payload.state, media: payload.media, payload }
}

/** POST a host-path import batch. */
export async function importPaths(sessionId, paths) {
  if (!guardSession(sessionId)) return { ok: false, error: 'invalid session id' }
  const result = await requestJson(importUrl(sessionId), jsonInit({ paths }))
  if (!result.ok) return result
  return {
    ok: true,
    state: result.payload.state,
    imported: Array.isArray(result.payload.imported) ? result.payload.imported : [],
    skipped: Array.isArray(result.payload.skipped) ? result.payload.skipped : [],
  }
}

/** GET the ffmpeg / ffprobe availability report. */
export async function getPing(sessionId) {
  if (!guardSession(sessionId)) return { ok: false, error: 'invalid session id' }
  const result = await requestJson(pingUrl(sessionId), { method: 'GET' })
  if (!result.ok) return result
  return { ok: true, ping: result.payload }
}

/** Start one export job. */
export async function startExport(sessionId, request) {
  if (!guardSession(sessionId)) return { ok: false, error: 'invalid session id' }
  const result = await requestJson(exportUrl(sessionId), jsonInit(request === null || request === undefined ? {} : request))
  if (!result.ok) return result
  const payload = result.payload
  const job = payload.job !== null && typeof payload.job === 'object' ? payload.job : null
  const jobId = typeof payload.jobId === 'string' ? payload.jobId : (job !== null ? job.id : null)
  if (jobId === null) return { ok: false, error: '导出任务缺少 id' }
  return { ok: true, jobId, job, state: payload.state }
}

/** GET one export job. */
export async function getExportJob(sessionId, jobId) {
  if (!guardSession(sessionId) || typeof jobId !== 'string' || jobId === '') {
    return { ok: false, error: 'invalid export job' }
  }
  const result = await requestJson(exportUrl(sessionId, jobId), { method: 'GET' })
  if (!result.ok) return result
  const job = result.payload.job
  if (job === null || typeof job !== 'object') return { ok: false, error: 'missing job' }
  return { ok: true, job }
}

/** GET the export job list. */
export async function listExports(sessionId) {
  if (!guardSession(sessionId)) return { ok: false, error: 'invalid session id' }
  const result = await requestJson(exportUrl(sessionId), { method: 'GET' })
  if (!result.ok) return result
  return { ok: true, jobs: Array.isArray(result.payload.jobs) ? result.payload.jobs : [] }
}

/* -------------------------------------------------------------------------- */
/* Hooks                                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Project state with polling, shared by every workbench surface.
 *
 * The Host is authoritative: mutations only POST `/op` and adopt the returned
 * state. A poll carrying an unchanged revision is dropped so element identity
 * (and scroll) survives the refresh cycle.
 *
 * @param {string|undefined} sessionId - bound Session.
 * @returns {{state: object|null, error: string|null, busy: boolean, loading: boolean,
 *            op: Function, refresh: Function, setError: Function, clearError: Function}}
 */
export function useWorkbench(sessionId) {
  const [state, setState] = React.useState(null)
  const [error, setError] = React.useState(null)
  const [busy, setBusy] = React.useState(false)
  const [loading, setLoading] = React.useState(true)
  const stateRef = React.useRef(null)
  const revisionRef = React.useRef(-1)
  const busyRef = React.useRef(false)
  const aliveRef = React.useRef(true)

  const adopt = React.useCallback((next) => {
    if (next === null || typeof next !== 'object') return false
    const revision = Number.isFinite(next.revision) ? next.revision : 0
    if (revision === revisionRef.current) {
      stateRef.current = next
      return false
    }
    revisionRef.current = revision
    stateRef.current = next
    setState(next)
    return true
  }, [])

  const refresh = React.useCallback(async () => {
    const result = await getState(sessionId)
    if (!aliveRef.current) return result
    if (result.ok) {
      adopt(result.state)
      setError(null)
    } else {
      setError(result.error)
    }
    setLoading(false)
    return result
  }, [sessionId, adopt])

  React.useEffect(() => {
    aliveRef.current = true
    revisionRef.current = -1
    setLoading(true)
    void refresh()

    let timer = 0
    const canPoll = () => (typeof document === 'undefined' ? true : document.visibilityState === 'visible')
    const tick = () => {
      if (busyRef.current || !aliveRef.current || !canPoll()) return
      void getState(sessionId).then((result) => {
        if (!aliveRef.current) return
        if (result.ok) {
          adopt(result.state)
          setLoading(false)
        } else {
          setError(result.error)
        }
      })
    }
    timer = setInterval(tick, STATE_POLL_MS)
    const onVisibility = () => {
      if (canPoll()) tick()
    }
    if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
      document.addEventListener('visibilitychange', onVisibility)
    }
    return () => {
      aliveRef.current = false
      clearInterval(timer)
      if (typeof document !== 'undefined' && typeof document.removeEventListener === 'function') {
        document.removeEventListener('visibilitychange', onVisibility)
      }
    }
  }, [sessionId, refresh, adopt])

  const op = React.useCallback(async (payload) => {
    busyRef.current = true
    setBusy(true)
    try {
      const result = await postOp(sessionId, payload)
      if (!aliveRef.current) return result
      if (result.ok) {
        adopt(result.state)
        setError(null)
      } else {
        setError(result.error)
      }
      return result
    } finally {
      busyRef.current = false
      if (aliveRef.current) setBusy(false)
    }
  }, [sessionId, adopt])

  const clearError = React.useCallback(() => setError(null), [])

  return {
    state,
    error,
    busy,
    loading,
    op,
    refresh,
    /** Adopt an authoritative state returned by a non-`op` route (e.g. upload). */
    adoptState: adopt,
    setError,
    clearError,
    sessionId,
  }
}

/**
 * ffmpeg availability report, fetched once per Session.
 * @param {string|undefined} sessionId - bound Session.
 * @returns {{available:boolean}|null} trimmed ping payload, or null while unknown.
 */
export function usePing(sessionId) {
  const [ping, setPing] = React.useState(null)
  React.useEffect(() => {
    let alive = true
    void getPing(sessionId).then((result) => {
      if (!alive) return
      if (result.ok) {
        const payload = result.ping
        setPing({
          ffmpeg: payload !== null && typeof payload === 'object' && payload.ffmpeg !== null && typeof payload.ffmpeg === 'object'
            ? payload.ffmpeg
            : { available: false },
          ffprobe: payload !== null && typeof payload === 'object' && payload.ffprobe !== null && typeof payload.ffprobe === 'object'
            ? payload.ffprobe
            : { available: false },
        })
      } else {
        setPing({ ffmpeg: { available: false }, ffprobe: { available: false }, error: result.error })
      }
    })
    return () => {
      alive = false
    }
  }, [sessionId])
  return ping
}

/**
 * Shared 1.5 s state poller feeding the composer-dock status strip.
 *
 * One interval per Session, started by the first subscriber and cleared when
 * the last one leaves. The plugin's `ctx.effect` disposer calls `dispose()`, so
 * plugin unload can never leave a timer running.
 *
 * @returns {{subscribe: Function, dispose: Function}}
 */
export function createDockPoller() {
  const sessions = new Map()
  let disposed = false

  function stop(sessionId) {
    const entry = sessions.get(sessionId)
    if (entry === undefined) return
    sessions.delete(sessionId)
    if (entry.timer !== 0) clearInterval(entry.timer)
  }

  function publish(sessionId, snapshot) {
    const entry = sessions.get(sessionId)
    if (entry === undefined) return
    entry.snapshot = snapshot
    for (const listener of entry.listeners) {
      try {
        listener(snapshot)
      } catch {
        // a listener must never break the poller
      }
    }
  }

  function tick(sessionId) {
    const entry = sessions.get(sessionId)
    if (entry === undefined || entry.inFlight) return
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return
    entry.inFlight = true
    void getState(sessionId).then((result) => {
      const current = sessions.get(sessionId)
      if (current === undefined) return
      current.inFlight = false
      if (!result.ok) return
      const layout = result.state.timeline !== null && typeof result.state.timeline === 'object'
        ? result.state.timeline
        : null
      const duration = layout !== null && Number.isFinite(layout.duration) ? layout.duration : 0
      publish(sessionId, {
        count: Array.isArray(result.state.media) ? result.state.media.length : 0,
        duration,
        revision: result.state.revision,
      })
    }, () => {
      const current = sessions.get(sessionId)
      if (current !== undefined) current.inFlight = false
    })
  }

  return {
    subscribe(sessionId, listener) {
      if (disposed || !isSessionId(sessionId) || typeof listener !== 'function') return () => {}
      let entry = sessions.get(sessionId)
      if (entry === undefined) {
        entry = { listeners: new Set(), timer: 0, snapshot: null, inFlight: false }
        sessions.set(sessionId, entry)
      }
      entry.listeners.add(listener)
      if (entry.snapshot !== null) listener(entry.snapshot)
      if (entry.listeners.size === 1) {
        entry.timer = setInterval(() => tick(sessionId), DOCK_POLL_MS)
        tick(sessionId)
      }
      return () => {
        const current = sessions.get(sessionId)
        if (current === undefined) return
        current.listeners.delete(listener)
        if (current.listeners.size === 0) stop(sessionId)
      }
    },
    dispose() {
      disposed = true
      for (const sessionId of [...sessions.keys()]) stop(sessionId)
      sessions.clear()
    },
  }
}
