/**
 * Media library: ffprobe metadata, upload/import intake, derived JPEG caches
 * (posters and filmstrip frames), and Range-capable video streaming.
 *
 * Pure Node ESM, no dependencies. The bundled ffmpeg/ffprobe binaries are
 * passed in by the caller.
 *
 * Every ffmpeg/ffprobe invocation is bounded: it has a hard timeout, is killed
 * with its whole process tree on timeout/abort, and never leaves a half-written
 * cache file behind (writes go to a temp path and are renamed into place).
 */

import { execFile, spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const TOOL_TIMEOUT_MS = 30_000
const STREAM_CHUNK = 1024 * 1024
const MAX_BUFFER = 16 * 1024 * 1024

const POSTER_WIDTH = 320
const FRAME_WIDTH = 160
const JPEG_QUALITY = '4'

const VIDEO_EXTENSIONS = new Set([
  '.mp4', '.m4v', '.mov', '.webm', '.mkv', '.avi', '.mpg', '.mpeg', '.ts',
  '.m2ts', '.flv', '.wmv', '.ogv', '.3gp',
])

/**
 * Kill a process and its whole tree. ffmpeg spawns no children, but
 * `taskkill /t` guarantees nothing survives on Windows. Never throws.
 */
function killTree(child) {
  if (!child) return
  const pid = child.pid
  try {
    child.kill('SIGKILL')
  } catch {
    /* already gone */
  }
  if (process.platform === 'win32' && pid) {
    try {
      const killer = spawn('taskkill', ['/pid', String(pid), '/t', '/f'], {
        windowsHide: true,
        stdio: 'ignore',
      })
      killer.on('error', () => {})
      killer.unref?.()
    } catch {
      /* non-fatal */
    }
  }
}

/** Run one tool to completion with a hard timeout. Always resolves. */
function runProcess(bin, args, timeoutMs = TOOL_TIMEOUT_MS) {
  return new Promise((resolve) => {
    let timedOut = false
    let timer = null

    const child = execFile(
      bin,
      args,
      { windowsHide: true, encoding: 'utf8', maxBuffer: MAX_BUFFER },
      (error, stdout, stderr) => {
        if (timer) clearTimeout(timer)
        resolve({
          error: error || null,
          stdout: typeof stdout === 'string' ? stdout : String(stdout || ''),
          stderr: typeof stderr === 'string' ? stderr : String(stderr || ''),
          timedOut,
        })
      },
    )

    timer = setTimeout(() => {
      timedOut = true
      killTree(child)
      const retry = setTimeout(() => killTree(child), 2000)
      if (retry.unref) retry.unref()
    }, Math.max(1000, timeoutMs))
    if (timer.unref) timer.unref()
  })
}

function firstLines(text, maxLen) {
  const cleaned = String(text || '')
    .replace(/\u0000/g, '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const joined = cleaned.slice(0, 3).join(' — ')
  return joined.length > maxLen ? `${joined.slice(0, maxLen)}…` : joined
}

function isToolMissing(error) {
  return Boolean(error) && (error.code === 'ENOENT' || error.code === 'EACCES')
}

function fsReason(error, fallback) {
  if (!error) return fallback
  switch (error.code) {
    case 'ENOENT':
      return 'file not found'
    case 'EACCES':
    case 'EPERM':
      return 'permission denied'
    case 'EISDIR':
      return 'path is a directory'
    case 'ENOSPC':
      return 'not enough disk space'
    default:
      return firstLines(error.message, 140) || fallback
  }
}

/** Map raw ffprobe stderr onto an actionable reason. */
function describeToolStderr(stderr) {
  const text = String(stderr || '')
  const lower = text.toLowerCase()
  if (!text.trim()) return 'the tool reported a failure without detail'
  if (lower.includes('no such file')) return 'file not found'
  if (lower.includes('permission denied')) return 'permission denied'
  if (lower.includes('moov atom not found') || lower.includes('invalid data found'))
    return 'not a readable video file (corrupt or unsupported container)'
  if (lower.includes('could not find codec') || lower.includes('decoder not found'))
    return 'the file uses a codec ffmpeg cannot decode'
  if (lower.includes('end of file') || lower.includes('unexpected eof'))
    return 'the file is truncated or still being written'
  return firstLines(text, 160)
}

function parseRate(value) {
  if (typeof value === 'number') return Number.isFinite(value) && value > 0 ? value : 0
  const raw = String(value || '').trim()
  if (!raw) return 0
  const match = /^(\d+)\/(\d+)$/.exec(raw)
  if (match) {
    const num = Number(match[1])
    const den = Number(match[2])
    return den > 0 && num > 0 ? num / den : 0
  }
  const plain = Number(raw)
  return Number.isFinite(plain) && plain > 0 ? plain : 0
}

/** Quantize seconds onto a .1 s grid. */
function quantizeTenths(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return 0
  return Math.round(num * 10) / 10
}

/** Format a number for ffmpeg without exponential notation. */
function fmtSeconds(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return String(Math.round(num * 1e6) / 1e6)
}

function randomToken() {
  return Math.random().toString(36).slice(2, 10)
}

async function isNonEmptyFile(p) {
  return fsp
    .stat(p)
    .then((st) => st.isFile() && st.size > 0)
    .catch(() => false)
}

/** Deterministic safe file stem that keeps the extension. */
function safeUploadName(fileName) {
  const base = path.basename(String(fileName || '').replace(/\\/g, '/'))
  const withoutControls = base.replace(/[\u0000-\u001f]/g, '')
  const dot = withoutControls.lastIndexOf('.')
  const rawStem = dot > 0 ? withoutControls.slice(0, dot) : withoutControls
  const rawExt = dot > 0 ? withoutControls.slice(dot + 1) : ''

  let stem = rawStem
    .replace(/[^A-Za-z0-9._-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^[._-]+/, '')
    .replace(/[._-]+$/, '')
  if (!stem) stem = 'upload'
  if (stem.length > 80) stem = stem.slice(0, 80).replace(/[._-]+$/, '') || 'upload'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(stem)) stem = `file-${stem}`

  let ext = ''
  if (/^[A-Za-z0-9]{1,10}$/.test(rawExt)) ext = `.${rawExt.toLowerCase()}`
  return { stem, ext }
}

/** Safe directory token for cache paths (media ids come from the caller). */
function safeMediaId(mediaId) {
  const raw = String(mediaId ?? '').trim()
  if (!raw) throw new Error('a media id is required to build a cache path')
  if (/^[A-Za-z0-9._-]{1,120}$/.test(raw) && raw !== '.' && raw !== '..') return raw
  return `id-${createHash('sha1').update(raw).digest('hex').slice(0, 16)}`
}

const MIME_BY_EXT = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.3gp': 'video/3gpp',
}

/**
 * Parse a Range header against a known size.
 *  - null            -> ignore the header and serve the full 200 body
 *  - {start, end}    -> 206 partial content
 *  - {unsatisfiable} -> 416 Range Not Satisfiable
 *
 * Malformed or multi-range headers are ignored (RFC 9110 permits this), and an
 * inverted range (bytes=500-100) is treated as malformed rather than fatal.
 */
export function parseRangeHeader(header, size) {
  if (typeof header !== 'string') return null
  const raw = header.trim()
  if (!raw) return null
  const match = /^bytes=(\d*)-(\d*)$/i.exec(raw)
  if (!match) return null
  const startRaw = match[1]
  const endRaw = match[2]
  if (startRaw === '' && endRaw === '') return null
  if (size <= 0) return { unsatisfiable: true }

  if (startRaw === '') {
    const suffixLen = Number(endRaw)
    if (!Number.isInteger(suffixLen) || suffixLen <= 0) return null
    return { start: Math.max(0, size - suffixLen), end: size - 1 }
  }

  const start = Number(startRaw)
  if (!Number.isInteger(start) || start < 0) return null
  // A range that starts at or past EOF is unsatisfiable, open-ended or not.
  if (start >= size) return { unsatisfiable: true }
  let end = endRaw === '' ? size - 1 : Number(endRaw)
  if (!Number.isInteger(end) || end < 0) return null
  if (end < start) return null // inverted: ignore and serve 200
  if (end > size - 1) end = size - 1
  return { start, end }
}

export function createMediaLibrary(options = {}) {
  const dir = options.dir
  if (!dir || typeof dir !== 'string') throw new Error('createMediaLibrary: "dir" is required')
  const ffmpegPath = options.ffmpegPath
  const ffprobePath = options.ffprobePath
  if (!ffmpegPath || typeof ffmpegPath !== 'string')
    throw new Error('createMediaLibrary: "ffmpegPath" is required')
  if (!ffprobePath || typeof ffprobePath !== 'string')
    throw new Error('createMediaLibrary: "ffprobePath" is required')

  const rootDir = path.resolve(dir)
  const mediaDir = path.join(rootDir, 'media')
  const posterDir = path.join(rootDir, 'poster')
  const frameDir = path.join(rootDir, 'frame')

  // In-flight image extractions keyed by output path: two racing callers for the
  // same cached frame spawn at most one ffmpeg process and share its result.
  const inflight = new Map()

  // Probe memo keyed by path + size + mtime. Media files are immutable once
  // added, so this safely collapses redundant ffprobe runs (including racing
  // poster/frame requests for the same source).
  const probeMemo = new Map()
  const PROBE_MEMO_MAX = 128

  // Directory -> whether ffmpeg can write into it, plus a staging fallback.
  const writableCache = new Map()

  function memoizeProbe(key, factory) {
    const cached = probeMemo.get(key)
    if (cached) return cached
    const task = factory()
    probeMemo.set(key, task)
    if (probeMemo.size > PROBE_MEMO_MAX) {
      const oldest = probeMemo.keys().next()
      if (!oldest.done) probeMemo.delete(oldest.value)
    }
    task.catch(() => {
      if (probeMemo.get(key) === task) probeMemo.delete(key)
    })
    return task
  }

  function toolMissingError(bin, sourcePath) {
    return new Error(
      `Cannot read video file "${sourcePath}": video tool not found at "${bin}". ` +
        'Check that the bundled ffmpeg/ffprobe binaries exist.',
    )
  }

  // -- ffmpeg output staging -------------------------------------------------
  //
  // Some hosts confine ffmpeg so it cannot create files outside the workspace,
  // even when Node itself can. Writing straight into the cache directory then
  // fails with `Permission denied` / `I/O error`. We therefore probe writability
  // once per directory and, when it fails, encode into a staging directory that
  // ffmpeg *can* write and publish the finished file with Node (which is not
  // confined). The staging dir lives next to the bundled binary, inside the
  // package, and is removed after use.

  async function ffmpegCanWriteInto(directory) {
    const probeFile = path.join(directory, `.ffmpeg-write-probe-${process.pid}-${randomToken()}.jpg`)
    try {
      await fsp.mkdir(directory, { recursive: true })
    } catch {
      return false
    }
    const { error } = await runProcess(ffmpegPath, [
      '-y',
      '-hide_banner',
      '-nostdin',
      '-loglevel',
      'error',
      '-f',
      'lavfi',
      '-i',
      'color=black:s=32x32:d=1',
      '-frames:v',
      '1',
      '-f',
      'image2',
      probeFile,
    ])
    const ok = !error && (await isNonEmptyFile(probeFile))
    await fsp.unlink(probeFile).catch(() => {})
    return ok
  }

  function resolveOutputRoot(targetDir) {
    const key = path.resolve(targetDir)
    const cached = writableCache.get(key)
    if (cached) return cached
    const task = (async () => {
      if (await ffmpegCanWriteInto(key)) return { root: key, direct: true }
      const packageStaging = path.join(path.dirname(path.dirname(path.resolve(ffmpegPath))), '.host-tmp')
      if (await ffmpegCanWriteInto(packageStaging)) return { root: packageStaging, direct: false }
      const systemStaging = path.join(os.tmpdir(), 'video-editor-host-tmp')
      if (await ffmpegCanWriteInto(systemStaging)) return { root: systemStaging, direct: false }
      throw new Error(
        `Cannot write derived media into "${key}": ffmpeg has no write permission there. ` +
          'Pass a storage directory the bundled ffmpeg may write to.',
      )
    })()
    writableCache.set(key, task)
    task.catch(() => {
      if (writableCache.get(key) === task) writableCache.delete(key)
    })
    return task
  }

  /** Move a finished file into its final location atomically (Node-side). */
  async function publishFile(from, to) {
    await fsp.mkdir(path.dirname(to), { recursive: true })
    const tmp = `${to}.tmp`
    try {
      await fsp.copyFile(from, tmp)
      await fsp.rename(tmp, to)
    } catch (error) {
      await fsp.unlink(tmp).catch(() => {})
      throw new Error(`could not store the derived image (${fsReason(error, 'write failed')})`)
    } finally {
      await fsp.unlink(from).catch(() => {})
    }
  }

  // -- probe ---------------------------------------------------------------

  async function probe(sourcePath) {
    const abs = path.resolve(String(sourcePath ?? ''))
    if (!sourcePath) throw new Error('Cannot read video file "": a path is required')

    const ext = path.extname(abs).toLowerCase()
    if (ext && !VIDEO_EXTENSIONS.has(ext)) {
      throw new Error(
        `Cannot read video file "${abs}": unsupported video format "${ext}" ` +
          `(supported: ${[...VIDEO_EXTENSIONS].join(' ')})`,
      )
    }

    let stat
    try {
      stat = await fsp.stat(abs)
    } catch (error) {
      throw new Error(`Cannot read video file "${abs}": ${fsReason(error, 'cannot be read')}`)
    }
    if (stat.isDirectory()) throw new Error(`Cannot read video file "${abs}": path is a directory`)
    if (!stat.isFile()) throw new Error(`Cannot read video file "${abs}": path is not a file`)
    if (stat.size === 0) throw new Error(`Cannot read video file "${abs}": file is empty`)

    return memoizeProbe(`${abs}\u0000${stat.size}\u0000${stat.mtimeMs}`, () =>
      probeFile(abs, stat),
    )
  }

  async function probeFile(abs, stat) {
    const { error, stdout, stderr, timedOut } = await runProcess(
      ffprobePath,
      ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', abs],
    )

    if (timedOut)
      throw new Error(
        `Cannot read video file "${abs}": ffprobe timed out after ${TOOL_TIMEOUT_MS / 1000}s`,
      )
    if (isToolMissing(error)) throw toolMissingError(ffprobePath, abs)
    if (error)
      throw new Error(`Cannot read video file "${abs}": ${describeToolStderr(stderr)}`)

    let info
    try {
      info = JSON.parse(stdout)
    } catch {
      throw new Error(
        `Cannot read video file "${abs}": ffprobe returned unreadable metadata ` +
          '(the file may not be a video)',
      )
    }

    const streams = Array.isArray(info.streams) ? info.streams : []
    // Cover art is not a video stream; ignore attached pictures.
    const video = streams.find(
      (stream) => stream.codec_type === 'video' && (stream.disposition?.attached_pic ?? 0) === 0,
    )
    if (!video)
      throw new Error(
        `Cannot read video file "${abs}": no video stream found ` +
          '(audio-only files cannot be used as video clips)',
      )

    const duration = Number(info.format?.duration ?? video.duration)
    if (!Number.isFinite(duration) || duration <= 0)
      throw new Error(`Cannot read video file "${abs}": duration could not be determined`)

    const width = Number(video.width)
    const height = Number(video.height)
    if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0)
      throw new Error(`Cannot read video file "${abs}": video dimensions could not be determined`)

    const fps = parseRate(video.avg_frame_rate) || parseRate(video.r_frame_rate)
    const size = Number(info.format?.size) || stat.size
    const codec = typeof video.codec_name === 'string' && video.codec_name ? video.codec_name : 'unknown'

    return {
      duration,
      width,
      height,
      fps,
      hasAudio: streams.some((stream) => stream.codec_type === 'audio'),
      size,
      codec,
    }
  }

  // -- intake --------------------------------------------------------------

  async function saveUpload(fileName, bytes) {
    const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes ?? '')
    if (buf.length === 0) throw new Error(`Upload "${fileName || 'unnamed'}" is empty`)
    await fsp.mkdir(mediaDir, { recursive: true })

    const { stem, ext } = safeUploadName(fileName)
    for (let index = 0; index < 1000; index += 1) {
      const candidate = path.join(mediaDir, `${stem}${index === 0 ? '' : `-${index}`}${ext}`)
      try {
        await fsp.writeFile(candidate, buf, { flag: 'wx' })
        return candidate
      } catch (error) {
        if (error.code === 'EEXIST') continue
        throw new Error(`Could not save upload "${fileName}": ${fsReason(error, 'write failed')}`)
      }
    }
    throw new Error(`Could not save upload "${fileName}": too many files with the same name`)
  }

  async function importFromPath(sourcePath) {
    if (!sourcePath) throw new Error('Cannot import video: a path is required')
    const abs = path.resolve(String(sourcePath))
    // External files are referenced in place; a successful probe is the check.
    await probe(abs)
    return abs
  }

  // -- derived images ------------------------------------------------------

  async function extractJpeg(sourcePath, outPath, atSeconds, width, kind) {
    if (await isNonEmptyFile(outPath)) return outPath

    const running = inflight.get(outPath)
    if (running) return running

    const abs = path.resolve(String(sourcePath))
    const label = kind === 'poster' ? 'poster' : `frame at ${fmtSeconds(atSeconds)}s`

    const task = (async () => {
      const outputRoot = await resolveOutputRoot(path.dirname(outPath))
      const encodePath = outputRoot.direct
        ? `${outPath}.tmp`
        : path.join(outputRoot.root, `.${randomToken()}${path.extname(outPath) || '.jpg'}`)
      try {
        const { error, stderr, timedOut } = await runProcess(ffmpegPath, [
          '-y',
          '-hide_banner',
          '-nostdin',
          '-loglevel',
          'error',
          '-ss',
          fmtSeconds(atSeconds),
          '-i',
          abs,
          '-frames:v',
          '1',
          '-an',
          '-vf',
          `scale=${width}:-2`,
          '-q:v',
          JPEG_QUALITY,
          '-f',
          'image2',
          encodePath,
        ])
        if (timedOut)
          throw new Error(
            `Could not generate ${label} for "${abs}": ffmpeg timed out after ${TOOL_TIMEOUT_MS / 1000}s`,
          )
        if (isToolMissing(error))
          throw new Error(
            `Could not generate ${label} for "${abs}": ffmpeg not found at "${ffmpegPath}"`,
          )
        if (error) {
          throw new Error(`Could not generate ${label} for "${abs}": ${describeToolStderr(stderr)}`)
        }
        if (!(await isNonEmptyFile(encodePath))) {
          throw new Error(
            `Could not generate ${label} for "${abs}": ffmpeg produced no image ` +
              '(the requested time may be past the end of the video)',
          )
        }
        if (outputRoot.direct) {
          await fsp.rename(encodePath, outPath).catch(async (renameError) => {
            // Another writer may have won the race; keep the existing file.
            if (await isNonEmptyFile(outPath)) {
              await fsp.unlink(encodePath).catch(() => {})
              return
            }
            throw new Error(`Could not store the ${label} (${renameError.code || 'rename failed'})`)
          })
        } else {
          await publishFile(encodePath, outPath)
        }
        return outPath
      } catch (error) {
        await fsp.unlink(encodePath).catch(() => {})
        throw error
      }
    })()

    inflight.set(outPath, task)
    try {
      return await task
    } finally {
      inflight.delete(outPath)
    }
  }

  async function poster(sourcePath, mediaId) {
    const id = safeMediaId(mediaId)
    const outPath = path.join(posterDir, `${id}.jpg`)
    if (await isNonEmptyFile(outPath)) return outPath

    const info = await probe(sourcePath)
    // 10% of the duration, at least 0.1 s, and never past the last frame.
    const at = Math.max(0.1, Number(info.duration) * 0.1)
    const time = Math.min(at, Math.max(0.1, Number(info.duration) - 0.05))
    return extractJpeg(sourcePath, outPath, time, POSTER_WIDTH, 'poster')
  }

  async function frame(sourcePath, mediaId, t) {
    const id = safeMediaId(mediaId)

    // Fast cache lookup on the unclamped 0.1 s grid: a time outside the video
    // can never have been cached under this name, so we only need a probe when
    // the requested bucket is actually inside the duration.
    const requested = quantizeTenths(Math.max(0, Number(t) || 0))
    const candidatePath = path.join(frameDir, id, `${Math.round(requested * 1000)}.jpg`)
    if (await isNonEmptyFile(candidatePath)) return candidatePath

    const info = await probe(sourcePath)
    const clamped = Math.min(requested, Math.max(0, Number(info.duration) - 0.05))
    const bucket = quantizeTenths(Math.max(0, clamped))
    const outPath = path.join(frameDir, id, `${Math.round(bucket * 1000)}.jpg`)
    return extractJpeg(sourcePath, outPath, bucket, FRAME_WIDTH, 'frame')
  }

  // -- HTTP streaming ------------------------------------------------------

  function writeHead(res, status, headers) {
    if (typeof res.writeHead === 'function') res.writeHead(status, headers)
    else {
      res.statusCode = status
      if (typeof res.setHeader === 'function') {
        for (const [name, value] of Object.entries(headers)) res.setHeader(name, value)
      }
    }
  }

  function respond(res, status, headers, body) {
    writeHead(res, status, headers)
    res.end(body)
  }

  function streamVideo(req, res, sourcePath, contentType) {
    const abs = path.resolve(String(sourcePath ?? ''))
    let stat
    try {
      stat = fs.statSync(abs)
    } catch {
      respond(res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Media file not found')
      return
    }
    if (!stat.isFile()) {
      respond(res, 404, { 'content-type': 'text/plain; charset=utf-8' }, 'Media file not found')
      return
    }

    const size = stat.size
    const ext = path.extname(abs).toLowerCase()
    const type = contentType || MIME_BY_EXT[ext] || 'application/octet-stream'
    const baseHeaders = {
      'content-type': type,
      'accept-ranges': 'bytes',
      'cache-control': 'no-cache',
    }
    const isHead = String(req?.method || 'GET').toUpperCase() === 'HEAD'

    if (isHead) {
      writeHead(res, 200, { ...baseHeaders, 'content-length': String(size) })
      res.end()
      return
    }

    const rangeHeader = req?.headers?.range ?? req?.headers?.Range
    const range = parseRangeHeader(rangeHeader, size)

    if (range && range.unsatisfiable) {
      writeHead(res, 416, {
        ...baseHeaders,
        'content-range': `bytes */${size}`,
        'content-length': '0',
      })
      res.end()
      return
    }

    const start = range ? range.start : 0
    const end = range ? range.end : size - 1
    const length = size > 0 ? end - start + 1 : 0
    const headers = { ...baseHeaders, 'content-length': String(length) }
    if (range) headers['content-range'] = `bytes ${start}-${end}/${size}`

    // Headers only: the body arrives from the read stream piped below, so this
    // must not end the response.
    writeHead(res, range ? 206 : 200, headers)

    if (length <= 0) {
      res.end()
      return
    }

    const stream = fs.createReadStream(abs, { start, end, highWaterMark: STREAM_CHUNK })
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      stream.destroy()
    }
    stream.on('error', (error) => {
      finished = true
      if (typeof res.destroy === 'function') res.destroy(error)
    })
    stream.pipe(res)
    if (typeof res.on === 'function') res.on('close', finish)
    if (typeof req.on === 'function') req.on('aborted', finish)
  }

  function sendVideo(req, res, sourcePath, contentType) {
    try {
      streamVideo(req, res, sourcePath, contentType)
    } catch (error) {
      try {
        if (!res.headersSent) {
          respond(res, 500, { 'content-type': 'text/plain; charset=utf-8' }, 'Failed to stream media')
        } else if (typeof res.destroy === 'function') {
          res.destroy(error)
        }
      } catch {
        /* the response object is already unusable */
      }
    }
  }

  return { probe, saveUpload, importFromPath, poster, frame, sendVideo, parseRangeHeader }
}
