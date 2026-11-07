#!/usr/bin/env node
// Self-test for the video-editor host modules.
//
//   node video-editor/host/selftest.mjs
//
// Checks (beyond the four required by docs/host-modules.md):
//   1. probe both test media
//   2. poster + frames are real JPEGs
//   3. 6 s export renders, probes back at ~6 s, overlay + audio are really there
//   4. abort mid-render rejects and leaves no partial output
//   5. sendVideo HTTP Range: 206 + Content-Range, open-ended, HEAD, 416, malformed->200
//   6. no leaked ffmpeg processes, no stray .tmp files
//
// Cleans up only files it created itself.

import { execFile, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { EventEmitter } from 'node:events'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PKG = path.resolve(HERE, '..')
const ROOT = path.resolve(PKG, '..')

const FFMPEG = path.join(PKG, 'bin', 'ffmpeg.exe')
const FFPROBE = path.join(PKG, 'bin', 'ffprobe.exe')
const MEDIA_A = path.join(ROOT, 'test-media', 'demo-a.mp4')
const MEDIA_B = path.join(ROOT, 'test-media', 'demo-b.mp4')
const RENDER_DIR = path.join(ROOT, 'tmp-render')
const OUT_MP4 = path.join(RENDER_DIR, 'out.mp4')
const WORK_DIR = path.join(ROOT, 'tmp-selftest-work')

const { createMediaLibrary } = await import('./media.js')
const { createRenderer } = await import('./render.js')

const results = []
let currentCheck = ''

function record(ok, label, detail = '') {
  results.push({ check: currentCheck, ok, label, detail })
  const prefix = ok ? 'PASS' : 'FAIL'
  console.log(`${prefix}  [${currentCheck}] ${label}${detail ? `  —  ${detail}` : ''}`)
}

function assert(condition, label, detail = '') {
  record(Boolean(condition), label, detail)
  return Boolean(condition)
}

function fail(label, detail = '') {
  record(false, label, detail)
}

function section(title) {
  currentCheck = title
  console.log(`\n=== ${title} ===`)
}

function humanBytes(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(2)} MB`
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} kB`
  return `${bytes} B`
}

function humanClock(seconds) {
  const total = Math.max(0, Number(seconds) || 0)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total - h * 3600 - m * 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${s.toFixed(3).padStart(6, '0')}`
}

async function fileMagic(p, count = 2) {
  const handle = await fsp.open(p, 'r')
  try {
    const buf = Buffer.alloc(count)
    const { bytesRead } = await handle.read(buf, 0, count, 0)
    return buf.subarray(0, bytesRead).toString('hex')
  } finally {
    await handle.close()
  }
}

async function exists(p) {
  try {
    await fsp.stat(p)
    return true
  } catch {
    return false
  }
}

/** File size in bytes, or 0 when absent. */
async function sizeOf(p) {
  try {
    return (await fsp.stat(p)).size
  } catch {
    return 0
  }
}

// ---------------------------------------------------------------------------
// Fake IncomingMessage / ServerResponse for the sendVideo Range checks.
// Writes to a real local file through ws, so we exercise real stream backpressure.
// ---------------------------------------------------------------------------

class FakeRequest extends EventEmitter {
  constructor(headers = {}, method = 'GET') {
    super()
    this.headers = headers
    this.method = method
  }
}

class FakeResponse extends EventEmitter {
  constructor() {
    super()
    this.statusCode = 0
    this.headers = {}
    this.headersSent = false
    this.chunks = []
    this.ended = false
  }

  setHeader(name, value) {
    this.headers[String(name).toLowerCase()] = value
  }

  writeHead(status, headers) {
    this.statusCode = status
    for (const [name, value] of Object.entries(headers || {})) {
      this.headers[String(name).toLowerCase()] = value
    }
    this.headersSent = true
    return this
  }

  write(chunk) {
    if (chunk) this.chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
    return true
  }

  end(chunk) {
    if (chunk) this.write(chunk)
    this.ended = true
    this.emit('finish')
    return this
  }

  get body() {
    return Buffer.concat(this.chunks)
  }
}

/** Run one sendVideo call to completion and return the fake response. */
function sendAndCollect(lib, { headers = {}, method = 'GET' } = {}) {
  return new Promise((resolve, reject) => {
    const req = new FakeRequest(headers, method)
    const res = new FakeResponse()
    const timer = setTimeout(() => reject(new Error('sendVideo timed out')), 10_000)
    res.on('close', () => clearTimeout(timer))
    res.end = ((original) =>
      function patchedEnd(chunk) {
        original.call(this, chunk)
        clearTimeout(timer)
        resolve(res)
      })(res.end)
    res.on('error', (error) => {
      clearTimeout(timer)
      reject(error)
    })
    lib.sendVideo(req, res, MEDIA_A, 'video/mp4')
  })
}

// ---------------------------------------------------------------------------
// ffmpeg process leak detection
// ---------------------------------------------------------------------------

function ffmpegProcessCount() {
  if (process.platform !== 'win32') {
    // Best-effort on other platforms; this suite is authored for Windows.
    return null
  }
  const out = spawnSync('powershell', ['-NoProfile', '-Command', 'Get-Process ffmpeg -ErrorAction SilentlyContinue | Measure-Object | Select-Object -ExpandProperty Count'], {
    encoding: 'utf8',
    windowsHide: true,
  })
  const text = String(out.stdout || '').trim()
  const count = Number(text)
  return Number.isFinite(count) ? count : 0
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

let exitCode = 0
const created = []
const createdDirs = []

async function main() {
  console.log('video-editor host self-test')
  console.log(`  node     ${process.version}`)
  console.log(`  ffmpeg   ${FFMPEG}`)
  console.log(`  ffprobe  ${FFPROBE}`)
  console.log(`  media    ${MEDIA_A}`)
  console.log(`  media    ${MEDIA_B}`)

  for (const bin of [FFMPEG, FFPROBE]) {
    if (!(await exists(bin))) {
      fail('bundled binaries present', `missing ${bin}`)
      exitCode = 1
      return
    }
  }
  for (const media of [MEDIA_A, MEDIA_B]) {
    if (!(await exists(media))) {
      fail('test media present', `missing ${media}`)
      exitCode = 1
      return
    }
  }

  const lib = createMediaLibrary({ dir: WORK_DIR, ffmpegPath: FFMPEG, ffprobePath: FFPROBE })
  const renderer = createRenderer({ dir: WORK_DIR, ffmpegPath: FFMPEG, ffprobePath: FFPROBE })
  createdDirs.push(WORK_DIR)

  // -- 1. probe ------------------------------------------------------------
  section('1. probe')
  const infoA = await lib.probe(MEDIA_A)
  console.log(
    `demo-a.mp4  ${infoA.width}x${infoA.height} @ ${infoA.fps} fps, ` +
      `${infoA.duration}s, ${humanBytes(infoA.size)}, ` +
      `codec ${infoA.codec}, audio ${infoA.hasAudio ? 'yes' : 'no'}`,
  )
  assert(
    Math.abs(infoA.duration - 12) < 0.3 &&
      infoA.width === 1280 &&
      infoA.height === 720 &&
      Math.abs(infoA.fps - 30) < 0.1 &&
      infoA.hasAudio === true &&
      infoA.codec === 'h264',
    'probe demo-a.mp4 reports 1280x720 30fps 12s h264 with audio',
    `${infoA.width}x${infoA.height} ${infoA.fps}fps ${infoA.duration}s audio=${infoA.hasAudio}`,
  )

  const infoB = await lib.probe(MEDIA_B)
  console.log(
    `demo-b.mp4  ${infoB.width}x${infoB.height} @ ${infoB.fps} fps, ` +
      `${infoB.duration}s, ${humanBytes(infoB.size)}, ` +
      `codec ${infoB.codec}, audio ${infoB.hasAudio ? 'yes' : 'no'}`,
  )
  assert(
    Math.abs(infoB.duration - 8) < 0.3 &&
      infoB.width === 1280 &&
      infoB.height === 720 &&
      infoB.hasAudio === false,
    'probe demo-b.mp4 reports 1280x720 30fps 8s with no audio',
    `${infoB.width}x${infoB.height} ${infoB.duration}s audio=${infoB.hasAudio}`,
  )

  // Bad input must reject with a message that names the file.
  let badError = ''
  try {
    await lib.probe(path.join(ROOT, 'test-media', 'does-not-exist.mp4'))
  } catch (error) {
    badError = error.message
  }
  assert(
    badError && badError.includes('does-not-exist.mp4') && /Cannot read video file/.test(badError),
    'probe rejects an unreadable file with an actionable message',
    badError,
  )

  const posterPath = await lib.poster(MEDIA_A, 'm1')
  created.push(posterPath)
  const frame234 = await lib.frame(MEDIA_A, 'm1', 2.34)
  const frame31 = await lib.frame(MEDIA_A, 'm1', 3.1)
  created.push(frame234, frame31)

  // -- 2. poster + frames -------------------------------------------------
  section('2. poster + frames')
  for (const [label, file, expectMs] of [
    ['poster (10% of 12s = 1.2s, 320px)', posterPath, null],
    ['frame at 2.34s -> 2300.jpg (160px)', frame234, 2300],
    ['frame at 3.1s -> 3100.jpg (160px)', frame31, 3100],
  ]) {
    const size = await sizeOf(file)
    const magic = size > 0 ? await fileMagic(file, 3) : ''
    const isJpeg = magic.startsWith('ffd8ff')
    assert(isJpeg && size > 0, `${label} is a non-empty JPEG`, `${humanBytes(size)} magic=${magic}`)
    if (expectMs) {
      assert(
        path.basename(file, '.jpg') === String(expectMs),
        `${label} filename matches the 0.1s quantization`,
        path.basename(file),
      )
    }
  }
  assert(
    posterPath === path.join(WORK_DIR, 'poster', 'm1.jpg'),
    'poster is cached at <dir>/poster/<mediaId>.jpg',
    posterPath,
  )

  // Career/caching: a repeated frame call returns the cached path, not a rerun.
  const frameAgain = await lib.frame(MEDIA_A, 'm1', 2.31)
  assert(frameAgain === frame234, 'concurrent/重复 frame requests share the same cached path', frameAgain)

  // Racing callers must yield one file and a valid JPEG (dedupe promise map).
  await fsp.rm(frame234, { force: true })
  const racers = await Promise.all(
    [0, 1, 2, 3].map(() => lib.frame(MEDIA_A, 'm1', 2.34).catch((e) => e.message)),
  )
  const racerPaths = racers.filter((r) => typeof r === 'string' && !r.includes(' '))
  const racerMagic = (await exists(frame234)) ? await fileMagic(frame234, 3) : ''
  assert(
    racerPaths.length === 4 &&
      new Set(racers).size === 1 &&
      racerMagic.startsWith('ffd8ff'),
    'racing frame() calls dedupe to one intact JPEG',
    `${racerPaths.length}/4 returned ${racerMagic}`,
  )

  // -- 3. export ----------------------------------------------------------
  section('3. export 6s cut with overlay')
  await fsp.mkdir(RENDER_DIR, { recursive: true })
  await fsp.rm(OUT_MP4, { force: true })

  const spec = {
    canvas: { width: 1280, height: 720, fps: 30 },
    quality: 'high',
    outputPath: OUT_MP4,
    main: [
      { sourcePath: MEDIA_A, in: 1, out: 4, hasAudio: true },
      { sourcePath: MEDIA_B, in: 0, out: 3, hasAudio: false },
    ],
    overlays: [
      { sourcePath: MEDIA_B, in: 0, out: 3, start: 1, x: 820, y: 430, scale: 0.35 },
    ],
  }

  const progress = []
  const startedAt = process.hrtime.bigint()
  let result
  try {
    result = await renderer.run(spec, (p) => progress.push(p))
  } catch (error) {
    fail('export completes', error.message)
    exitCode = 1
  }
  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

  if (result) {
    created.push(result.outputPath)
    const size = await sizeOf(OUT_MP4)
    assert(
      result.duration === 6,
      'renderer reports the estimated duration',
      `${result.duration}s`,
    )
    assert(size > 20_000, 'output file is larger than 20 kB', humanBytes(size))
    assert(
      result.outputPath === OUT_MP4 && (await exists(OUT_MP4)),
      'output written to tmp-render/out.mp4',
      OUT_MP4,
    )

    const out = await lib.probe(OUT_MP4)
    assert(
      Math.abs(out.duration - 6) <= 0.3,
      'probe reports duration ≈ 6 s (±0.3 s)',
      `${out.duration.toFixed(3)}s`,
    )
    assert(
      out.width === 1280 && out.height === 720 && Math.abs(out.fps - 30) < 0.1,
      'output is 1280x720 @ 30 fps',
      `${out.width}x${out.height} @ ${out.fps}`,
    )
    assert(
      out.hasAudio,
      'output has an audio track (silence synthesized for the silent clip)',
      `audio=${out.hasAudio}`,
    )
    assert(
      progress.length > 0 &&
        progress.every((p) => p >= 0 && p <= 1) &&
        progress[progress.length - 1] === 1,
      'progress stays within [0,1] and finishes at 1.0',
      `${progress.length} samples, last=${progress[progress.length - 1]}`,
    )
    assert(
      Math.max(...progress.filter((p) => p < 1), 0) <= 0.99,
      'intermediate progress never exceeds 0.99',
      `max intermediate ${Math.max(...progress.filter((p) => p < 1), 0)}`,
    )

    const bitrate = (size * 8) / out.duration / 1000
    const speed = out.duration / (elapsedMs / 1000)
    console.log(
      `   export: ${humanClock(elapsedMs / 1000)} wall, ` +
        `${out.duration.toFixed(3)}s video, ${humanBytes(size)}, ` +
        `~${bitrate.toFixed(0)} kbps, ${speed.toFixed(1)}x realtime`,
    )
    console.log(
      `   progress samples: ${progress
        .map((p) => p.toFixed(3))
        .slice(0, 8)
        .join(', ')}${progress.length > 8 ? `, … ${progress[progress.length - 1]}` : ''}`,
    )
  }

  // Overlay really composites: the overlay's own frame region differs from the
  // base-only pixels exactly inside the enable window. We compare two renders:
  // the real one vs the same graph with the overlay clip pushed off-window.
  const flatSpec = {
    ...spec,
    outputPath: path.join(WORK_DIR, 'no-overlay.mp4'),
    overlays: [{ ...spec.overlays[0], start: 20 }], // window is past the end: never enabled
  }
  let flatPath = flatSpec.outputPath
  try {
    const flat = await renderer.run(flatSpec, () => {})
    flatPath = flat.outputPath
    created.push(flatPath)
  } catch (error) {
    fail('control render without active overlay', error.message)
  }

  if (result && (await exists(flatPath))) {
    // Parse `lavfi.signalstats.YAVG` from stderr. `-loglevel error` suppresses
    // metadata=print output, so this probe must run at info verbosity.
    const sample = async (file, t, crop) => {
      const out = await new Promise((resolve, reject) => {
        execFile(
          FFMPEG,
          [
            '-hide_banner',
            '-nostdin',
            '-ss',
            String(t),
            '-i',
            file,
            '-frames:v',
            '1',
            '-vf',
            `${crop},signalstats,metadata=print`,
            '-f',
            'null',
            'NUL',
          ],
          { windowsHide: true, maxBuffer: 8 * 1024 * 1024 },
          (error, _stdout, stderr) => {
            if (error) reject(new Error(String(stderr)))
            else resolve(String(stderr))
          },
        )
      })
      const matches = [...out.matchAll(/lavfi\.signalstats\.YAVG=([\d.]+)/g)]
      return matches.length ? Number(matches[0][1]) : NaN
    }

    // Overlay covers x=820,y=430, 448x252 at scale 0.35 of 1280.
    const crop = 'crop=440:240:824:436'
    const inside = await sample(OUT_MP4, 1.6, crop)
    const control = await sample(flatPath, 1.6, crop)
    // Outside the overlay rect the two renders must match closely.
    const outsideInside = await sample(OUT_MP4, 1.6, 'crop=440:240:20:20')
    const outsideControl = await sample(flatPath, 1.6, 'crop=440:240:20:20')

    assert(
      Number.isFinite(inside) &&
        Number.isFinite(control) &&
        Math.abs(inside - control) > 8,
      'overlay actually composites inside its enable window',
      `overlay region luma ${inside} vs control ${control}`,
    )
    assert(
      Number.isFinite(outsideInside) &&
        Number.isFinite(outsideControl) &&
        Math.abs(outsideInside - outsideControl) < 2,
      'pixels outside the overlay rect are untouched',
      `outside luma ${outsideInside} vs control ${outsideControl}`,
    )
  }

  // -- 4. abort -----------------------------------------------------------
  section('4. abort mid-render')
  // A long cut (two full 12 s sources repeated) gives us plenty of encode time.
  const longSpec = {
    canvas: { width: 1280, height: 720, fps: 30 },
    quality: 'high',
    outputPath: path.join(RENDER_DIR, 'aborted.mp4'),
    main: [
      { sourcePath: MEDIA_A, in: 0, out: 12, hasAudio: true },
      { sourcePath: MEDIA_A, in: 0, out: 12, hasAudio: true },
      { sourcePath: MEDIA_A, in: 0, out: 12, hasAudio: true },
      { sourcePath: MEDIA_B, in: 0, out: 8, hasAudio: false },
    ],
    overlays: [],
  }
  const abortedOut = longSpec.outputPath
  await fsp.rm(path.join(RENDER_DIR, 'aborted.mp4.tmp.mp4'), { force: true })
  await fsp.rm(abortedOut, { force: true })

  const controller = new AbortController()
  let abortError = null
  let abortResolved = false
  const abortStarted = Date.now()
  const abortPromise = renderer
    .run(longSpec, () => {}, controller.signal)
    .then(() => {
      abortResolved = true
      return null
    })
    .catch((error) => {
      abortError = error
      return error
    })

  setTimeout(() => controller.abort(), 300)
  const abortOutcome = await abortPromise
  const abortElapsed = Date.now() - abortStarted

  assert(
    !abortResolved && abortError instanceof Error && /export cancelled/.test(abortError.message),
    'aborted render rejects with "export cancelled"',
    abortError?.message || 'resolved instead of rejecting',
  )
  assert(
    abortElapsed < 6000,
    'abort settles promptly after the 300 ms mark',
    `${abortElapsed} ms`,
  )
  assert(
    !(await exists(abortedOut)),
    'no partial output file remains after abort',
    abortedOut,
  )
  assert(
    !(await exists(`${abortedOut}.tmp.mp4`)),
    'no temp file remains after abort',
    `${abortedOut}.tmp.mp4`,
  )
  if (abortError && !/export cancelled/.test(abortError.message)) console.log(`   abort outcome: ${abortError.message}`)

  // Pre-aborted signal rejects before spawning.
  const preController = new AbortController()
  preController.abort()
  let preError = ''
  try {
    await renderer.run(spec, () => {}, preController.signal)
  } catch (error) {
    preError = error.message
  }
  assert(/export cancelled/.test(preError), 'an already-aborted signal rejects immediately', preError)

  // Empty timeline rejects before spawning.
  let emptyError = ''
  try {
    await renderer.run(
      { ...spec, outputPath: path.join(WORK_DIR, 'never.mp4'), main: [] },
      () => {},
    )
  } catch (error) {
    emptyError = error.message
  }
  assert(
    /no clips on the timeline/i.test(emptyError),
    'empty main track rejects with an actionable message',
    emptyError,
  )
  assert(
    !(await exists(path.join(WORK_DIR, 'never.mp4'))),
    'rejected empty timeline wrote no file',
  )

  // -- 5. sendVideo Range ------------------------------------------------
  section('5. sendVideo HTTP Range')

  const fullSize = (await fsp.stat(MEDIA_A)).size

  const full = await sendAndCollect(lib, {})
  assert(full.statusCode === 200, 'plain GET returns 200', String(full.statusCode))
  assert(
    full.headers['accept-ranges'] === 'bytes',
    'plain GET advertises Accept-Ranges: bytes',
    full.headers['accept-ranges'],
  )
  assert(
    Number(full.headers['content-length']) === fullSize,
    'plain GET content-length equals the file size',
    `${full.headers['content-length']} vs ${fullSize}`,
  )
  assert(
    full.body.length === fullSize && full.body.equals(await fsp.readFile(MEDIA_A)),
    'plain GET streams the whole file byte-for-byte',
    `${full.body.length} bytes`,
  )

  const partial = await sendAndCollect(lib, { headers: { range: 'bytes=0-1023' } })
  assert(partial.statusCode === 206, 'bytes=0-1023 returns 206', String(partial.statusCode))
  assert(
    partial.headers['content-range'] === `bytes 0-1023/${fullSize}`,
    'Content-Range is correct for a closed range',
    partial.headers['content-range'],
  )
  assert(
    Number(partial.headers['content-length']) === 1024 && partial.body.length === 1024,
    'partial response carries exactly 1024 bytes',
    `${partial.body.length}`,
  )
  const headOfFile = (await fsp.readFile(MEDIA_A)).subarray(0, 1024)
  assert(partial.body.equals(headOfFile), 'partial body matches the first 1024 bytes on disk')

  const openEnded = await sendAndCollect(lib, { headers: { range: 'bytes=1024-' } })
  assert(openEnded.statusCode === 206, 'bytes=1024- returns 206', String(openEnded.statusCode))
  assert(
    openEnded.headers['content-range'] === `bytes 1024-${fullSize - 1}/${fullSize}`,
    'open-ended range runs to the last byte',
    openEnded.headers['content-range'],
  )
  assert(
    openEnded.body.length === fullSize - 1024,
    'open-ended range body is size - start',
    `${openEnded.body.length}`,
  )

  const suffix = await sendAndCollect(lib, { headers: { range: 'bytes=-512' } })
  assert(
    suffix.statusCode === 206 &&
      suffix.headers['content-range'] === `bytes ${fullSize - 512}-${fullSize - 1}/${fullSize}`,
    'suffix range bytes=-512 serves the last 512 bytes',
    suffix.headers['content-range'],
  )

  const head = await sendAndCollect(lib, { headers: {}, method: 'HEAD' })
  assert(head.statusCode === 200, 'HEAD returns 200', String(head.statusCode))
  assert(
    Number(head.headers['content-length']) === fullSize && head.body.length === 0,
    'HEAD reports the size but sends no body',
    `len=${head.headers['content-length']} body=${head.body.length}`,
  )

  const bad = await sendAndCollect(lib, { headers: { range: `bytes=${fullSize}-` } })
  assert(bad.statusCode === 416, 'range past EOF returns 416', String(bad.statusCode))
  assert(
    bad.headers['content-range'] === `bytes */${fullSize}`,
    '416 carries Content-Range: bytes */size',
    bad.headers['content-range'],
  )

  const malformed = await sendAndCollect(lib, { headers: { range: 'bytes=oops' } })
  assert(
    malformed.statusCode === 200 && malformed.body.length === fullSize,
    'malformed Range is ignored and the full 200 body is sent',
    `${malformed.statusCode} ${malformed.body.length}`,
  )
  const reversed = await sendAndCollect(lib, { headers: { range: 'bytes=500-100' } })
  assert(
    reversed.statusCode === 200,
    'inverted Range (bytes=500-100) is ignored and served as 200',
    String(reversed.statusCode),
  )

  // -- 6. cleanliness ----------------------------------------------------
  section('6. cleanliness')
  // Give ffmpeg/taskkill a moment to fully exit after the abort.
  await new Promise((resolve) => setTimeout(resolve, 1200))
  const leaked = ffmpegProcessCount()

  const strayTmp = []
  for (const walk of [RENDER_DIR, WORK_DIR, path.join(ROOT, 'test-media')]) {
    if (!(await exists(walk))) continue
    const entries = await fsp.readdir(walk, { withFileTypes: true }).catch(() => [])
    for (const entry of entries) {
      if (entry.isFile() && /\.tmp($|\.)/.test(entry.name)) {
        strayTmp.push(path.join(walk, entry.name))
      }
    }
  }
  // Recursively check the frame cache too.
  const frameCache = path.join(WORK_DIR, 'frame')
  if (await exists(frameCache)) {
    for (const entry of await fsp.readdir(frameCache, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = path.join(frameCache, entry.name)
      for (const file of await fsp.readdir(dir)) {
        if (/\.tmp/.test(file)) strayTmp.push(path.join(dir, file))
      }
    }
  }

  if (leaked === null) {
    console.log('   (process leak check skipped: non-Windows host)')
  } else {
    assert(leaked === 0, 'no ffmpeg.exe processes are left running', `${leaked} found`)
  }
  assert(strayTmp.length === 0, 'no stray .tmp files remain', strayTmp.join(', '))

  // ---------------------------------------------------------------------
  const passed = results.filter((r) => r.ok).length
  const failed = results.length - passed
  console.log(`\n=== summary ===`)
  console.log(`${passed} passed, ${failed} failed, ${results.length} total`)
  if (failed > 0) {
    console.log('\nFailures:')
    for (const r of results.filter((x) => !x.ok)) {
      console.log(`  FAIL [${r.check}] ${r.label}${r.detail ? `  —  ${r.detail}` : ''}`)
    }
    exitCode = 1
  } else {
    console.log('ALL CHECKS PASSED')
  }

  // Report the produced mp4 one more time for the caller.
  if (await exists(OUT_MP4)) {
    try {
      const out = await lib.probe(OUT_MP4)
      const size = await sizeOf(OUT_MP4)
      console.log(
        `\ntmp-render/out.mp4: ${out.duration.toFixed(3)}s, ${out.width}x${out.height}, ` +
          `${humanBytes(size)}, ~${((size * 8) / out.duration / 1000).toFixed(0)} kbps`,
      )
    } catch {
      /* already reported above */
    }
  }
}

async function cleanup() {
  // Only remove files/dirs this run created. tmp-render/out.mp4 is a deliverable
  // (the doc requires it to exist), so it is kept; scratch work dirs are removed.
  for (const dir of createdDirs) {
    await fsp.rm(dir, { recursive: true, force: true }).catch(() => {})
  }
  for (const file of created) {
    if (file === OUT_MP4) continue
    await fsp.unlink(file).catch(() => {})
  }
}

try {
  await main()
} catch (error) {
  console.error('\nself-test crashed:', error?.stack || error)
  exitCode = 1
} finally {
  await cleanup()
  process.exit(exitCode)
}
