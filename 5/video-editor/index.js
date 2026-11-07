/**
 * Host half of the video editing workbench.
 *
 * Responsibilities:
 *  - own the per-Session project state machine (project.js);
 *  - expose the same operations over HTTP for the browser view and as the
 *    `video_editor` agent tool, so a chat instruction and a mouse click run the
 *    exact same code path;
 *  - run ffmpeg export jobs with progress reporting;
 *  - stream media, posters and timeline thumbnails.
 */

import { mkdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMediaLibrary } from './host/media.js'
import { createRenderer } from './host/render.js'
import { createProjects, ProjectError, layout } from './host/project.js'
import { createStore } from './host/store.js'
import {
  JOB_RE,
  MEDIA_RE,
  ROUTE_PREFIX,
  SESSION_RE,
  contentTypeOf,
  dataRoot,
  methodRefused,
  readJson,
  readRaw,
  sendJson,
  streamMedia,
} from './host/http.js'

const PACKAGE_NAME = '@local/video-editor'
const BIN = new URL('./bin/', import.meta.url)
const FFMPEG = process.env.DSH_VIDEO_EDITOR_FFMPEG ?? fileURLToPath(new URL('ffmpeg.exe', BIN))
const FFPROBE = process.env.DSH_VIDEO_EDITOR_FFPROBE ?? fileURLToPath(new URL('ffprobe.exe', BIN))

/** Whether the bundled binaries are present and executable. */
function binariesReport() {
  return {
    ffmpeg: {
      available: existsSync(FFMPEG),
      path: FFMPEG,
    },
    ffprobe: {
      available: existsSync(FFPROBE),
      path: FFPROBE,
    },
  }
}

export function apply(ctx) {
  const root = dataRoot(ctx)
  const media = createMediaLibrary({
    dir: root,
    ffmpegPath: FFMPEG,
    ffprobePath: FFPROBE,
  })
  const store = createStore(root)
  const renderer = createRenderer({ dir: root, ffmpegPath: FFMPEG, ffprobePath: FFPROBE })
  const projects = createProjects({
    media,
    read: store.read,
    write: store.write,
    resolvePath: (candidate, sessionId) => resolveAgainstSession(candidate, sessionId),
  })

  /** @type {Map<string, Map<string, object>>} */
  const jobs = new Map()

  /** Resolve a possibly relative path against one Session's working directory. */
  async function resolveAgainstSession(candidate, sessionId) {
    if (typeof candidate !== 'string' || candidate.trim() === '') throw new ProjectError('路径为空')
    const expanded = candidate.trim().replace(/^~(?=$|[\\/])/, homeDirectory())
    if (isAbsolute(expanded)) {
      if (!existsSync(expanded)) throw new ProjectError(`文件不存在：${expanded}`)
      return expanded
    }
    const cwd = sessionWorkingDirectory(sessionId) ?? process.cwd()
    const full = resolve(cwd, expanded)
    if (!existsSync(full)) throw new ProjectError(`文件不存在：${expanded}（相对路径基于 ${cwd}）`)
    return full
  }

  function homeDirectory() {
    return process.env.USERPROFILE ?? process.env.HOME ?? ''
  }

  function isAbsolute(path) {
    return /^[A-Za-z]:[\\/]/.test(path) || path.startsWith('\\\\') || path.startsWith('/')
  }

  function sessionWorkingDirectory(sessionId) {
    if (typeof sessionId !== 'string' || sessionId === '') return undefined
    const sessions = ctx.get('sessions')
    const workingDirectory = ctx.get('workingDirectory')
    if (typeof workingDirectory?.get !== 'function') return undefined
    try {
      if (typeof sessions?.get === 'function') {
        const session = sessions.get(sessionId)
        if (session !== undefined) {
          const directory = workingDirectory.get(session)
          if (typeof directory === 'string' && directory !== '') return directory
        }
      }
      // A request for a Session that is not live still needs a sane base for
      // relative paths; the deployment default directory is the documented one.
      const fallback = workingDirectory.defaultDirectory
      if (typeof fallback === 'string' && fallback !== '') return fallback
    } catch {
      // either service is unavailable in this deployment; fall through
    }
    return undefined
  }

  function jobTable(sessionId) {
    let table = jobs.get(sessionId)
    if (table === undefined) {
      table = new Map()
      jobs.set(sessionId, table)
    }
    return table
  }

  // ---------------------------------------------------------------- operations

  /** Build the renderer spec for one project state. */
  function renderSpecFor(state, quality, outputPath, overrides = {}) {
    const mediaById = new Map(state.media.map((item) => [item.id, item]))
    const order = layout(state).main
    const main = []
    for (const slice of order) {
      const clip = state.clips.find((entry) => entry.id === slice.clipId)
      const item = mediaById.get(clip.mediaId)
      if (item === undefined) throw new ProjectError(`片段 ${clip.id} 的素材已丢失`)
      main.push({ sourcePath: item.sourcePath, in: clip.in, out: clip.out, hasAudio: item.hasAudio })
    }
    const overlays = []
    for (const clip of state.clips) {
      if (clip.track !== 1) continue
      const item = mediaById.get(clip.mediaId)
      if (item === undefined) throw new ProjectError(`叠加片段 ${clip.id} 的素材已丢失`)
      overlays.push({
        sourcePath: item.sourcePath,
        in: clip.in,
        out: clip.out,
        start: clip.start ?? 0,
        x: clip.x ?? 0,
        y: clip.y ?? 0,
        scale: clip.scale ?? 0.35,
      })
    }
    return {
      canvas: {
        width: overrides.width ?? state.width,
        height: overrides.height ?? state.height,
        fps: overrides.fps ?? state.fps,
      },
      quality: quality === 'fast' ? 'fast' : 'high',
      outputPath,
      main,
      overlays,
    }
  }

  function defaultFileName(state) {
    const stamp = new Date()
    const pad = (value) => String(value).padStart(2, '0')
    const day = `${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}`
    const time = `${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}`
    return `edit-${day}-${time}.mp4`
  }

  function safeFileName(name) {
    const base = String(name ?? '').replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
    const cleaned = base === '' ? defaultFileName({}) : base
    return extname(cleaned) === '' ? `${cleaned}.mp4` : cleaned
  }

  /**
   * Start one export job.
   * @returns the created job record (mutated in place as it progresses).
   */
  async function startExport(sessionId, request = {}) {
    const state = await projects.load(sessionId)
    const jobId = `j${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
    const filename = safeFileName(request.filename)
    const outputDir = join(root, 'exports', sessionId)
    await mkdir(outputDir, { recursive: true })
    const outputPath = join(outputDir, `${jobId}-${filename}`)
    const spec = renderSpecFor(state, request.quality, outputPath, {
      width: numberOrUndefined(request.width),
      height: numberOrUndefined(request.height),
      fps: numberOrUndefined(request.fps),
    })
    const job = {
      id: jobId,
      sessionId,
      status: 'running',
      progress: 0,
      filename,
      outputPath,
      createdAt: Date.now(),
      duration: spec.main.reduce((total, clip) => total + (clip.out - clip.in), 0),
    }
    jobTable(sessionId).set(jobId, job)
    const controller = new AbortController()
    job.abort = () => controller.abort()
    void (async () => {
      try {
        const result = await renderer.run(spec, (progress) => {
          job.progress = Math.max(0, Math.min(0.99, progress))
        }, controller.signal)
        job.status = 'done'
        job.progress = 1
        job.duration = result.duration
        job.outputUrl = `${ROUTE_PREFIX}/s/${sessionId}/export/${jobId}/file`
        job.finishedAt = Date.now()
      } catch (error) {
        job.status = 'error'
        job.error = String(error?.message ?? error)
        job.finishedAt = Date.now()
      } finally {
        delete job.abort
      }
    })()
    return job
  }

  function numberOrUndefined(value) {
    return typeof value === 'number' && Number.isFinite(value) ? value : undefined
  }

  /** Remove volatile members before serializing a job. */
  function publicJob(job) {
    const { abort, ...rest } = job
    return rest
  }

  /** Human/agent-readable project summary. */
  function summarize(state, sessionId) {
    const layoutResult = layout(state)
    const timecode = (seconds) => {
      const total = Math.max(0, seconds)
      const hours = Math.floor(total / 3600)
      const minutes = Math.floor((total % 3600) / 60)
      const secs = Math.floor(total % 60)
      const frames = Math.round((total % 1) * state.fps)
      const clock = hours > 0
        ? `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
        : `${minutes}:${String(secs).padStart(2, '0')}`
      return `${clock}.${String(Math.min(frames, state.fps - 1)).padStart(2, '0')}`
    }
    const mediaLines = state.media.length === 0
      ? ['  （无素材，先导入视频）']
      : state.media.map((item) => `  ${item.id}  ${item.name}  ${timecode(item.duration)}  ${item.width}x${item.height}  ${item.fps}fps${item.hasAudio ? '  有音频' : '  无声'}`)
    const clipLines = []
    layoutResult.main.forEach((slice, index) => {
      const clip = state.clips.find((entry) => entry.id === slice.clipId)
      const item = state.media.find((entry) => entry.id === clip.mediaId)
      clipLines.push(`  ${index + 1}. ${clip.id}  ${item?.name ?? clip.mediaId}  ${timecode(slice.start)}–${timecode(slice.end)}  (源 ${timecode(clip.in)}–${timecode(clip.out)})`)
    })
    for (const slice of layoutResult.overlays) {
      const clip = state.clips.find((entry) => entry.id === slice.clipId)
      const item = state.media.find((entry) => entry.id === clip.mediaId)
      clipLines.push(`  叠加 ${clip.id}  ${item?.name ?? clip.mediaId}  ${timecode(slice.start)}–${timecode(slice.end)}  位置 ${clip.x},${clip.y}  宽度 ${Math.round((clip.scale ?? 0.35) * 100)}%`)
    }
    const lines = [
      `项目「${state.title}」 ${state.width}x${state.height} ${state.fps}fps  总时长 ${timecode(layoutResult.duration)}`,
      `素材 ${state.media.length} 个：`,
      ...mediaLines,
      `时间轴 ${layoutResult.main.length} 个主轨道片段${layoutResult.overlays.length > 0 ? `、${layoutResult.overlays.length} 个叠加片段` : ''}：`,
      ...(clipLines.length === 0 ? ['  （空）'] : clipLines),
      `工作台视图「剪辑工作台」可在会话页签中打开；也可继续用自然语言让我剪辑。`,
    ]
    return lines.join('\n')
  }

  // ------------------------------------------------------------------- routes

  function registerRoutes(scope) {
    const server = scope.webServer ?? scope.get?.('webServer')
    if (server === undefined || server === null) return
    const disposers = []
    const register = (label, route) => {
      try {
        const dispose = server.register(route)
        if (typeof dispose === 'function') disposers.push(dispose)
      } catch (error) {
        ctx.logger?.warn?.(`${PACKAGE_NAME}: route ${label} unavailable: ${String(error?.message ?? error)}`)
      }
    }

    const guard = (req, res, methods) => {
      if (methodRefused(req, res, methods)) return false
      return true
    }

    /** Split `/video-editor/s/<sid>/...` into components. */
    function parse(req) {
      const url = new URL(req.url ?? '/', 'http://local')
      const parts = url.pathname.split('/').filter((part) => part !== '')
      // ['video-editor','s','<sid>', ...rest]
      if (parts.length < 3 || parts[0] !== 'video-editor' || parts[1] !== 's') return null
      const sessionId = parts[2]
      if (!SESSION_RE.test(sessionId)) return null
      return { sessionId, rest: parts.slice(3), search: url.searchParams }
    }

    function fail(res, error, status = 200) {
      // Business refusals are `ok:false` at HTTP 200 (the client distinguishes
      // them from transport errors); only malformed transport gets a 4xx/5xx.
      sendJson(res, status, { ok: false, error: String(error?.message ?? error) })
    }

    register('workbench api', {
      kind: 'prefix',
      path: ROUTE_PREFIX,
      handler: (req, res) => {
        void handle(req, res).catch((error) => {
          if (res.headersSent) {
            res.destroy()
            return
          }
          fail(res, error)
        })
      },
    })

    async function handle(req, res) {
      const parsed = parse(req)
      if (parsed === null) {
        fail(res, '无效的路径', 404)
        return
      }
      const { sessionId, rest, search } = parsed
      const [head, second, third] = rest

      if (head === undefined) {
        fail(res, '缺少操作', 404)
        return
      }

      if (head === 'ping') {
        if (!guard(req, res, ['GET', 'HEAD'])) return
        sendJson(res, 200, { ok: true, ...binariesReport() })
        return
      }

      if (head === 'state') {
        if (!guard(req, res, ['GET'])) return
        const state = await projects.load(sessionId)
        sendJson(res, 200, { ok: true, state: projects.view(sessionId, state) })
        return
      }

      if (head === 'op') {
        if (!guard(req, res, ['POST'])) return
        const body = await readJson(req)
        if (body.error !== undefined) {
          fail(res, body.error, 400)
          return
        }
        try {
          const operation = body.value?.op ?? body.value
          const state = await projects.apply(sessionId, operation)
          sendJson(res, 200, { ok: true, state })
        } catch (error) {
          if (error instanceof ProjectError) fail(res, error.message)
          else fail(res, error)
        }
        return
      }

      if (head === 'media' && second === undefined) {
        if (!guard(req, res, ['POST'])) return
        const headerName = req.headers['x-file-name']
        const rawName = typeof headerName === 'string' ? decodeURIComponent(headerName) : 'upload.mp4'
        const body = await readRaw(req)
        if (body.error !== undefined) {
          fail(res, body.error, 400)
          return
        }
        try {
          const storedPath = await media.saveUpload(rawName, body.bytes)
          const metadata = await media.probe(storedPath)
          const state = await projects.load(sessionId)
          const applied = await projects.apply(sessionId, {
            type: 'addMedia',
            media: {
              name: rawName,
              sourcePath: storedPath,
              origin: 'upload',
              duration: metadata.duration,
              width: metadata.width,
              height: metadata.height,
              fps: metadata.fps,
              hasAudio: metadata.hasAudio,
              size: metadata.size,
            },
          })
          const item = applied.media.find((entry) => entry.sourcePath.toLowerCase() === storedPath.toLowerCase())
          sendJson(res, 200, { ok: true, state: applied, media: item ?? null })
        } catch (error) {
          if (error instanceof ProjectError) fail(res, error.message)
          else fail(res, error)
        }
        return
      }

      if (head === 'import') {
        if (!guard(req, res, ['POST'])) return
        const body = await readJson(req)
        if (body.error !== undefined) {
          fail(res, body.error, 400)
          return
        }
        const paths = Array.isArray(body.value?.paths) ? body.value.paths : []
        try {
          const state = await projects.apply(sessionId, { type: 'importPath', paths })
          sendJson(res, 200, { ok: true, state, imported: state.media.slice(-paths.length) })
        } catch (error) {
          if (error instanceof ProjectError) fail(res, error.message)
          else fail(res, error)
        }
        return
      }

      if (head === 'media' && second !== undefined) {
        if (!MEDIA_RE.test(second)) {
          fail(res, '无效的素材 id', 404)
          return
        }
        if (!guard(req, res, ['GET', 'HEAD'])) return
        const state = await projects.load(sessionId)
        const item = state.media.find((entry) => entry.id === second)
        if (item === undefined) {
          fail(res, '素材不存在', 404)
          return
        }
        if (third === 'poster.jpg') {
          try {
            const poster = await media.poster(item.sourcePath, item.id)
            await sendImage(res, poster)
          } catch (error) {
            fail(res, error, 404)
          }
          return
        }
        if (third === 'frame.jpg') {
          const time = Number(search.get('t') ?? '0')
          try {
            const frame = await media.frame(item.sourcePath, item.id, Number.isFinite(time) ? time : 0)
            await sendImage(res, frame)
          } catch (error) {
            fail(res, error, 404)
          }
          return
        }
        streamMedia(req, res, item.sourcePath, contentTypeOf(item.sourcePath))
        return
      }

      if (head === 'export') {
        if (second === undefined) {
          if (!guard(req, res, ['GET', 'POST'])) return
          if (req.method === 'GET') {
            const table = jobTable(sessionId)
            sendJson(res, 200, { ok: true, jobs: [...table.values()].map(publicJob), binaries: binariesReport() })
            return
          }
          const body = await readJson(req)
          if (body.error !== undefined) {
            fail(res, body.error, 400)
            return
          }
          try {
            const job = await startExport(sessionId, body.value ?? {})
            sendJson(res, 200, { ok: true, job: publicJob(job) })
          } catch (error) {
            if (error instanceof ProjectError) fail(res, error.message)
            else fail(res, error)
          }
          return
        }
        if (!JOB_RE.test(second)) {
          fail(res, '无效的任务 id', 404)
          return
        }
        const table = jobTable(sessionId)
        const job = table.get(second)
        if (job === undefined) {
          fail(res, '导出任务不存在', 404)
          return
        }
        if (third === 'file') {
          if (!guard(req, res, ['GET', 'HEAD'])) return
          if (job.status !== 'done') {
            fail(res, '导出尚未完成', 409)
            return
          }
          const headers = {
            'content-type': 'video/mp4',
            'cache-control': 'no-store',
          }
          const size = (await stat(job.outputPath)).size
          const encoded = encodeURIComponent(job.filename)
          res.writeHead(200, {
            ...headers,
            'content-length': String(size),
            'content-disposition': `attachment; filename="${job.filename}"; filename*=UTF-8''${encoded}`,
          })
          if (req.method === 'HEAD') {
            res.end()
            return
          }
          const { createReadStream } = await import('node:fs')
          createReadStream(job.outputPath).pipe(res)
          return
        }
        if (!guard(req, res, ['GET', 'DELETE'])) return
        if (req.method === 'DELETE') {
          if (typeof job.abort === 'function') job.abort()
          table.delete(second)
          sendJson(res, 200, { ok: true })
          return
        }
        sendJson(res, 200, { ok: true, job: publicJob(job) })
        return
      }

      fail(res, '未知操作', 404)
    }

    async function sendImage(res, filePath) {
      const { createReadStream } = await import('node:fs')
      const size = (await stat(filePath)).size
      res.writeHead(200, {
        'content-type': contentTypeOf(filePath),
        'content-length': String(size),
        'cache-control': 'private, max-age=86400',
      })
      createReadStream(filePath).pipe(res)
    }

    scope.effect(() => {
      return () => {
        for (const dispose of disposers) {
          try {
            dispose()
          } catch {
            // route already gone
          }
        }
      }
    }, `${PACKAGE_NAME}: routes`)
  }

  // --------------------------------------------------------------------- tool

  const ACTION_ENUM = [
    'open',
    'state',
    'import',
    'add_clip',
    'trim',
    'split',
    'delete',
    'move',
    'set_project',
    'export',
    'export_async',
    'list_exports',
  ]

  const REF = { oneOf: [{ type: 'string' }, { type: 'number' }] }

  const toolDescription = [
    '剪辑当前会话中的视频项目（会话级时间轴，和「剪辑工作台」页面共享同一份数据）。',
    '先 import 导入本地视频（相对路径按会话工作目录解析，也接受绝对路径），再用 add_clip / trim / split / delete / move 调整时间轴，最后 export 渲染成 mp4 并返回文件路径。',
    'main 轨道（track 0）是磁性的：片段按顺序首尾相连，move 用于调整顺序；overlay 轨道（track 1）是自由位置的画中画，用 start / x / y / scale 控制。',
    '片段序号 clip 从 1 开始（主轨道顺序），也可以传片段 id（c1）、素材用名称或 id（m1）。',
    'action=list_exports 查看本会话已完成的导出文件。',
  ].join('\n')

  const parameters = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ACTION_ENUM,
        description: '操作类型。open/state 只读；其余会修改时间轴；export 会等待渲染完成。',
      },
      paths: {
        type: 'array',
        items: { type: 'string' },
        description: 'import 的源文件路径列表（绝对路径或相对会话工作目录的路径）。',
      },
      media: {
        type: 'string',
        description: '素材名称、唯一名称前缀或素材 id（m1）。add_clip 必填。',
      },
      clip: {
        ...REF,
        description: '片段引用：主轨道 1-based 序号，或片段 id。',
      },
      clips: {
        type: 'array',
        items: REF,
        description: 'delete 的片段引用列表。',
      },
      in: { type: 'number', description: '片段在源视频中的入点（秒）。' },
      out: { type: 'number', description: '片段在源视频中的出点（秒）。' },
      at: { type: 'number', description: 'split 的时间轴切分点（秒）。' },
      toIndex: { type: 'integer', description: 'move 的目标位置（0-based，主轨道顺序）。' },
      track: { type: 'integer', enum: [0, 1], description: 'add_clip 放到哪条轨道：0 主轨道（默认），1 叠加层。' },
      start: { type: 'number', description: '叠加层片段的起始时间轴时间（秒）。' },
      x: { type: 'number', description: '叠加层左上角横坐标（像素）。' },
      y: { type: 'number', description: '叠加层左上角纵坐标（像素）。' },
      scale: { type: 'number', description: '叠加层宽度占画布宽度的比例（0.05–1）。' },
      title: { type: 'string', description: 'set_project：项目标题。' },
      width: { type: 'integer', description: 'set_project：画布宽度。' },
      height: { type: 'integer', description: 'set_project：画布高度。' },
      fps: { type: 'integer', description: 'set_project：帧率（24/25/30/50/60）。' },
      filename: { type: 'string', description: 'export 的输出文件名（默认 edit-日期-时间.mp4）。' },
      quality: {
        type: 'string',
        enum: ['high', 'fast'],
        description: 'export 的画质：high 高质量（较慢），fast 快速。',
      },
    },
    required: ['action'],
  }

  const toolDefinition = {
    name: 'video_editor',
    description: toolDescription,
    parameters,
    output: {
      schema: { type: 'string' },
      render(_args, value) {
        return [{ type: 'text', text: String(value) }]
      },
    },
    async execute(args) {
      const action = String(args?.action ?? '')
      const agent = ctx.get('agents')?.currentInitiator?.()
      const sessionId = agent?.id
      if (typeof sessionId !== 'string' || sessionId === '') {
        throw new Error('video_editor 只能在会话内调用（找不到当前会话）')
      }
      try {
        const state = await projects.load(sessionId)
        switch (action) {
          case 'open':
          case 'state':
            return summarize(state, sessionId)
          case 'import': {
            const paths = Array.isArray(args.paths) ? args.paths : []
            if (paths.length === 0) throw new Error('import 需要 paths')
            const applied = await projects.apply(sessionId, { type: 'importPath', paths })
            const added = applied.media.filter((item) => !state.media.some((before) => before.id === item.id))
            return [`已导入 ${added.length} 个素材。`, summarize(await projects.load(sessionId), sessionId)].join('\n')
          }
          case 'add_clip': {
            if (typeof args.media !== 'string' || args.media === '') throw new Error('add_clip 需要 media')
            await projects.apply(sessionId, {
              type: 'addClip',
              mediaId: args.media,
              in: args.in,
              out: args.out,
              track: args.track,
              start: args.start,
              x: args.x,
              y: args.y,
              scale: args.scale,
            })
            return summarize(await projects.load(sessionId), sessionId)
          }
          case 'trim': {
            if (args.clip === undefined) throw new Error('trim 需要 clip')
            await projects.apply(sessionId, { type: 'trim', clipId: args.clip, in: args.in, out: args.out })
            return summarize(await projects.load(sessionId), sessionId)
          }
          case 'split': {
            if (args.clip === undefined) throw new Error('split 需要 clip')
            await projects.apply(sessionId, { type: 'split', clipId: args.clip, at: args.at })
            return summarize(await projects.load(sessionId), sessionId)
          }
          case 'delete': {
            const refs = Array.isArray(args.clips) ? args.clips : args.clip === undefined ? [] : [args.clip]
            if (refs.length === 0) throw new Error('delete 需要 clips')
            await projects.apply(sessionId, { type: 'delete', clipIds: refs })
            return summarize(await projects.load(sessionId), sessionId)
          }
          case 'move': {
            if (args.clip === undefined || !Number.isFinite(args.toIndex)) throw new Error('move 需要 clip 和 toIndex')
            await projects.apply(sessionId, { type: 'move', clipId: args.clip, toIndex: args.toIndex })
            return summarize(await projects.load(sessionId), sessionId)
          }
          case 'set_project': {
            await projects.apply(sessionId, {
              type: 'setProject',
              title: args.title,
              width: args.width,
              height: args.height,
              fps: args.fps,
            })
            return summarize(await projects.load(sessionId), sessionId)
          }
          case 'export': {
            const job = await startExport(sessionId, {
              quality: args.quality,
              filename: args.filename,
            })
            const finished = await waitForJob(job, 15 * 60 * 1000)
            if (finished.status !== 'done') throw new Error(`导出失败：${finished.error ?? '未知原因'}`)
            return [
              `导出完成：${finished.filename}`,
              `文件：${finished.outputPath}`,
              `时长：${(finished.duration ?? 0).toFixed(2)}s`,
              summarize(await projects.load(sessionId), sessionId),
            ].join('\n')
          }
          case 'export_async': {
            const job = await startExport(sessionId, {
              quality: args.quality,
              filename: args.filename,
            })
            return [
              `导出任务已开始：${job.id}（${job.filename}）`,
              `进度可在「剪辑工作台」导出面板中查看；完成后文件位于 ${job.outputPath}`,
            ].join('\n')
          }
          case 'list_exports': {
            const table = jobTable(sessionId)
            const list = [...table.values()].sort((left, right) => right.createdAt - left.createdAt)
            if (list.length === 0) return '本会话还没有导出记录。'
            return [
              '导出记录：',
              ...list.map((job) => `  ${job.id}  ${job.status}  ${Math.round(job.progress * 100)}%  ${job.outputPath ?? job.filename}${job.error !== undefined ? `  (${job.error})` : ''}`),
            ].join('\n')
          }
          default:
            throw new Error(`未知 action：${action}（可用：${ACTION_ENUM.join(', ')}）`)
        }
      } catch (error) {
        if (error instanceof ProjectError) throw new Error(error.message)
        throw error
      }
    },
  }

  function waitForJob(job, timeoutMs) {
    return new Promise((settle, reject) => {
      const started = Date.now()
      const timer = setInterval(() => {
        if (job.status === 'done' || job.status === 'error') {
          clearInterval(timer)
          settle(publicJob(job))
          return
        }
        if (Date.now() - started > timeoutMs) {
          clearInterval(timer)
          reject(new Error('导出超时'))
        }
      }, 250)
    })
  }

  // ------------------------------------------------------------ registration

  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (scope) => {
      registerRoutes(scope)
    })
  } else {
    registerRoutes(ctx)
  }

  const tools = ctx.get('tools')
  if (typeof tools?.register === 'function') {
    ctx.effect(() => tools.register(toolDefinition), `${PACKAGE_NAME}: video_editor tool`)
  } else {
    ctx.logger?.warn?.(`${PACKAGE_NAME}: ctx.tools 不可用，video_editor 工具未注册`)
  }

  ctx.effect(() => {
    return () => {
      for (const table of jobs.values()) {
        for (const job of table.values()) {
          if (typeof job.abort === 'function') job.abort()
        }
      }
      jobs.clear()
    }
  }, `${PACKAGE_NAME}: export jobs`)
}

export const name = PACKAGE_NAME
