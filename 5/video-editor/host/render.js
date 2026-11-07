// Export renderer: one ffmpeg invocation that trims + normalizes each main clip,
// concatenates video and audio (synthesizing silence for silent sources),
// composites overlays, and reports progress in [0,1].
//
// Pure Node ESM, no dependencies. The bundled ffmpeg binary is passed in.

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const PROGRESS_MAX = 0.99
const STDERR_CAP = 8 * 1024
const STDERR_TAIL = 400

/** Kill a process and its whole tree. ffmpeg spawns no children, but
 * taskkill /t guarantees nothing survives on Windows. Never throws. */
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

function fmtNum(value, digits = 6) {
  const num = Number(value)
  const factor = 10 ** digits
  // Trim trailing zeros so filtergraph arguments stay short and ASCII.
  return String(Math.round(num * factor) / factor)
}

function finitePositive(value) {
  const num = Number(value)
  return Number.isFinite(num) && num > 0
}

function finiteNonNegative(value) {
  const num = Number(value)
  return Number.isFinite(num) && num >= 0
}

function clampInt(value, min, max, fallback) {
  const num = Math.round(Number(value))
  if (!Number.isFinite(num)) return fallback
  return Math.min(max, Math.max(min, num))
}

function requireString(value, label) {
  if (typeof value !== 'string' || !value.trim())
    throw new Error(`${label} is required`)
  return value
}

function describeSpawnError(bin, error) {
  if (error && (error.code === 'ENOENT' || error.code === 'EACCES'))
    return `video tool not found at "${bin}" — check that the bundled ffmpeg binary exists`
  return error?.message ? String(error.message).slice(0, 200) : 'the process could not be started'
}

/** Last N chars of captured stderr, ending at the most useful lines. */
function stderrTail(text, max = STDERR_TAIL) {
  const cleaned = String(text || '').replace(/\u0000/g, '').trim()
  if (!cleaned) return ''
  const lines = cleaned
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  let out = ''
  for (let index = lines.length - 1; index >= 0 && out.length < max; index -= 1) {
    out = lines[index] + (out ? ` ${out}` : '')
  }
  return out.length > max ? `…${out.slice(out.length - max)}` : out
}

/** Build the ffmpeg args for one render spec. */
export function buildRenderArgs(spec, ffmpegPath) {
  const canvas = validateSpec(spec)
  const main = spec.main.map((clip, index) => normalizeMainClip(clip, index, canvas))
  const overlays = (spec.overlays || []).map((overlay, index) => normalizeOverlay(overlay, index, canvas))

  const totalDuration = main.reduce((sum, clip) => sum + clip.duration, 0)
  if (!(totalDuration > 0)) throw new Error('no clips on the timeline: total duration is zero')

  const filters = []
  const mainInputCount = main.length
  const args = ['-y', '-hide_banner', '-nostdin', '-loglevel', 'error', '-progress', 'pipe:1']

  // Inputs: all main clips first, then all overlay clips.
  for (const clip of main) args.push('-i', clip.sourcePath)
  for (const overlay of overlays) args.push('-i', overlay.sourcePath)

  const W = canvas.width
  const H = canvas.height
  const fps = canvas.fps

  // Main clips: trim -> force CFR at canvas fps -> rebase PTS -> scale/pad.
  // Note: `fps` must run BEFORE `setpts=PTS-STARTPTS` on this ffmpeg build
  // (N-92722): with PTS rebased first, the fps filter mis-counts frames and
  // lengthens/shifts a trimmed segment. Trim still runs on source timestamps.
  main.forEach((clip, index) => {
    filters.push(
      `[${index}:v]trim=start=${fmtNum(clip.in)}:end=${fmtNum(clip.out)},` +
        `fps=${fps},setpts=PTS-STARTPTS,` +
        `scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=bicubic,` +
        `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:color=black,` +
        `setsar=1,format=yuv420p[v${index}]`,
    )

    if (clip.hasAudio) {
      filters.push(
        `[${index}:a]atrim=start=${fmtNum(clip.in)}:end=${fmtNum(clip.out)},` +
          `asetpts=PTS-STARTPTS,aresample=44100,` +
          `aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${index}]`,
      )
    } else {
      // Synthesize silence for exactly this clip's duration so the concat audio
      // stream matches the video stream and never truncates it (-shortest is not used).
      filters.push(
        `aevalsrc=0|0:s=44100:d=${fmtNum(clip.duration)},` +
          `aformat=sample_fmts=fltp:sample_rates=44100:channel_layouts=stereo[a${index}]`,
      )
    }
  })

  // Concat video+audio interleaved: [v0][a0][v1][a1]...concat=n=N:v=1:a=1.
  const concatInputs = main.map((_, index) => `[v${index}][a${index}]`).join('')
  filters.push(`${concatInputs}concat=n=${main.length}:v=1:a=1[vcat][acat]`)
  filters.push(`[vcat]setpts=PTS-STARTPTS[vbase]`)
  filters.push(`[acat]asetpts=PTS-STARTPTS[abase]`)

  // Overlays: positioned by timeline start, scaled to a fraction of canvas width.
  let currentVideo = 'vbase'
  overlays.forEach((overlay, index) => {
    const inputIndex = mainInputCount + index
    const level = index % 2 === 0 ? 'yuv420p' : 'rgba'
    filters.push(
      `[${inputIndex}:v]trim=start=${fmtNum(overlay.in)}:end=${fmtNum(overlay.out)},` +
        `fps=${fps},setpts=PTS-STARTPTS+${fmtNum(overlay.start)}/TB,` +
        `scale=${overlay.width}:-2:flags=bicubic,setsar=1,format=${level}[ov${index}]`,
    )
    const next = index === overlays.length - 1 ? 'vfinal' : `vstep${index}`
    filters.push(
      `[${currentVideo}][ov${index}]overlay=x=${overlay.x}:y=${overlay.y}:` +
        `enable='between(t,${fmtNum(overlay.start)},${fmtNum(overlay.start + overlay.duration)})'` +
        `[${next}]`,
    )
    currentVideo = next
  })

  const videoLabel = overlays.length > 0 ? '[vfinal]' : '[vbase]'

  args.push('-filter_complex', filters.join(';'))
  args.push('-map', videoLabel, '-map', '[abase]')
  args.push('-t', fmtNum(totalDuration))
  args.push('-c:v', 'libx264', '-preset', spec.quality === 'fast' ? 'veryfast' : 'medium')
  args.push('-crf', '20', '-pix_fmt', 'yuv420p')
  args.push('-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-ac', '2')
  args.push('-movflags', '+faststart', '-r', String(fps))
  // The real output path is appended by run(); args stay path-free for testability.

  return { args, totalDuration, ffmpegPath, outputPath: spec.outputPath }
}

function validateSpec(spec) {
  if (!spec || typeof spec !== 'object') throw new Error('render spec is required')
  const canvas = spec.canvas
  if (!canvas || typeof canvas !== 'object') throw new Error('render spec is missing "canvas"')
  const width = clampInt(canvas.width, 16, 16384, 0)
  const height = clampInt(canvas.height, 16, 16384, 0)
  const fps = clampInt(canvas.fps, 1, 240, 0)
  if (!width || !height) throw new Error('canvas width and height must be positive integers')
  if (!fps) throw new Error('canvas fps must be a positive integer')
  if (width % 2 !== 0 || height % 2 !== 0)
    throw new Error(
      `canvas ${width}x${height} is invalid for H.264: width and height must be even`,
    )

  if (!Array.isArray(spec.main) || spec.main.length === 0)
    throw new Error('no clips on the timeline: add at least one clip to the main track')
  if (spec.overlays !== undefined && !Array.isArray(spec.overlays))
    throw new Error('render spec "overlays" must be an array')
  requireString(spec.outputPath, 'render spec "outputPath"')
  if (spec.quality !== undefined && spec.quality !== 'high' && spec.quality !== 'fast')
    throw new Error(`render spec "quality" must be "high" or "fast", got "${spec.quality}"`)
  return { width, height, fps }
}

function normalizeMainClip(clip, index, canvas) {
  if (!clip || typeof clip !== 'object') throw new Error(`main clip #${index + 1} is not an object`)
  const sourcePath = path.resolve(requireString(clip.sourcePath, `main clip #${index + 1} sourcePath`))
  const inTime = Number(clip.in)
  const outTime = Number(clip.out)
  if (!finiteNonNegative(inTime))
    throw new Error(`main clip #${index + 1} has an invalid in-point: ${clip.in}`)
  if (!finitePositive(outTime))
    throw new Error(`main clip #${index + 1} has an invalid out-point: ${clip.out}`)
  if (outTime <= inTime)
    throw new Error(
      `main clip #${index + 1} is too short: out (${outTime}s) must be greater than in (${inTime}s)`,
    )
  return {
    sourcePath,
    in: inTime,
    out: outTime,
    duration: outTime - inTime,
    hasAudio: clip.hasAudio === true,
  }
}

function normalizeOverlay(overlay, index, canvas) {
  if (!overlay || typeof overlay !== 'object')
    throw new Error(`overlay clip #${index + 1} is not an object`)
  const sourcePath = path.resolve(
    requireString(overlay.sourcePath, `overlay clip #${index + 1} sourcePath`),
  )
  const inTime = Number(overlay.in)
  const outTime = Number(overlay.out)
  if (!finiteNonNegative(inTime))
    throw new Error(`overlay clip #${index + 1} has an invalid in-point: ${overlay.in}`)
  if (!finitePositive(outTime))
    throw new Error(`overlay clip #${index + 1} has an invalid out-point: ${overlay.out}`)
  if (outTime <= inTime)
    throw new Error(
      `overlay clip #${index + 1} is too short: out (${outTime}s) must be greater than in (${inTime}s)`,
    )

  const start = finiteNonNegative(overlay.start) ? Number(overlay.start) : 0
  const scale = Number(overlay.scale)
  if (!Number.isFinite(scale) || scale <= 0 || scale > 4)
    throw new Error(`overlay clip #${index + 1} has an invalid scale: ${overlay.scale}`)

  // Width is a fraction of canvas width; force an even value for yuv420p.
  let width = Math.round(canvas.width * scale)
  if (width % 2 !== 0) width += 1
  width = Math.max(2, Math.min(width, canvas.width * 4))

  return {
    sourcePath,
    in: inTime,
    out: outTime,
    duration: outTime - inTime,
    start,
    x: clampInt(overlay.x, -16384, 16384, 0),
    y: clampInt(overlay.y, -16384, 16384, 0),
    width,
  }
}

export function createRenderer(options = {}) {
  const dir = options.dir
  if (!dir || typeof dir !== 'string') throw new Error('createRenderer: "dir" is required')
  const ffmpegPath = options.ffmpegPath
  const ffprobePath = options.ffprobePath
  if (!ffmpegPath || typeof ffmpegPath !== 'string')
    throw new Error('createRenderer: "ffmpegPath" is required')
  if (!ffprobePath || typeof ffprobePath !== 'string')
    throw new Error('createRenderer: "ffprobePath" is required')

  // Directory -> whether ffmpeg may write into it (probed once, cached).
  const writableCache = new Map()

  async function ffmpegCanWriteInto(directory) {
    const probeFile = path.join(directory, `.ffmpeg-write-probe-${process.pid}-${Math.random().toString(36).slice(2, 10)}.mp4`)
    try {
      await fsp.mkdir(directory, { recursive: true })
    } catch {
      return false
    }
    const ok = await new Promise((resolve) => {
      const child = spawn(
        ffmpegPath,
        ['-y', '-hide_banner', '-nostdin', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=black:s=32x32:d=1', '-frames:v', '1', '-f', 'mp4', probeFile],
        { windowsHide: true, stdio: 'ignore' },
      )
      child.on('error', () => resolve(false))
      child.on('close', (code) => resolve(code === 0))
    })
    let good = false
    if (ok) {
      const stat = await fsp.stat(probeFile).catch(() => null)
      good = Boolean(stat && stat.isFile() && stat.size > 0)
    }
    await fsp.unlink(probeFile).catch(() => {})
    return good
  }

  /** Choose where ffmpeg writes, plus how to publish it to `outputPath`. */
  async function resolveEncodeTarget(outputPath) {
    const targetDir = path.dirname(outputPath)
    let info = writableCache.get(targetDir)
    if (!info) {
      info = (async () => {
        if (await ffmpegCanWriteInto(targetDir)) return { root: targetDir, direct: true }
        const staged = path.join(path.dirname(path.dirname(path.resolve(ffmpegPath))), '.host-tmp')
        if (await ffmpegCanWriteInto(staged)) return { root: staged, direct: false }
        const systemStaged = path.join(os.tmpdir(), 'video-editor-host-tmp')
        if (await ffmpegCanWriteInto(systemStaged)) return { root: systemStaged, direct: false }
        throw new Error(
          `export failed: ffmpeg has no write permission in "${targetDir}" or any staging ` +
            'directory; choose an output directory the bundled ffmpeg may write to',
        )
      })()
      writableCache.set(targetDir, info)
      info.catch(() => {
        if (writableCache.get(targetDir) === info) writableCache.delete(targetDir)
      })
    }
    const { root, direct } = await info
    if (direct) return { encodePath: `${outputPath}.tmp.mp4`, mode: 'direct' }
    const encodePath = path.join(root, `.render-${process.pid}-${Math.random().toString(36).slice(2, 10)}.mp4`)
    await fsp.unlink(encodePath).catch(() => {})
    return { encodePath, mode: 'staged' }
  }

  /** Publish a finished encode at `outputPath` atomically. */
  async function publish(encodePath, outputPath, mode) {
    if (mode === 'direct') {
      await fsp.rename(encodePath, outputPath)
      return
    }
    // Cross-directory publish: land in a sibling temp file, then rename, so
    // readers never observe a partially written output file.
    const staged = `${outputPath}.tmp.mp4`
    try {
      await fsp.copyFile(encodePath, staged)
      await fsp.rename(staged, outputPath)
    } catch (error) {
      await fsp.unlink(staged).catch(() => {})
      throw error
    } finally {
      await fsp.unlink(encodePath).catch(() => {})
    }
  }

  async function run(spec, onProgress, signal) {
    if (signal?.aborted) throw new Error('export cancelled')
    const { args, totalDuration } = buildRenderArgs(spec, ffmpegPath)
    const outputPath = path.resolve(spec.outputPath)
    const report = typeof onProgress === 'function' ? onProgress : () => {}

    // Inputs must be readable before we spawn, so a typo fails fast with a
    // actionable message instead of a raw ffmpeg stderr dump.
    const clips = [...(spec.main || []), ...(spec.overlays || [])]
    for (let index = 0; index < clips.length; index += 1) {
      const abs = path.resolve(String(clips[index].sourcePath))
      try {
        const stat = await fsp.stat(abs)
        if (!stat.isFile() || stat.size === 0) throw new Error('empty')
      } catch {
        throw new Error(`clip source is not a readable video file: "${abs}"`)
      }
    }

    await fsp.mkdir(path.dirname(outputPath), { recursive: true })
    report(0)

    // Encode into a directory ffmpeg can actually write. Some hosts confine
    // ffmpeg to the workspace even when Node may write anywhere, so writing
    // straight to outputPath fails with "Permission denied". We stage in a
    // usable directory and publish the finished file with Node (a rename when
    // the filesystem matches, a copy otherwise).
    const { encodePath, mode } = await resolveEncodeTarget(outputPath)

    // Encode time is bounded so a wedged ffmpeg can never leak: allow ~20x
    // realtime with a two-minute floor.
    const timeoutMs = Math.max(120_000, Math.round(totalDuration * 20 * 1000))

    return await new Promise((resolve, reject) => {
      let child
      let settled = false
      let aborting = false
      let timedOut = false
      let stderr = ''
      let lastProgress = 0
      let timer = null

      const cleanupFiles = async () => {
        await fsp.unlink(encodePath).catch(() => {})
        if (mode !== 'direct') await fsp.unlink(`${outputPath}.tmp.mp4`).catch(() => {})
      }

      const settle = (fn, value) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        if (signal) signal.removeEventListener?.('abort', onAbort)
        fn(value)
      }

      const finalize = async (error) => {
        await cleanupFiles()
        settle(reject, error)
      }

      const onAbort = () => {
        if (settled || aborting) return
        aborting = true
        if (timer) clearTimeout(timer)
        killTree(child)
        // Give the OS a moment to release the handle, then remove the partial file.
        setTimeout(() => {
          void cleanupFiles().then(() => settle(reject, new Error('export cancelled')))
        }, 100).unref?.()
      }

      try {
        child = spawn(ffmpegPath, [...args, '-f', 'mp4', encodePath], {
          windowsHide: true,
          stdio: ['ignore', 'pipe', 'pipe'],
        })
      } catch (error) {
        void finalize(new Error(`export failed: ${describeSpawnError(ffmpegPath, error)}`))
        return
      }

      signal?.addEventListener?.('abort', onAbort, { once: true })

      child.on('error', (error) => {
        void finalize(new Error(`export failed: ${describeSpawnError(ffmpegPath, error)}`))
      })

      child.stdout?.setEncoding('utf8')
      child.stdout?.on('data', (chunk) => {
        const lines = String(chunk).split(/\r?\n/)
        for (const line of lines) {
          const eq = line.indexOf('=')
          if (eq === -1) continue
          const key = line.slice(0, eq).trim()
          const raw = line.slice(eq + 1).trim()
          if (key !== 'out_time_us' && key !== 'out_time_ms' && key !== 'out_time') continue
          let seconds = NaN
          if (key === 'out_time') {
            const match = /^(\d+):(\d+):(\d+(?:\.\d+)?)$/.exec(raw)
            if (match) {
              seconds = Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3])
            }
          } else {
            const micros = Number(raw)
            if (Number.isFinite(micros) && micros >= 0) seconds = micros / 1_000_000
          }
          if (!Number.isFinite(seconds) || seconds <= 0) continue
          const next = Math.min(PROGRESS_MAX, Math.max(0, seconds / totalDuration))
          if (next > lastProgress) {
            lastProgress = next
            try {
              report(next)
            } catch {
              /* a throwing progress callback must not break the export */
            }
          }
        }
      })

      child.stderr?.setEncoding('utf8')
      child.stderr?.on('data', (chunk) => {
        stderr += String(chunk)
        if (stderr.length > STDERR_CAP) stderr = stderr.slice(stderr.length - STDERR_CAP)
      })

      timer = setTimeout(() => {
        timedOut = true
        killTree(child)
      }, timeoutMs)
      if (timer.unref) timer.unref()

      child.on('close', (code) => {
        void (async () => {
          if (settled) return
          if (aborting) {
            await finalize(new Error('export cancelled'))
            return
          }
          if (timedOut) {
            await finalize(
              new Error(
                `export timed out after ${Math.round(timeoutMs / 1000)}s ` +
                  '(the encoder stopped making progress)',
              ),
            )
            return
          }

          if (code !== 0) {
            const detail = stderrTail(stderr) || `ffmpeg exited with code ${code}`
            await finalize(new Error(`export failed: ${detail}`))
            return
          }

          const stat = await fsp.stat(encodePath).catch(() => null)
          if (!stat || stat.size === 0) {
            await finalize(
              new Error('export failed: ffmpeg reported success but wrote no output file'),
            )
            return
          }

          // Atomic publish: only the finished file appears at outputPath.
          try {
            await publish(encodePath, outputPath, mode)
          } catch (error) {
            await finalize(
              new Error(
                `export failed: could not finalize output file (${error.code || 'write failed'})`,
              ),
            )
            return
          }

          try {
            report(1)
          } catch {
            /* ignore */
          }
          settle(resolve, { outputPath, duration: totalDuration })
        })()
      })
    })
  }

  return { run }
}
