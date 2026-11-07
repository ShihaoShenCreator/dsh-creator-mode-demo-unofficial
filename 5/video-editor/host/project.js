/**
 * Video project state machine.
 *
 * One project per Session. Every mutation goes through `apply()` so the HTTP
 * operation route and the agent tool share exactly one implementation, and the
 * undo stack records exactly one entry per accepted operation.
 *
 * The module is pure Node: no DSH services, no I/O except the caller-supplied
 * media library and the debounced JSON persistence hook.
 */

const DEFAULT_STATE = () => ({
  revision: 0,
  title: '未命名剪辑',
  width: 1920,
  height: 1080,
  fps: 30,
  media: [],
  clips: [],
})

const MIN_CLIP = 0.1

/** Round to 3 decimals so repeated float trimming stays stable. */
const round = (value) => Math.round(value * 1000) / 1000

export class ProjectError extends Error {
  constructor(message) {
    super(message)
    this.name = 'ProjectError'
  }
}

/** Compute the magnetic timeline layout from the clip list. */
export function layout(state) {
  const main = []
  let cursor = 0
  for (const clip of state.clips) {
    if (clip.track !== 0) continue
    const duration = round(clip.out - clip.in)
    const start = round(cursor)
    const end = round(cursor + duration)
    main.push({ clipId: clip.id, start, end, duration })
    cursor = end
  }
  const total = round(cursor)
  const overlays = []
  for (const clip of state.clips) {
    if (clip.track !== 1) continue
    const duration = round(clip.out - clip.in)
    // An overlay is a window INSIDE the programme, and the main track defines
    // the programme length. The rule matches what the renderer does when it
    // extends the overlay only `between(start, end)` inside the programme:
    //   - the requested start is respected (clamped into [0, total]);
    //   - the overlay is clipped at the programme end;
    //   - if clipping would leave nothing visible (the overlay was parked
    //     entirely past the end), it slides back so it still shows whole.
    // This is what keeps preview, timeline and export on the same numbers.
    const wanted = Math.min(duration, total)
    let start = Math.min(Math.max(0, clip.start ?? 0), total)
    let visible = round(Math.min(duration, total - start))
    if (visible < 0.01 && wanted >= 0.01) {
      start = round(Math.max(0, total - wanted))
      visible = wanted
    }
    overlays.push({ clipId: clip.id, start: round(start), end: round(start + visible), duration: visible })
  }
  return { main, overlays, duration: total }
}

/** Project timeline start of one clip, or undefined for an overlay. */
function clipStart(layoutOfState, clip) {
  const slice = layoutOfState.main.find((item) => item.clipId === clip.id)
  return slice?.start
}

/** Resolve a clip reference: exact id, or a 1-based index into the main track. */
function clipRef(state, ref, what = 'clip') {
  const layoutOfState = layout(state)
  if (typeof ref === 'string') {
    const exact = state.clips.find((clip) => clip.id === ref)
    if (exact !== undefined) return exact
    const nameMatch = ref.match(/^c?(\d+)$/)
    if (nameMatch !== null) return clipRef(state, Number(nameMatch[1]), what)
    throw new ProjectError(`找不到片段 ${ref}`)
  }
  if (typeof ref === 'number' && Number.isInteger(ref)) {
    if (ref < 1 || ref > layoutOfState.main.length) {
      throw new ProjectError(`片段序号 ${ref} 超出范围（当前主轨道共 ${layoutOfState.main.length} 段）`)
    }
    const id = layoutOfState.main[ref - 1].clipId
    return state.clips.find((clip) => clip.id === id)
  }
  throw new ProjectError(`${what} 参数无效`)
}

/** Resolve a media reference: exact id, exact name, or unique case-insensitive prefix of the name. */
export function resolveMedia(state, ref) {
  if (ref === undefined || ref === null || ref === '') throw new ProjectError('缺少素材参数')
  const needle = String(ref).trim()
  const exactId = state.media.find((item) => item.id === needle)
  if (exactId !== undefined) return exactId
  const exactName = state.media.find((item) => item.name === needle || item.sourcePath === needle)
  if (exactName !== undefined) return exactName
  const lower = needle.toLowerCase()
  const prefix = state.media.filter((item) => item.name.toLowerCase().startsWith(lower))
  if (prefix.length === 1) return prefix[0]
  const contains = state.media.filter((item) => item.name.toLowerCase().includes(lower))
  if (contains.length === 1) return contains[0]
  if (prefix.length > 1) {
    throw new ProjectError(`素材名 "${needle}" 命中多个（${prefix.map((item) => item.name).join('、')}），请用完整名称或 id`)
  }
  throw new ProjectError(`找不到素材 "${needle}"，可用素材：${state.media.map((item) => item.name).join('、') || '（空）'}`)
}

/**
 * Create the per-Session project registry.
 *
 * @param options.media - media library (probe / importFromPath / saveUpload)
 * @param options.read - `(sessionId) => Promise<object|null>` persisted document loader
 * @param options.write - `(sessionId, document) => Promise<void>` persisted document writer
 */
export function createProjects(options) {
  const media = options.media
  const read = options.read
  const write = options.write
  /** @type {Map<string, object>} */
  const states = new Map()
  /** @type {Map<string, {undo: object[], redo: object[]}>} */
  const histories = new Map()
  /** @type {Map<string, Promise<object>>} */
  const loading = new Map()
  /** @type {Map<string, ReturnType<typeof setTimeout>>} */
  const saves = new Map()

  function history(sessionId) {
    let entry = histories.get(sessionId)
    if (entry === undefined) {
      entry = { undo: [], redo: [] }
      histories.set(sessionId, entry)
    }
    return entry
  }

  function snapshot(state) {
    return {
      title: state.title,
      width: state.width,
      height: state.height,
      fps: state.fps,
      media: state.media.map((item) => ({ ...item })),
      clips: state.clips.map((clip) => ({ ...clip })),
    }
  }

  function restore(state, snap) {
    state.title = snap.title
    state.width = snap.width
    state.height = snap.height
    state.fps = snap.fps
    state.media = snap.media.map((item) => ({ ...item }))
    state.clips = snap.clips.map((clip) => ({ ...clip }))
  }

  function persist(sessionId, state) {
    const previous = saves.get(sessionId)
    if (previous !== undefined) clearTimeout(previous)
    const document = { version: 1, ...snapshot(state) }
    const timer = setTimeout(() => {
      saves.delete(sessionId)
      void write(sessionId, document).catch(() => {})
    }, 150)
    timer.unref?.()
    saves.set(sessionId, timer)
  }

  function nextId(items, prefix) {
    let max = 0
    for (const item of items) {
      const match = String(item.id).match(new RegExp(`^${prefix}(\\d+)$`))
      if (match !== null) max = Math.max(max, Number(match[1]))
    }
    return `${prefix}${max + 1}`
  }

  async function load(sessionId) {
    const existing = states.get(sessionId)
    if (existing !== undefined) return existing
    const pending = loading.get(sessionId)
    if (pending !== undefined) return pending
    const task = (async () => {
      let document = null
      try {
        document = await read(sessionId)
      } catch {
        document = null
      }
      const state = DEFAULT_STATE()
      if (document !== null && typeof document === 'object') {
        if (typeof document.title === 'string') state.title = document.title
        if (Number.isFinite(document.width)) state.width = Math.round(document.width)
        if (Number.isFinite(document.height)) state.height = Math.round(document.height)
        if (Number.isFinite(document.fps)) state.fps = Math.round(document.fps)
        if (Array.isArray(document.media)) state.media = document.media.filter((item) => item !== null && typeof item === 'object')
        if (Array.isArray(document.clips)) state.clips = document.clips.filter((item) => item !== null && typeof item === 'object')
        if (Number.isFinite(document.revision)) state.revision = Math.max(0, Math.round(document.revision))
      }
      states.set(sessionId, state)
      loading.delete(sessionId)
      return state
    })()
    loading.set(sessionId, task)
    return task
  }

  /** Build the wire state (adds derived timeline, urls, and undo availability). */
  function view(sessionId, state) {
    const base = `/video-editor/s/${sessionId}`
    const layoutOfState = layout(state)
    return {
      sessionId,
      revision: state.revision,
      title: state.title,
      width: state.width,
      height: state.height,
      fps: state.fps,
      media: state.media.map((item) => ({
        ...item,
        playUrl: `${base}/media/${item.id}`,
        posterUrl: `${base}/media/${item.id}/poster.jpg`,
        frameUrl: `${base}/media/${item.id}/frame.jpg`,
      })),
      clips: state.clips.map((clip) => ({ ...clip })),
      timeline: layoutOfState,
      canUndo: history(sessionId).undo.length > 0,
      canRedo: history(sessionId).redo.length > 0,
      updatedAt: state.updatedAt ?? Date.now(),
    }
  }

  /** Guard one clip's source window against its media duration. */
  function clampWindow(state, clipLike, fallbackMedia) {
    const item = fallbackMedia ?? state.media.find((entry) => entry.id === clipLike.mediaId)
    if (item === undefined) throw new ProjectError(`素材 ${clipLike.mediaId} 不存在`)
    const duration = item.duration
    let start = Number(clipLike.in ?? 0)
    let end = Number(clipLike.out ?? duration)
    if (!Number.isFinite(start)) start = 0
    if (!Number.isFinite(end)) end = duration
    start = Math.min(Math.max(0, start), Math.max(0, duration - MIN_CLIP))
    end = Math.min(Math.max(start + MIN_CLIP, end), duration)
    if (end <= start) throw new ProjectError('片段的出点必须晚于入点')
    return { in: round(start), out: round(end) }
  }

  function addClipTo(state, mediaItem, params) {
    const window = clampWindow(state, { mediaId: mediaItem.id, in: params.in, out: params.out }, mediaItem)
    const track = params.track === 1 ? 1 : 0
    const clip = {
      id: nextId(state.clips, 'c'),
      mediaId: mediaItem.id,
      track,
      in: window.in,
      out: window.out,
    }
    if (track === 1) {
      const duration = layout(state).duration
      if (duration <= MIN_CLIP) {
        // An overlay is painted ON the programme; with no main clips there is no
        // programme to paint on, and it would otherwise collapse to a zero-second
        // block that looks broken in the timeline.
        throw new ProjectError('叠加层需要先有主轨道片段：请先往主轨道添加一个片段')
      }
      // Keep the requested start in the clip record; `layout` is the pure
      // projection that decides how much of it is actually visible, so the user's
      // intent survives later edits to the main track.
      const fallback = Number.isFinite(params.start) ? params.start : duration
      clip.start = round(Math.max(0, fallback))
      clip.x = Math.round(Number.isFinite(params.x) ? params.x : Math.max(0, state.width * 0.05))
      clip.y = Math.round(Number.isFinite(params.y) ? params.y : Math.max(0, state.height * 0.6))
      clip.scale = Math.min(1, Math.max(0.05, Number.isFinite(params.scale) ? params.scale : 0.35))
    }
    state.clips.push(clip)
    return clip
  }

  /**
   * Apply one operation to a Session's project.
   * @returns the wire state after the mutation.
   */
  async function apply(sessionId, operation) {
    const state = await load(sessionId)
    const op = operation ?? {}
    if (typeof op !== 'object' || typeof op.type !== 'string') throw new ProjectError('缺少 op.type')
    const entry = history(sessionId)
    const before = snapshot(state)
    let changed = true

    switch (op.type) {
      case 'importPath': {
        const paths = Array.isArray(op.paths) ? op.paths : []
        if (paths.length === 0) throw new ProjectError('paths 不能为空')
        const added = []
        const skipped = []
        for (const candidate of paths) {
          if (typeof candidate !== 'string' || candidate.trim() === '') {
            skipped.push({ path: String(candidate), reason: 'invalid path' })
            continue
          }
          try {
            const resolvedPath = await options.resolvePath(candidate, sessionId)
            const duplicate = state.media.find((item) => item.sourcePath.toLowerCase() === resolvedPath.toLowerCase())
            if (duplicate !== undefined) {
              added.push(duplicate)
              continue
            }
            const metadata = await media.probe(resolvedPath)
            const item = {
              id: nextId(state.media, 'm'),
              name: basename(resolvedPath),
              sourcePath: resolvedPath,
              origin: 'path',
              duration: round(metadata.duration),
              width: metadata.width,
              height: metadata.height,
              fps: metadata.fps,
              hasAudio: metadata.hasAudio,
              size: metadata.size,
              addedAt: Date.now(),
            }
            state.media.push(item)
            added.push(item)
          } catch (error) {
            skipped.push({ path: candidate, reason: String(error?.message ?? error) })
          }
        }
        if (added.length === 0) {
          const reason = skipped.map((entry) => `${entry.path}: ${entry.reason}`).join('; ')
          throw new ProjectError(`没有导入任何素材（${reason}）`)
        }
        state.updatedAt = Date.now()
        break
      }
      case 'addMedia': {
        const item = op.media
        if (item === null || typeof item !== 'object') throw new ProjectError('缺少 media')
        const duplicate = state.media.find((entry) => entry.sourcePath.toLowerCase() === String(item.sourcePath).toLowerCase())
        if (duplicate !== undefined) {
          changed = false
          break
        }
        state.media.push({
          id: nextId(state.media, 'm'),
          name: String(item.name ?? '未命名素材'),
          sourcePath: String(item.sourcePath),
          origin: item.origin === 'upload' ? 'upload' : 'path',
          duration: round(item.duration),
          width: item.width,
          height: item.height,
          fps: item.fps,
          hasAudio: item.hasAudio === true,
          size: item.size,
          addedAt: Date.now(),
        })
        state.updatedAt = Date.now()
        break
      }
      case 'removeMedia': {
        const item = resolveMedia(state, op.mediaId)
        const used = state.clips.filter((clip) => clip.mediaId === item.id).length
        if (used > 0) throw new ProjectError(`「${item.name}」正被 ${used} 个片段使用，请先删除这些片段`)
        state.media = state.media.filter((entry) => entry.id !== item.id)
        state.updatedAt = Date.now()
        break
      }
      case 'addClip': {
        const item = resolveMedia(state, op.mediaId ?? op.media)
        addClipTo(state, item, op)
        state.updatedAt = Date.now()
        break
      }
      case 'trim': {
        const clip = clipRef(state, op.clipId ?? op.clip)
        const window = clampWindow(state, { mediaId: clip.mediaId, in: op.in, out: op.out })
        clip.in = window.in
        clip.out = window.out
        state.updatedAt = Date.now()
        break
      }
      case 'split': {
        const layoutOfState = layout(state)
        const clip = clipRef(state, op.clipId ?? op.clip)
        if (clip.track !== 0) throw new ProjectError('目前只能在主轨道上切分片段')
        const slice = layoutOfState.main.find((item) => item.clipId === clip.id)
        const at = Number.isFinite(op.at) ? round(op.at) : round(layoutOfState.duration)
        const offset = at - slice.start
        if (offset < MIN_CLIP || offset > slice.duration - MIN_CLIP) {
          throw new ProjectError(`切分点 ${at.toFixed(2)}s 落在片段 ${clip.id} 的边缘之外`)
        }
        const splitPoint = round(clip.in + offset)
        const tail = { ...clip, id: nextId(state.clips, 'c'), in: splitPoint }
        clip.out = splitPoint
        state.clips.splice(state.clips.indexOf(clip) + 1, 0, tail)
        state.updatedAt = Date.now()
        break
      }
      case 'delete': {
        const refs = Array.isArray(op.clipIds) ? op.clipIds : Array.isArray(op.clips) ? op.clips : []
        if (refs.length === 0) throw new ProjectError('clipIds 不能为空')
        const ids = refs.map((ref) => clipRef(state, ref).id)
        state.clips = state.clips.filter((clip) => !ids.includes(clip.id))
        state.updatedAt = Date.now()
        break
      }
      case 'move': {
        const clip = clipRef(state, op.clipId ?? op.clip)
        if (clip.track !== 0) throw new ProjectError('叠加层片段请用 updateOverlay 调整位置')
        const mainClips = state.clips.filter((entry) => entry.track === 0)
        const from = mainClips.indexOf(clip)
        const to = Math.min(Math.max(0, Math.round(Number(op.toIndex ?? from))), mainClips.length - 1)
        if (to === from) {
          changed = false
          break
        }
        mainClips.splice(from, 1)
        mainClips.splice(to, 0, clip)
        // Main-clip order is what the layout reads; overlay clips keep their own
        // array slots, so replace the main slots in place instead of rebuilding.
        let mainCursor = 0
        state.clips = state.clips.map((entry) => (entry.track === 0 ? mainClips[mainCursor++] : entry))
        state.updatedAt = Date.now()
        break
      }
      case 'updateOverlay': {
        const clip = clipRef(state, op.clipId ?? op.clip)
        if (clip.track !== 1) throw new ProjectError(`${clip.id} 不在叠加层`)
        if (Number.isFinite(op.start)) clip.start = round(Math.max(0, op.start))
        if (Number.isFinite(op.x)) clip.x = Math.round(op.x)
        if (Number.isFinite(op.y)) clip.y = Math.round(op.y)
        if (Number.isFinite(op.scale)) clip.scale = Math.min(1, Math.max(0.05, op.scale))
        state.updatedAt = Date.now()
        break
      }
      case 'setProject': {
        if (typeof op.title === 'string' && op.title.trim() !== '') state.title = op.title.trim().slice(0, 80)
        if (Number.isFinite(op.width)) state.width = Math.min(3840, Math.max(320, Math.round(op.width / 2) * 2))
        if (Number.isFinite(op.height)) state.height = Math.min(2160, Math.max(240, Math.round(op.height / 2) * 2))
        if (Number.isFinite(op.fps)) {
          const fps = Math.round(op.fps)
          if (![24, 25, 30, 50, 60].includes(fps)) throw new ProjectError('fps 仅支持 24 / 25 / 30 / 50 / 60')
          state.fps = fps
        }
        state.updatedAt = Date.now()
        break
      }
      case 'undo': {
        const previous = entry.undo.pop()
        if (previous === undefined) throw new ProjectError('没有可撤销的操作')
        entry.redo.push(before)
        restore(state, previous)
        state.revision += 1
        state.updatedAt = Date.now()
        persist(sessionId, state)
        return view(sessionId, state)
      }
      case 'redo': {
        const next = entry.redo.pop()
        if (next === undefined) throw new ProjectError('没有可重做的操作')
        entry.undo.push(before)
        restore(state, next)
        state.revision += 1
        state.updatedAt = Date.now()
        persist(sessionId, state)
        return view(sessionId, state)
      }
      default:
        throw new ProjectError(`未知操作 ${op.type}`)
    }

    if (!changed) {
      return view(sessionId, state)
    }
    entry.undo.push(before)
    if (entry.undo.length > 40) entry.undo.shift()
    entry.redo = []
    state.revision += 1
    persist(sessionId, state)
    return view(sessionId, state)
  }

  return {
    load,
    view,
    apply,
    history,
    layout,
  }
}

function basename(path) {
  const normalized = String(path).replace(/\\/g, '/')
  const index = normalized.lastIndexOf('/')
  return index === -1 ? normalized : normalized.slice(index + 1)
}
