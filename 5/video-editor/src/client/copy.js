/**
 * Bilingual copy for the video workbench.
 *
 * Every visible string in the client half lives in this `videoEditor` locale
 * namespace (zh primary, en fallback). `installCopy(ctx)` registers both
 * dictionaries through `ctx.effect`, binds the namespace, and exposes a tiny
 * observable revision so mounted components can re-render on language change.
 */

const NS = 'videoEditor'

export const zh = {
  'view.label': '剪辑工作台',
  'view.subtitle': '视频剪辑',

  'opener.title': '剪辑工作台',
  'opener.detail': '导入素材、时间轴剪辑、导出视频',

  'dock.label': '剪辑工作台',
  'dock.summary': '{count} 素材 · {time}',
  'dock.hint': '点击打开',

  'toolbar.titlePlaceholder': '未命名剪辑',
  'toolbar.titleEdit': '双击重命名',
  'toolbar.canvas': '画布',
  'toolbar.fps': '帧率',
  'toolbar.undo': '撤销',
  'toolbar.redo': '重做',
  'toolbar.import': '导入',
  'toolbar.export': '导出',
  'toolbar.custom': '自定义',
  'toolbar.ffmpegMissing': 'ffmpeg 不可用',
  'toolbar.ffmpegHint': '导出已禁用；插件 bin 目录缺少 ffmpeg / ffprobe',
  'toolbar.busy': '同步中…',

  'preset.landscape1080': '1080p 横屏',
  'preset.landscape720': '720p 横屏',
  'preset.portrait1080': '1080p 竖屏',
  'preset.square1080': '1080 × 1080',
  'preset.uhd4k': '4K 横屏',

  'bin.title': '素材',
  'bin.count': '{count} 个',
  'bin.import': '导入',
  'bin.path': '路径',
  'bin.pathPlaceholder': '粘贴本机视频路径，多个用换行或逗号分隔',
  'bin.pathConfirm': '导入',
  'bin.pathCancel': '取消',
  'bin.pathEmpty': '请输入至少一个路径',
  'bin.empty': '把视频拖到这里，或点击右上角导入',
  'bin.emptyHint': '支持 mp4 / mov / mkv / webm，可一次导入多个',
  'bin.dropHint': '松开以导入视频',
  'bin.uploading': '上传中…',
  'bin.addToTimeline': '添加到主轨道',
  'bin.remove': '移除素材',
  'bin.missing': '素材丢失',
  'bin.duration': '时长',
  'bin.noAudio': '无声',
  'bin.hasAudio': '有声',

  'preview.empty': '时间轴为空',
  'preview.emptyHint': '从素材库添加片段后在这里预览',
  'preview.play': '播放',
  'preview.pause': '暂停',
  'preview.prevFrame': '上一帧',
  'preview.nextFrame': '下一帧',
  'preview.volume': '音量',
  'preview.fit': '适合窗口',
  'preview.actual': '100%',
  'preview.frame': '{frame} / {total}',
  'preview.error': '浏览器无法播放该素材',
  'preview.hint': '空格 播放/暂停',

  'timeline.title': '时间轴',
  'timeline.total': '总时长',
  'timeline.zoom': '缩放',
  'timeline.fit': '适配',
  'timeline.trackMain': '主视频',
  'timeline.trackOverlay': '叠加层',
  'timeline.mainHint': '磁性轨道 · 按顺序首尾相连',
  'timeline.overlayHint': '自由位置 · 拖动调整起点',
  'timeline.empty': '从素材库添加片段，或把视频拖到这里',
  'timeline.dropHere': '松开添加到主轨道',
  'timeline.reorder': '拖动调整顺序',
  'timeline.trim': '拖动裁剪入点 / 出点',
  'timeline.shortcuts': '空格 播放/暂停 · S 切分 · Del 删除 · ←/→ 逐帧 · Ctrl+Z 撤销',
  'timeline.clip': '片段',
  'timeline.gap': '空隙',
  'timeline.split': '切分',
  'timeline.splitAtPlayhead': '在播放头处切分',
  'timeline.deleteClip': '删除所选片段',

  'export.title': '导出视频',
  'export.filename': '文件名',
  'export.quality': '画质',
  'export.qualityHigh': '高清（较慢）',
  'export.qualityFast': '快速',
  'export.start': '导出',
  'export.close': '关闭',
  'export.download': '下载',
  'export.done': '导出完成',
  'export.failed': '导出失败',
  'export.queued': '排队中…',
  'export.running': '渲染中…',
  'export.progress': '{percent}%',
  'export.outputPath': '文件位置',
  'export.openHint': '在文件管理器中打开所在文件夹',
  'export.ffmpegMissing': 'ffmpeg 不可用，无法导出。请确认插件 bin 目录内包含 ffmpeg.exe 与 ffprobe.exe。',
  'export.empty': '时间轴为空，先添加片段再导出',
  'export.cancelJob': '取消任务',
  'export.again': '再导出一次',

  'error.title': '工作台出错了',
  'error.retry': '重试',
  'error.load': '无法加载项目状态',
  'error.upload': '上传失败：{message}',
  'error.op': '操作失败：{message}',
  'error.generic': '发生未预期的错误',
  'error.noSession': '当前会话不可用，无法打开剪辑工作台',

  'common.busy': '处理中…',
  'common.seconds': '{value} 秒',
  'common.close': '关闭',
  'common.unknown': '未知',
}

export const en = {
  'view.label': 'Video workbench',
  'view.subtitle': 'Editing',

  'opener.title': 'Video workbench',
  'opener.detail': 'Import media, cut a timeline, export a video',

  'dock.label': 'Video workbench',
  'dock.summary': '{count} media · {time}',
  'dock.hint': 'click to open',

  'toolbar.titlePlaceholder': 'Untitled edit',
  'toolbar.titleEdit': 'Double-click to rename',
  'toolbar.canvas': 'Canvas',
  'toolbar.fps': 'FPS',
  'toolbar.undo': 'Undo',
  'toolbar.redo': 'Redo',
  'toolbar.import': 'Import',
  'toolbar.export': 'Export',
  'toolbar.custom': 'Custom',
  'toolbar.ffmpegMissing': 'ffmpeg unavailable',
  'toolbar.ffmpegHint': 'Export disabled: ffmpeg / ffprobe missing from the plugin bin directory',
  'toolbar.busy': 'Syncing…',

  'preset.landscape1080': '1080p landscape',
  'preset.landscape720': '720p landscape',
  'preset.portrait1080': '1080p portrait',
  'preset.square1080': '1080 × 1080',
  'preset.uhd4k': '4K landscape',

  'bin.title': 'Media',
  'bin.count': '{count}',
  'bin.import': 'Import',
  'bin.path': 'Path',
  'bin.pathPlaceholder': 'Paste local video paths, one per line or comma separated',
  'bin.pathConfirm': 'Import',
  'bin.pathCancel': 'Cancel',
  'bin.pathEmpty': 'Enter at least one path',
  'bin.empty': 'Drop videos here, or use Import above',
  'bin.emptyHint': 'mp4 / mov / mkv / webm, several at once',
  'bin.dropHint': 'Release to import videos',
  'bin.uploading': 'Uploading…',
  'bin.addToTimeline': 'Add to main track',
  'bin.remove': 'Remove media',
  'bin.missing': 'Media missing',
  'bin.duration': 'Duration',
  'bin.noAudio': 'no audio',
  'bin.hasAudio': 'audio',

  'preview.empty': 'Timeline is empty',
  'preview.emptyHint': 'Add clips from the media bin to preview here',
  'preview.play': 'Play',
  'preview.pause': 'Pause',
  'preview.prevFrame': 'Previous frame',
  'preview.nextFrame': 'Next frame',
  'preview.volume': 'Volume',
  'preview.fit': 'Fit',
  'preview.actual': '100%',
  'preview.frame': '{frame} / {total}',
  'preview.error': 'This media cannot be played by the browser',
  'preview.hint': 'Space play/pause',

  'timeline.title': 'Timeline',
  'timeline.total': 'Duration',
  'timeline.zoom': 'Zoom',
  'timeline.fit': 'Fit',
  'timeline.trackMain': 'Main',
  'timeline.trackOverlay': 'Overlay',
  'timeline.mainHint': 'magnetic · clips are contiguous',
  'timeline.overlayHint': 'free position · drag to move start',
  'timeline.empty': 'Add a clip from the media bin, or drop a video here',
  'timeline.dropHere': 'Release to add to the main track',
  'timeline.reorder': 'Drag to reorder',
  'timeline.trim': 'Drag to trim the in / out point',
  'timeline.shortcuts': 'Space play/pause · S split · Del delete · ←/→ frame · Ctrl+Z undo',
  'timeline.clip': 'clip',
  'timeline.gap': 'gap',
  'timeline.split': 'Split',
  'timeline.splitAtPlayhead': 'Split at playhead',
  'timeline.deleteClip': 'Delete selected clip',

  'export.title': 'Export video',
  'export.filename': 'File name',
  'export.quality': 'Quality',
  'export.qualityHigh': 'High (slower)',
  'export.qualityFast': 'Fast',
  'export.start': 'Export',
  'export.close': 'Close',
  'export.download': 'Download',
  'export.done': 'Export finished',
  'export.failed': 'Export failed',
  'export.queued': 'Queued…',
  'export.running': 'Rendering…',
  'export.progress': '{percent}%',
  'export.outputPath': 'File location',
  'export.openHint': 'Open the containing folder in your file manager',
  'export.ffmpegMissing': 'ffmpeg is unavailable, so export is disabled. Make sure ffmpeg.exe and ffprobe.exe exist in the plugin bin directory.',
  'export.empty': 'The timeline is empty; add a clip before exporting',
  'export.cancelJob': 'Cancel job',
  'export.again': 'Export another',

  'error.title': 'The workbench hit an error',
  'error.retry': 'Retry',
  'error.load': 'Could not load the project state',
  'error.upload': 'Upload failed: {message}',
  'error.op': 'Operation failed: {message}',
  'error.generic': 'Unexpected error',
  'error.noSession': 'This session is unavailable, so the workbench cannot open',

  'common.busy': 'Working…',
  'common.seconds': '{value}s',
  'common.close': 'Close',
  'common.unknown': 'unknown',
}

/** Local dictionary fallback used when the locale service is unavailable (tests). */
export function translate(key, params) {
  const raw = zh[key] ?? en[key] ?? key
  return String(raw).replace(/\{(\w+)\}/g, (match, name) => (
    params !== null && params !== undefined && Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : match
  ))
}

/**
 * Register the dictionaries and expose the bound `t` plus a revision source.
 * @param {object} ctx - client plugin context (`locale` and `effect` services).
 * @returns {{t: Function, getRevision: Function, subscribe: Function, dispose: Function}}
 */
export function installCopy(ctx) {
  const listeners = new Set()
  let revision = 0
  let bound = null

  const notify = () => {
    revision += 1
    for (const listener of listeners) {
      try {
        listener()
      } catch {
        // a subscriber must never break the locale bus
      }
    }
  }

  const fallback = (key, params) => translate(key, params)

  if (ctx !== null && ctx !== undefined && ctx.locale !== null && ctx.locale !== undefined && typeof ctx.locale.register === 'function') {
    try {
      ctx.effect(() => {
        const zhDispose = ctx.locale.register(NS, 'zh', zh)
        const enDispose = ctx.locale.register(NS, 'en', en)
        return () => {
          try {
            zhDispose()
          } catch {
            // already gone
          }
          try {
            enDispose()
          } catch {
            // already gone
          }
        }
      }, 'video-editor: dictionaries')

      if (typeof ctx.locale.bind === 'function') {
        const candidate = ctx.locale.bind(NS)
        if (typeof candidate === 'function') bound = candidate
      }

      ctx.effect(() => {
        const off = ctx.locale.subscribe(notify)
        return () => {
          try {
            off()
          } catch {
            // already gone
          }
          listeners.clear()
        }
      }, 'video-editor: locale subscription')
    } catch {
      bound = null
    }
  }

  const t = (key, params) => (bound === null ? fallback(key, params) : bound(key, params))

  return {
    t,
    getRevision: () => revision,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    dispose() {
      listeners.clear()
    },
    isBound: () => bound !== null,
  }
}
