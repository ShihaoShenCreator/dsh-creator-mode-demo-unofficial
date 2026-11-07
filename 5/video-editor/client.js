/**
 * Video editing workbench — generated client bundle.
 * Source lives in video-editor/src/client/; rebuild with: node tools/build.mjs
 */
window.__ModuleLoader__.load({
  id: '@local/video-editor',
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// video-editor/src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react8 = __toESM(require("react"), 1);

// video-editor/src/client/copy.js
var NS = "videoEditor";
var zh = {
  "view.label": "\u526A\u8F91\u5DE5\u4F5C\u53F0",
  "view.subtitle": "\u89C6\u9891\u526A\u8F91",
  "opener.title": "\u526A\u8F91\u5DE5\u4F5C\u53F0",
  "opener.detail": "\u5BFC\u5165\u7D20\u6750\u3001\u65F6\u95F4\u8F74\u526A\u8F91\u3001\u5BFC\u51FA\u89C6\u9891",
  "dock.label": "\u526A\u8F91\u5DE5\u4F5C\u53F0",
  "dock.summary": "{count} \u7D20\u6750 \xB7 {time}",
  "dock.hint": "\u70B9\u51FB\u6253\u5F00",
  "toolbar.titlePlaceholder": "\u672A\u547D\u540D\u526A\u8F91",
  "toolbar.titleEdit": "\u53CC\u51FB\u91CD\u547D\u540D",
  "toolbar.canvas": "\u753B\u5E03",
  "toolbar.fps": "\u5E27\u7387",
  "toolbar.undo": "\u64A4\u9500",
  "toolbar.redo": "\u91CD\u505A",
  "toolbar.import": "\u5BFC\u5165",
  "toolbar.export": "\u5BFC\u51FA",
  "toolbar.custom": "\u81EA\u5B9A\u4E49",
  "toolbar.ffmpegMissing": "ffmpeg \u4E0D\u53EF\u7528",
  "toolbar.ffmpegHint": "\u5BFC\u51FA\u5DF2\u7981\u7528\uFF1B\u63D2\u4EF6 bin \u76EE\u5F55\u7F3A\u5C11 ffmpeg / ffprobe",
  "toolbar.busy": "\u540C\u6B65\u4E2D\u2026",
  "preset.landscape1080": "1080p \u6A2A\u5C4F",
  "preset.landscape720": "720p \u6A2A\u5C4F",
  "preset.portrait1080": "1080p \u7AD6\u5C4F",
  "preset.square1080": "1080 \xD7 1080",
  "preset.uhd4k": "4K \u6A2A\u5C4F",
  "bin.title": "\u7D20\u6750",
  "bin.count": "{count} \u4E2A",
  "bin.import": "\u5BFC\u5165",
  "bin.path": "\u8DEF\u5F84",
  "bin.pathPlaceholder": "\u7C98\u8D34\u672C\u673A\u89C6\u9891\u8DEF\u5F84\uFF0C\u591A\u4E2A\u7528\u6362\u884C\u6216\u9017\u53F7\u5206\u9694",
  "bin.pathConfirm": "\u5BFC\u5165",
  "bin.pathCancel": "\u53D6\u6D88",
  "bin.pathEmpty": "\u8BF7\u8F93\u5165\u81F3\u5C11\u4E00\u4E2A\u8DEF\u5F84",
  "bin.empty": "\u628A\u89C6\u9891\u62D6\u5230\u8FD9\u91CC\uFF0C\u6216\u70B9\u51FB\u53F3\u4E0A\u89D2\u5BFC\u5165",
  "bin.emptyHint": "\u652F\u6301 mp4 / mov / mkv / webm\uFF0C\u53EF\u4E00\u6B21\u5BFC\u5165\u591A\u4E2A",
  "bin.dropHint": "\u677E\u5F00\u4EE5\u5BFC\u5165\u89C6\u9891",
  "bin.uploading": "\u4E0A\u4F20\u4E2D\u2026",
  "bin.addToTimeline": "\u6DFB\u52A0\u5230\u4E3B\u8F68\u9053",
  "bin.remove": "\u79FB\u9664\u7D20\u6750",
  "bin.missing": "\u7D20\u6750\u4E22\u5931",
  "bin.duration": "\u65F6\u957F",
  "bin.noAudio": "\u65E0\u58F0",
  "bin.hasAudio": "\u6709\u58F0",
  "preview.empty": "\u65F6\u95F4\u8F74\u4E3A\u7A7A",
  "preview.emptyHint": "\u4ECE\u7D20\u6750\u5E93\u6DFB\u52A0\u7247\u6BB5\u540E\u5728\u8FD9\u91CC\u9884\u89C8",
  "preview.play": "\u64AD\u653E",
  "preview.pause": "\u6682\u505C",
  "preview.prevFrame": "\u4E0A\u4E00\u5E27",
  "preview.nextFrame": "\u4E0B\u4E00\u5E27",
  "preview.volume": "\u97F3\u91CF",
  "preview.fit": "\u9002\u5408\u7A97\u53E3",
  "preview.actual": "100%",
  "preview.frame": "{frame} / {total}",
  "preview.error": "\u6D4F\u89C8\u5668\u65E0\u6CD5\u64AD\u653E\u8BE5\u7D20\u6750",
  "preview.hint": "\u7A7A\u683C \u64AD\u653E/\u6682\u505C",
  "timeline.title": "\u65F6\u95F4\u8F74",
  "timeline.total": "\u603B\u65F6\u957F",
  "timeline.zoom": "\u7F29\u653E",
  "timeline.fit": "\u9002\u914D",
  "timeline.trackMain": "\u4E3B\u89C6\u9891",
  "timeline.trackOverlay": "\u53E0\u52A0\u5C42",
  "timeline.mainHint": "\u78C1\u6027\u8F68\u9053 \xB7 \u6309\u987A\u5E8F\u9996\u5C3E\u76F8\u8FDE",
  "timeline.overlayHint": "\u81EA\u7531\u4F4D\u7F6E \xB7 \u62D6\u52A8\u8C03\u6574\u8D77\u70B9",
  "timeline.empty": "\u4ECE\u7D20\u6750\u5E93\u6DFB\u52A0\u7247\u6BB5\uFF0C\u6216\u628A\u89C6\u9891\u62D6\u5230\u8FD9\u91CC",
  "timeline.dropHere": "\u677E\u5F00\u6DFB\u52A0\u5230\u4E3B\u8F68\u9053",
  "timeline.reorder": "\u62D6\u52A8\u8C03\u6574\u987A\u5E8F",
  "timeline.trim": "\u62D6\u52A8\u88C1\u526A\u5165\u70B9 / \u51FA\u70B9",
  "timeline.shortcuts": "\u7A7A\u683C \u64AD\u653E/\u6682\u505C \xB7 S \u5207\u5206 \xB7 Del \u5220\u9664 \xB7 \u2190/\u2192 \u9010\u5E27 \xB7 Ctrl+Z \u64A4\u9500",
  "timeline.clip": "\u7247\u6BB5",
  "timeline.gap": "\u7A7A\u9699",
  "timeline.split": "\u5207\u5206",
  "timeline.splitAtPlayhead": "\u5728\u64AD\u653E\u5934\u5904\u5207\u5206",
  "timeline.deleteClip": "\u5220\u9664\u6240\u9009\u7247\u6BB5",
  "export.title": "\u5BFC\u51FA\u89C6\u9891",
  "export.filename": "\u6587\u4EF6\u540D",
  "export.quality": "\u753B\u8D28",
  "export.qualityHigh": "\u9AD8\u6E05\uFF08\u8F83\u6162\uFF09",
  "export.qualityFast": "\u5FEB\u901F",
  "export.start": "\u5BFC\u51FA",
  "export.close": "\u5173\u95ED",
  "export.download": "\u4E0B\u8F7D",
  "export.done": "\u5BFC\u51FA\u5B8C\u6210",
  "export.failed": "\u5BFC\u51FA\u5931\u8D25",
  "export.queued": "\u6392\u961F\u4E2D\u2026",
  "export.running": "\u6E32\u67D3\u4E2D\u2026",
  "export.progress": "{percent}%",
  "export.outputPath": "\u6587\u4EF6\u4F4D\u7F6E",
  "export.openHint": "\u5728\u6587\u4EF6\u7BA1\u7406\u5668\u4E2D\u6253\u5F00\u6240\u5728\u6587\u4EF6\u5939",
  "export.ffmpegMissing": "ffmpeg \u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u5BFC\u51FA\u3002\u8BF7\u786E\u8BA4\u63D2\u4EF6 bin \u76EE\u5F55\u5185\u5305\u542B ffmpeg.exe \u4E0E ffprobe.exe\u3002",
  "export.empty": "\u65F6\u95F4\u8F74\u4E3A\u7A7A\uFF0C\u5148\u6DFB\u52A0\u7247\u6BB5\u518D\u5BFC\u51FA",
  "export.cancelJob": "\u53D6\u6D88\u4EFB\u52A1",
  "export.again": "\u518D\u5BFC\u51FA\u4E00\u6B21",
  "error.title": "\u5DE5\u4F5C\u53F0\u51FA\u9519\u4E86",
  "error.retry": "\u91CD\u8BD5",
  "error.load": "\u65E0\u6CD5\u52A0\u8F7D\u9879\u76EE\u72B6\u6001",
  "error.upload": "\u4E0A\u4F20\u5931\u8D25\uFF1A{message}",
  "error.op": "\u64CD\u4F5C\u5931\u8D25\uFF1A{message}",
  "error.generic": "\u53D1\u751F\u672A\u9884\u671F\u7684\u9519\u8BEF",
  "error.noSession": "\u5F53\u524D\u4F1A\u8BDD\u4E0D\u53EF\u7528\uFF0C\u65E0\u6CD5\u6253\u5F00\u526A\u8F91\u5DE5\u4F5C\u53F0",
  "common.busy": "\u5904\u7406\u4E2D\u2026",
  "common.seconds": "{value} \u79D2",
  "common.close": "\u5173\u95ED",
  "common.unknown": "\u672A\u77E5"
};
var en = {
  "view.label": "Video workbench",
  "view.subtitle": "Editing",
  "opener.title": "Video workbench",
  "opener.detail": "Import media, cut a timeline, export a video",
  "dock.label": "Video workbench",
  "dock.summary": "{count} media \xB7 {time}",
  "dock.hint": "click to open",
  "toolbar.titlePlaceholder": "Untitled edit",
  "toolbar.titleEdit": "Double-click to rename",
  "toolbar.canvas": "Canvas",
  "toolbar.fps": "FPS",
  "toolbar.undo": "Undo",
  "toolbar.redo": "Redo",
  "toolbar.import": "Import",
  "toolbar.export": "Export",
  "toolbar.custom": "Custom",
  "toolbar.ffmpegMissing": "ffmpeg unavailable",
  "toolbar.ffmpegHint": "Export disabled: ffmpeg / ffprobe missing from the plugin bin directory",
  "toolbar.busy": "Syncing\u2026",
  "preset.landscape1080": "1080p landscape",
  "preset.landscape720": "720p landscape",
  "preset.portrait1080": "1080p portrait",
  "preset.square1080": "1080 \xD7 1080",
  "preset.uhd4k": "4K landscape",
  "bin.title": "Media",
  "bin.count": "{count}",
  "bin.import": "Import",
  "bin.path": "Path",
  "bin.pathPlaceholder": "Paste local video paths, one per line or comma separated",
  "bin.pathConfirm": "Import",
  "bin.pathCancel": "Cancel",
  "bin.pathEmpty": "Enter at least one path",
  "bin.empty": "Drop videos here, or use Import above",
  "bin.emptyHint": "mp4 / mov / mkv / webm, several at once",
  "bin.dropHint": "Release to import videos",
  "bin.uploading": "Uploading\u2026",
  "bin.addToTimeline": "Add to main track",
  "bin.remove": "Remove media",
  "bin.missing": "Media missing",
  "bin.duration": "Duration",
  "bin.noAudio": "no audio",
  "bin.hasAudio": "audio",
  "preview.empty": "Timeline is empty",
  "preview.emptyHint": "Add clips from the media bin to preview here",
  "preview.play": "Play",
  "preview.pause": "Pause",
  "preview.prevFrame": "Previous frame",
  "preview.nextFrame": "Next frame",
  "preview.volume": "Volume",
  "preview.fit": "Fit",
  "preview.actual": "100%",
  "preview.frame": "{frame} / {total}",
  "preview.error": "This media cannot be played by the browser",
  "preview.hint": "Space play/pause",
  "timeline.title": "Timeline",
  "timeline.total": "Duration",
  "timeline.zoom": "Zoom",
  "timeline.fit": "Fit",
  "timeline.trackMain": "Main",
  "timeline.trackOverlay": "Overlay",
  "timeline.mainHint": "magnetic \xB7 clips are contiguous",
  "timeline.overlayHint": "free position \xB7 drag to move start",
  "timeline.empty": "Add a clip from the media bin, or drop a video here",
  "timeline.dropHere": "Release to add to the main track",
  "timeline.reorder": "Drag to reorder",
  "timeline.trim": "Drag to trim the in / out point",
  "timeline.shortcuts": "Space play/pause \xB7 S split \xB7 Del delete \xB7 \u2190/\u2192 frame \xB7 Ctrl+Z undo",
  "timeline.clip": "clip",
  "timeline.gap": "gap",
  "timeline.split": "Split",
  "timeline.splitAtPlayhead": "Split at playhead",
  "timeline.deleteClip": "Delete selected clip",
  "export.title": "Export video",
  "export.filename": "File name",
  "export.quality": "Quality",
  "export.qualityHigh": "High (slower)",
  "export.qualityFast": "Fast",
  "export.start": "Export",
  "export.close": "Close",
  "export.download": "Download",
  "export.done": "Export finished",
  "export.failed": "Export failed",
  "export.queued": "Queued\u2026",
  "export.running": "Rendering\u2026",
  "export.progress": "{percent}%",
  "export.outputPath": "File location",
  "export.openHint": "Open the containing folder in your file manager",
  "export.ffmpegMissing": "ffmpeg is unavailable, so export is disabled. Make sure ffmpeg.exe and ffprobe.exe exist in the plugin bin directory.",
  "export.empty": "The timeline is empty; add a clip before exporting",
  "export.cancelJob": "Cancel job",
  "export.again": "Export another",
  "error.title": "The workbench hit an error",
  "error.retry": "Retry",
  "error.load": "Could not load the project state",
  "error.upload": "Upload failed: {message}",
  "error.op": "Operation failed: {message}",
  "error.generic": "Unexpected error",
  "error.noSession": "This session is unavailable, so the workbench cannot open",
  "common.busy": "Working\u2026",
  "common.seconds": "{value}s",
  "common.close": "Close",
  "common.unknown": "unknown"
};
function translate(key, params) {
  const raw = zh[key] ?? en[key] ?? key;
  return String(raw).replace(/\{(\w+)\}/g, (match, name) => params !== null && params !== void 0 && Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match);
}
function installCopy(ctx) {
  const listeners = /* @__PURE__ */ new Set();
  let revision = 0;
  let bound = null;
  const notify = () => {
    revision += 1;
    for (const listener of listeners) {
      try {
        listener();
      } catch {
      }
    }
  };
  const fallback = (key, params) => translate(key, params);
  if (ctx !== null && ctx !== void 0 && ctx.locale !== null && ctx.locale !== void 0 && typeof ctx.locale.register === "function") {
    try {
      ctx.effect(() => {
        const zhDispose = ctx.locale.register(NS, "zh", zh);
        const enDispose = ctx.locale.register(NS, "en", en);
        return () => {
          try {
            zhDispose();
          } catch {
          }
          try {
            enDispose();
          } catch {
          }
        };
      }, "video-editor: dictionaries");
      if (typeof ctx.locale.bind === "function") {
        const candidate = ctx.locale.bind(NS);
        if (typeof candidate === "function") bound = candidate;
      }
      ctx.effect(() => {
        const off = ctx.locale.subscribe(notify);
        return () => {
          try {
            off();
          } catch {
          }
          listeners.clear();
        };
      }, "video-editor: locale subscription");
    } catch {
      bound = null;
    }
  }
  const t = (key, params) => bound === null ? fallback(key, params) : bound(key, params);
  return {
    t,
    getRevision: () => revision,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    dispose() {
      listeners.clear();
    },
    isBound: () => bound !== null
  };
}

// video-editor/src/client/styles.js
var STYLE_TAG_ID = "video-editor";
var css = `
.ve-root {
  --ve-bg: #101216;
  --ve-panel: #171a21;
  --ve-panel-2: #1f232c;
  --ve-line: #2b303b;
  --ve-text: #e6e9ef;
  --ve-dim: #98a1b0;
  --ve-accent: #4c8dff;
  --ve-accent-2: #7aa8ff;
  --ve-danger: #ff5f57;
  --ve-warn: #e7b24c;
  --ve-track: #12151a;
  --ve-shadow: 0 12px 32px rgba(0, 0, 0, .55);
  --ve-radius: 6px;
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--ve-bg);
  color: var(--ve-text);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}
.ve-root * { box-sizing: border-box; }
.ve-num, .ve-timecode, .ve-clock, .ve-ruler-label, .ve-transport-time, .ve-duration { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }

/* ---------------------------------------------------------------- toolbar */
.ve-toolbar {
  flex: 0 0 40px;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  background: var(--ve-panel);
  border-bottom: 1px solid var(--ve-line);
  user-select: none;
}
.ve-brand { display: flex; align-items: center; gap: 8px; color: var(--ve-dim); flex: 0 0 auto; }
.ve-brand svg { display: block; }
.ve-brand-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ve-accent); flex: 0 0 auto; }
.ve-title {
  flex: 0 1 auto;
  min-width: 60px;
  max-width: 320px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: var(--ve-radius);
  background: transparent;
  color: var(--ve-text);
  font: inherit;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}
.ve-title:hover { border-color: var(--ve-line); background: var(--ve-panel-2); }
.ve-title-input { border-color: var(--ve-accent); background: var(--ve-bg); outline: none; }
.ve-spacer { flex: 1 1 auto; }
.ve-field { display: flex; align-items: center; gap: 4px; color: var(--ve-dim); flex: 0 0 auto; }
.ve-field-label { font-size: 11px; letter-spacing: .02em; }
.ve-select {
  height: 24px;
  padding: 0 4px;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-panel-2);
  color: var(--ve-text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.ve-select:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 1px; }
.ve-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  min-width: 24px;
  padding: 0 6px;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-panel-2);
  color: var(--ve-text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.ve-icon-btn:hover:not(:disabled) { border-color: var(--ve-accent-2); color: #fff; }
.ve-icon-btn:disabled { opacity: .45; cursor: default; }
.ve-icon-btn:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 1px; }
.ve-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-panel-2);
  color: var(--ve-text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.ve-btn:hover:not(:disabled) { border-color: var(--ve-accent-2); }
.ve-btn:disabled { opacity: .45; cursor: default; }
.ve-btn:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 1px; }
.ve-btn-primary { border-color: #2f5fae; background: #21406e; color: #fff; }
.ve-btn-primary:hover:not(:disabled) { border-color: var(--ve-accent); background: #27508a; }
.ve-btn-danger { border-color: #6a2b2b; background: #3a1d1d; color: #ffd7d5; }
.ve-btn-danger:hover:not(:disabled) { border-color: var(--ve-danger); }
.ve-btn-ghost { border-color: transparent; background: transparent; color: var(--ve-dim); }
.ve-btn-ghost:hover:not(:disabled) { border-color: var(--ve-line); color: var(--ve-text); }
.ve-warn-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid #5a4520;
  border-radius: var(--ve-radius);
  background: #2a2213;
  color: var(--ve-warn);
  font-size: 11px;
  white-space: nowrap;
}
.ve-busy-chip { display: inline-flex; align-items: center; gap: 6px; height: 22px; color: var(--ve-dim); font-size: 11px; }

/* ------------------------------------------------------------------- main */
.ve-main { flex: 1 1 auto; min-height: 0; display: flex; align-items: stretch; }

/* ---------------------------------------------------------------- media bin */
.ve-bin {
  flex: 0 0 224px;
  width: 224px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--ve-panel);
  border-right: 1px solid var(--ve-line);
  position: relative;
}
.ve-bin-head {
  flex: 0 0 32px;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-bottom: 1px solid var(--ve-line);
}
.ve-bin-title { font-weight: 600; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: var(--ve-text); }
.ve-bin-count { color: var(--ve-dim); font-size: 11px; }
.ve-bin-grow { flex: 1 1 auto; }
.ve-bin-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 4px 0 24px; }
.ve-bin-list::-webkit-scrollbar { width: 10px; }
.ve-bin-list::-webkit-scrollbar-thumb { background: #2f3541; border-radius: 5px; }
.ve-bin-list::-webkit-scrollbar-track { background: transparent; }
.ve-bin-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-left: 2px solid transparent;
  cursor: grab;
  position: relative;
}
.ve-bin-row:hover { background: var(--ve-panel-2); border-left-color: var(--ve-accent-2); }
.ve-bin-row:active { cursor: grabbing; }
.ve-bin-thumb {
  flex: 0 0 64px;
  width: 64px;
  height: 36px;
  border-radius: 3px;
  overflow: hidden;
  background: #0b0d11;
  border: 1px solid var(--ve-line);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4a5160;
}
.ve-bin-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ve-bin-meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ve-bin-name {
  font-size: 11px;
  color: var(--ve-text);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.25;
  word-break: break-all;
}
.ve-bin-sub { display: flex; align-items: center; gap: 5px; color: var(--ve-dim); font-size: 10px; }
.ve-bin-sub .ve-dot { width: 2px; height: 2px; border-radius: 50%; background: var(--ve-dim); }
.ve-bin-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .1s linear; }
.ve-bin-row:hover .ve-bin-actions, .ve-bin-row:focus-within .ve-bin-actions { opacity: 1; }
.ve-mini-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--ve-dim);
  cursor: pointer;
}
.ve-mini-btn:hover { border-color: var(--ve-line); background: var(--ve-bg); color: var(--ve-text); }
.ve-mini-btn-danger:hover { border-color: #6a2b2b; color: #ff9c98; }
.ve-mini-btn:focus-visible { outline: 1px solid var(--ve-accent); }
.ve-bin-empty {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 16px;
  text-align: center;
  color: var(--ve-dim);
}
.ve-bin-empty svg { opacity: .5; }
.ve-bin-empty-title { color: var(--ve-text); font-size: 12px; }
.ve-bin-empty-hint { font-size: 10.5px; line-height: 1.5; color: var(--ve-dim); }
.ve-bin-drop {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  background: rgba(16, 18, 22, .88);
  border: 1px dashed var(--ve-accent);
  color: var(--ve-accent-2);
  font-size: 12px;
  text-align: center;
  padding: 12px;
}
.ve-bin-pathbar {
  flex: 0 0 auto;
  border-top: 1px solid var(--ve-line);
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--ve-panel-2);
}
.ve-textarea {
  width: 100%;
  min-height: 52px;
  resize: vertical;
  padding: 5px 6px;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-bg);
  color: var(--ve-text);
  font: inherit;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
}
.ve-textarea:focus { outline: 1px solid var(--ve-accent); outline-offset: -1px; }
.ve-row-end { display: flex; justify-content: flex-end; gap: 6px; }
.ve-inline-error { color: var(--ve-danger); font-size: 10.5px; line-height: 1.4; }
.ve-bin-uploading {
  flex: 0 0 auto;
  padding: 6px 8px;
  border-top: 1px solid var(--ve-line);
  color: var(--ve-accent-2);
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ---------------------------------------------------------------- preview */
.ve-preview-pane {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  background: var(--ve-bg);
  position: relative;
}
.ve-stage-wrap {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 14px;
  background:
    radial-gradient(circle at 50% 40%, rgba(76, 141, 255, .035), transparent 60%),
    var(--ve-bg);
  overflow: hidden;
}
.ve-stage {
  position: relative;
  background: #000;
  box-shadow: 0 0 0 1px var(--ve-line), 0 10px 26px rgba(0, 0, 0, .5);
  overflow: hidden;
  max-width: 100%;
  max-height: 100%;
}
.ve-stage-fill { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.ve-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  display: block;
}
.ve-overlay-video {
  position: absolute;
  object-fit: cover;
  background: #000;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .6);
  pointer-events: none;
}
.ve-stage-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--ve-dim);
  background:
    repeating-linear-gradient(45deg, #0c0e12, #0c0e12 8px, #0e1015 8px, #0e1015 16px);
  text-align: center;
  padding: 16px;
}
.ve-stage-empty-title { color: var(--ve-text); font-size: 12px; }
.ve-stage-empty-hint { font-size: 11px; color: var(--ve-dim); }
.ve-stage-badge {
  position: absolute;
  left: 6px;
  top: 6px;
  z-index: 3;
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, .6);
  color: var(--ve-dim);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.ve-stage-error {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  z-index: 3;
  padding: 3px 8px;
  border-radius: 3px;
  background: rgba(58, 20, 20, .9);
  border: 1px solid #6a2b2b;
  color: #ffc9c7;
  font-size: 10.5px;
  white-space: nowrap;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* transport */
.ve-transport {
  flex: 0 0 36px;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-top: 1px solid var(--ve-line);
  background: var(--ve-panel);
  user-select: none;
}
.ve-play-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-panel-2);
  color: var(--ve-text);
  cursor: pointer;
}
.ve-play-btn:hover { border-color: var(--ve-accent); color: #fff; }
.ve-play-btn-active { border-color: var(--ve-accent); background: #21406e; color: #fff; }
.ve-play-btn:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 1px; }
.ve-transport-time { display: flex; align-items: baseline; gap: 4px; font-size: 11px; color: var(--ve-text); }
.ve-transport-current { color: var(--ve-text); font-weight: 600; }
.ve-transport-sep { color: var(--ve-dim); }
.ve-transport-total { color: var(--ve-dim); }
.ve-transport-frame { color: var(--ve-dim); font-size: 10px; }
.ve-volume { display: flex; align-items: center; gap: 4px; color: var(--ve-dim); }
.ve-range {
  -webkit-appearance: none;
  appearance: none;
  height: 14px;
  background: transparent;
  cursor: pointer;
}
.ve-range::-webkit-slider-runnable-track { height: 3px; border-radius: 2px; background: var(--ve-line); }
.ve-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  margin-top: -3.5px;
  border-radius: 50%;
  background: var(--ve-accent-2);
  border: 0;
}
.ve-range::-moz-range-track { height: 3px; border-radius: 2px; background: var(--ve-line); }
.ve-range::-moz-range-thumb { width: 10px; height: 10px; border-radius: 50%; background: var(--ve-accent-2); border: 0; }
.ve-range:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 2px; }
.ve-volume-range { width: 68px; }
.ve-transport-grow { flex: 1 1 auto; }
.ve-transport-hint { color: var(--ve-dim); font-size: 10px; opacity: .8; }

/* --------------------------------------------------------------- timeline */
.ve-timeline {
  flex: 0 0 42%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  background: var(--ve-panel);
  border-top: 1px solid var(--ve-line);
  position: relative;
  outline: none;
}
.ve-timeline:focus-visible { box-shadow: inset 0 0 0 1px rgba(76, 141, 255, .55); }
.ve-tl-head {
  flex: 0 0 30px;
  height: 30px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border-bottom: 1px solid var(--ve-line);
  user-select: none;
}
.ve-tl-title { font-weight: 600; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
.ve-tl-grow { flex: 1 1 auto; }
.ve-tl-total { display: flex; align-items: center; gap: 5px; color: var(--ve-dim); font-size: 11px; }
.ve-tl-total .ve-timecode { color: var(--ve-text); }
.ve-zoom { display: flex; align-items: center; gap: 5px; color: var(--ve-dim); font-size: 10.5px; }
.ve-zoom-range { width: 88px; }
.ve-zoom-value { color: var(--ve-dim); font-variant-numeric: tabular-nums; min-width: 42px; text-align: right; font-size: 10px; }
.ve-tl-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.ve-tl-labels {
  flex: 0 0 84px;
  width: 84px;
  border-right: 1px solid var(--ve-line);
  background: var(--ve-panel);
  display: flex;
  flex-direction: column;
  user-select: none;
}
.ve-labels-spacer { height: 26px; flex: 0 0 26px; border-bottom: 1px solid var(--ve-line); }
.ve-track-label {
  flex: 0 0 56px;
  height: 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 0 8px;
  border-top: 1px solid var(--ve-line);
}
.ve-track-label-name { font-size: 11px; color: var(--ve-text); display: flex; align-items: center; gap: 5px; }
.ve-track-label-dot { width: 5px; height: 5px; border-radius: 50%; }
.ve-track-label-dot-main { background: var(--ve-accent); }
.ve-track-label-dot-overlay { background: var(--ve-warn); }
.ve-track-label-hint { font-size: 9.5px; color: var(--ve-dim); line-height: 1.3; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ve-tl-scroll { flex: 1 1 auto; min-width: 0; overflow: auto; position: relative; }
.ve-tl-scroll::-webkit-scrollbar { height: 10px; width: 10px; }
.ve-tl-scroll::-webkit-scrollbar-thumb { background: #2f3541; border-radius: 5px; }
.ve-tl-scroll::-webkit-scrollbar-track { background: #0d0f13; }
.ve-tl-content { position: relative; min-height: 100%; }
.ve-ruler {
  position: sticky;
  top: 0;
  z-index: 4;
  height: 26px;
  min-width: 100%;
  background: var(--ve-panel);
  border-bottom: 1px solid var(--ve-line);
  cursor: pointer;
  user-select: none;
}
.ve-ruler-tick { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--ve-line); }
.ve-ruler-tick-major { background: #3a4150; }
.ve-ruler-label {
  position: absolute;
  top: 5px;
  padding-left: 3px;
  font-size: 9.5px;
  color: var(--ve-dim);
  white-space: nowrap;
  pointer-events: none;
}
.ve-track-row {
  position: relative;
  height: 56px;
  min-width: 100%;
  background: var(--ve-track);
  border-top: 1px solid var(--ve-line);
}
.ve-track-row-empty {
  background-image: repeating-linear-gradient(90deg, rgba(255, 255, 255, .02) 0, rgba(255, 255, 255, .02) 1px, transparent 1px, transparent 64px);
}
.ve-track-drop { position: absolute; inset: 0; border: 1px dashed var(--ve-accent); background: rgba(76, 141, 255, .1); pointer-events: none; z-index: 3; }
.ve-tl-empty {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 34px;
  height: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--ve-dim);
  border: 1px dashed #363d4a;
  border-radius: 6px;
  background: rgba(23, 26, 33, .35);
  pointer-events: none;
  z-index: 2;
}
.ve-tl-empty-title { color: var(--ve-text); font-size: 12px; }
.ve-tl-empty-hint { font-size: 10.5px; }
.ve-tl-hintbar {
  flex: 0 0 20px;
  height: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-top: 1px solid var(--ve-line);
  color: var(--ve-dim);
  font-size: 9.5px;
  background: var(--ve-panel);
  white-space: nowrap;
  overflow: hidden;
  user-select: none;
}
.ve-tl-hint-key { color: #b9c1d0; }

/* clips */
.ve-clip {
  position: absolute;
  top: 4px;
  bottom: 4px;
  border-radius: 3px;
  overflow: hidden;
  background: #191d25;
  border: 1px solid #3a4150;
  border-top-width: 2px;
  cursor: grab;
  z-index: 1;
  contain: paint;
}
.ve-clip-main { border-top-color: var(--ve-accent); }
.ve-clip-overlay { border-top-color: var(--ve-warn); }
.ve-clip:hover { border-color: var(--ve-accent-2); z-index: 2; }
.ve-clip-selected { border-color: var(--ve-accent); box-shadow: 0 0 0 1px var(--ve-accent) inset; z-index: 2; }
.ve-clip-dragging { opacity: .55; z-index: 3; cursor: grabbing; }
.ve-clip-droptarget { box-shadow: inset 3px 0 0 var(--ve-accent-2); }
.ve-clip-strip { position: absolute; inset: 0; display: flex; overflow: hidden; }
.ve-clip-frame {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #0b0d11;
  border-right: 1px solid rgba(0, 0, 0, .5);
  user-select: none;
  -webkit-user-drag: none;
}
.ve-clip-frame-fallback {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  background: linear-gradient(135deg, #1b202a, #141821);
  border-right: 1px solid rgba(0, 0, 0, .5);
}
.ve-clip-shade {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 18px;
  background: linear-gradient(rgba(8, 10, 14, .88), rgba(8, 10, 14, .28));
  pointer-events: none;
}
.ve-clip-label {
  position: absolute;
  left: 5px;
  right: 5px;
  top: 2px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #eef1f7;
  text-shadow: 0 1px 2px #000;
  pointer-events: none;
  overflow: hidden;
}
.ve-clip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.ve-clip-dur { margin-left: auto; color: #b9c1d0; font-variant-numeric: tabular-nums; }
.ve-clip-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  z-index: 2;
  background: transparent;
}
.ve-clip-handle:hover, .ve-clip-handle-active { background: linear-gradient(90deg, rgba(122, 168, 255, .55), rgba(122, 168, 255, .05)); }
.ve-clip-handle-left { left: 0; border-left: 2px solid transparent; }
.ve-clip-handle-right { right: 0; border-right: 2px solid transparent; }
.ve-clip-handle-left:hover { border-left-color: var(--ve-accent-2); }
.ve-clip-handle-right:hover { border-right-color: var(--ve-accent-2); }
.ve-clip-badge {
  position: absolute;
  right: 4px;
  bottom: 3px;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, .62);
  color: #c9d1e0;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
.ve-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--ve-danger);
  z-index: 5;
  pointer-events: none;
}
.ve-playhead::before {
  content: '';
  position: absolute;
  top: 0;
  left: -5px;
  width: 12px;
  height: 8px;
  background: var(--ve-danger);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.ve-playhead-handle {
  position: absolute;
  top: 0;
  width: 18px;
  height: 26px;
  margin-left: -9px;
  z-index: 6;
  cursor: ew-resize;
}

/* ------------------------------------------------------------------ modal */
.ve-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 8, 11, .72);
  backdrop-filter: blur(2px);
  padding: 16px;
}
.ve-modal {
  width: 420px;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
  border-radius: 8px;
  border: 1px solid var(--ve-line);
  background: var(--ve-panel);
  box-shadow: var(--ve-shadow);
  color: var(--ve-text);
}
.ve-modal-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ve-line);
}
.ve-modal-title { font-weight: 600; font-size: 12px; }
.ve-modal-grow { flex: 1 1 auto; }
.ve-modal-body { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
.ve-modal-foot { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--ve-line); }
.ve-form-row { display: flex; flex-direction: column; gap: 4px; }
.ve-form-label { color: var(--ve-dim); font-size: 10.5px; letter-spacing: .02em; }
.ve-input {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-bg);
  color: var(--ve-text);
  font: inherit;
  font-size: 11px;
}
.ve-input:focus { outline: 1px solid var(--ve-accent); outline-offset: -1px; }
.ve-input-mono { font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace; }
.ve-progress {
  height: 8px;
  border-radius: 4px;
  background: #0b0d11;
  border: 1px solid var(--ve-line);
  overflow: hidden;
}
.ve-progress-bar { height: 100%; background: linear-gradient(90deg, #2f6fd0, var(--ve-accent-2)); transition: width .2s linear; }
.ve-progress-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--ve-dim); }
.ve-progress-percent { margin-left: auto; color: var(--ve-text); font-variant-numeric: tabular-nums; }
.ve-output-path {
  padding: 5px 7px;
  border-radius: 4px;
  border: 1px solid var(--ve-line);
  background: var(--ve-bg);
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  font-size: 10px;
  color: var(--ve-dim);
  word-break: break-all;
  max-height: 64px;
  overflow: auto;
}
.ve-modal-note { color: var(--ve-dim); font-size: 10.5px; line-height: 1.5; }
.ve-modal-error {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #6a2b2b;
  background: #2a1616;
  color: #ffb4b1;
  font-size: 10.5px;
  word-break: break-word;
}
.ve-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: var(--ve-radius);
  border: 1px solid #2f5fae;
  background: #21406e;
  color: #fff;
  font-size: 11px;
  text-decoration: none;
  white-space: nowrap;
}
.ve-link:hover { border-color: var(--ve-accent); background: #27508a; }

/* -------------------------------------------------------------- error card */
.ve-error-card {
  margin: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #6a2b2b;
  background: #241717;
  color: #ffd0ce;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
}
.ve-error-card-body { flex: 1 1 auto; min-width: 0; }
.ve-error-card-title { color: #ff9c98; font-weight: 600; margin-bottom: 2px; }
.ve-error-card-detail { color: #e7bcba; font-size: 10.5px; word-break: break-word; }
.ve-error-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 10px 0;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #6a2b2b;
  background: #241717;
  color: #ffb4b1;
  font-size: 10.5px;
}
.ve-error-inline-body { flex: 1 1 auto; min-width: 0; word-break: break-word; }

/* ------------------------------------------------------------- opener row */
.ve-opener-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ve-text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
}
.ve-opener-row:hover { background: var(--ve-panel-2); }
.ve-opener-row:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: -2px; }
.ve-opener-icon { display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; color: var(--ve-accent-2); flex: 0 0 auto; }
.ve-opener-label { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ve-opener-title { font-size: 12px; color: var(--ve-text); }
.ve-opener-detail { font-size: 10px; color: var(--ve-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* -------------------------------------------------------------- dock strip */
.ve-dock {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--ve-line);
  border-radius: 8px;
  background: var(--ve-panel);
  color: var(--ve-dim);
  font-size: 11px;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  cursor: pointer;
  width: 100%;
  text-align: left;
  user-select: none;
}
.ve-dock:hover { border-color: #3d4657; color: var(--ve-text); }
.ve-dock:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 1px; }
.ve-dock-icon { display: flex; align-items: center; color: var(--ve-accent-2); flex: 0 0 auto; }
.ve-dock-label { color: var(--ve-text); font-size: 11px; white-space: nowrap; }
.ve-dock-meta { color: var(--ve-dim); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ve-dock-grow { flex: 1 1 auto; min-width: 4px; }
.ve-dock-hint { color: var(--ve-dim); font-size: 10px; opacity: .68; white-space: nowrap; }
.ve-dock-dot { width: 4px; height: 4px; border-radius: 50%; background: #3d4657; flex: 0 0 auto; }

/* ---------------------------------------------------------------- spinner */
.ve-spin { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid rgba(122, 168, 255, .35); border-top-color: var(--ve-accent-2); animation: ve-spin .8s linear infinite; }
@keyframes ve-spin { to { transform: rotate(360deg); } }
`;
function insertStyles() {
  const doc = typeof document === "undefined" ? void 0 : document;
  if (doc === void 0) return () => {
  };
  const selector = `style[data-plugin-css="${STYLE_TAG_ID}"]`;
  const existing = doc.querySelector(selector);
  if (existing !== null) return () => {
  };
  const tag = doc.createElement("style");
  tag.dataset.plugin = "@local/video-editor";
  tag.dataset.pluginCss = STYLE_TAG_ID;
  tag.textContent = css;
  doc.head.appendChild(tag);
  return () => {
    try {
      tag.remove();
    } catch {
    }
  };
}

// video-editor/src/client/api.js
var import_react = __toESM(require("react"), 1);
var ROUTE_PREFIX = "/video-editor";
var SESSION_RE = /^[A-Za-z0-9._-]{1,120}$/;
var STATE_POLL_MS = 900;
var DOCK_POLL_MS = 1500;
var EXPORT_POLL_MS = 600;
function isSessionId(value) {
  return typeof value === "string" && SESSION_RE.test(value);
}
function sessionBase(sessionId) {
  const id = typeof sessionId === "string" ? sessionId : "";
  return `${ROUTE_PREFIX}/s/${encodeURIComponent(id)}`;
}
function stateUrl(sessionId) {
  return `${sessionBase(sessionId)}/state`;
}
function opUrl(sessionId) {
  return `${sessionBase(sessionId)}/op`;
}
function mediaUploadUrl(sessionId) {
  return `${sessionBase(sessionId)}/media`;
}
function importUrl(sessionId) {
  return `${sessionBase(sessionId)}/import`;
}
function pingUrl(sessionId) {
  return `${sessionBase(sessionId)}/ping`;
}
function exportUrl(sessionId, jobId) {
  return jobId === void 0 ? `${sessionBase(sessionId)}/export` : `${sessionBase(sessionId)}/export/${encodeURIComponent(jobId)}`;
}
function exportFileUrl(sessionId, jobId) {
  return `${exportUrl(sessionId, jobId)}/file`;
}
function playUrl(sessionId, mediaId) {
  return `${sessionBase(sessionId)}/media/${encodeURIComponent(mediaId)}`;
}
function posterUrl(sessionId, mediaId) {
  return `${sessionBase(sessionId)}/media/${encodeURIComponent(mediaId)}/poster.jpg`;
}
function frameUrl(sessionId, mediaId, time) {
  const stamp = Math.max(0, Math.round((Number.isFinite(time) ? time : 0) * 1e3) / 1e3);
  return `${sessionBase(sessionId)}/media/${encodeURIComponent(mediaId)}/frame.jpg?t=${stamp}`;
}
async function readJson(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
async function requestJson(url, init) {
  let response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    return { ok: false, error: String(error && error.message || error || "network error"), network: true };
  }
  const payload = await readJson(response);
  if (!response.ok) {
    const message = payload !== null && typeof payload === "object" && payload.error !== void 0 ? String(payload.error) : `HTTP ${response.status}`;
    return { ok: false, error: message, status: response.status, payload };
  }
  if (payload === null || typeof payload !== "object") {
    return { ok: false, error: "\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON" };
  }
  if (payload.ok === false) {
    return { ok: false, error: String(payload.error === void 0 ? "\u64CD\u4F5C\u5931\u8D25" : payload.error) };
  }
  return { ok: true, payload };
}
function jsonInit(body) {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  };
}
function guardSession(sessionId) {
  return isSessionId(sessionId);
}
async function getState(sessionId) {
  if (!guardSession(sessionId)) return { ok: false, error: "invalid session id" };
  const result = await requestJson(stateUrl(sessionId), { method: "GET" });
  if (!result.ok) return result;
  const state = result.payload.state;
  return state !== null && typeof state === "object" ? { ok: true, state, payload: result.payload } : { ok: false, error: "missing state" };
}
async function postOp(sessionId, op) {
  if (!guardSession(sessionId)) return { ok: false, error: "invalid session id" };
  const result = await requestJson(opUrl(sessionId), jsonInit({ op }));
  if (!result.ok) return result;
  const state = result.payload.state;
  return state !== null && typeof state === "object" ? { ok: true, state, payload: result.payload } : { ok: false, error: "missing state" };
}
async function uploadMedia(sessionId, file) {
  if (!guardSession(sessionId)) return { ok: false, error: "invalid session id" };
  if (file === null || file === void 0) return { ok: false, error: "no file" };
  const name = typeof file.name === "string" && file.name !== "" ? file.name : "upload.mp4";
  let response;
  try {
    response = await fetch(mediaUploadUrl(sessionId), {
      method: "POST",
      headers: {
        "content-type": typeof file.type === "string" && file.type !== "" ? file.type : "application/octet-stream",
        "x-file-name": encodeURIComponent(name)
      },
      body: file
    });
  } catch (error) {
    return { ok: false, error: String(error && error.message || error || "network error"), network: true };
  }
  const payload = await readJson(response);
  if (!response.ok) {
    return { ok: false, error: String(payload && payload.error !== void 0 ? payload.error : `HTTP ${response.status}`) };
  }
  if (payload === null || typeof payload !== "object") return { ok: false, error: "\u54CD\u5E94\u4E0D\u662F\u5408\u6CD5 JSON" };
  if (payload.ok === false) return { ok: false, error: String(payload.error === void 0 ? "\u4E0A\u4F20\u5931\u8D25" : payload.error) };
  return { ok: true, state: payload.state, media: payload.media, payload };
}
async function importPaths(sessionId, paths) {
  if (!guardSession(sessionId)) return { ok: false, error: "invalid session id" };
  const result = await requestJson(importUrl(sessionId), jsonInit({ paths }));
  if (!result.ok) return result;
  return {
    ok: true,
    state: result.payload.state,
    imported: Array.isArray(result.payload.imported) ? result.payload.imported : [],
    skipped: Array.isArray(result.payload.skipped) ? result.payload.skipped : []
  };
}
async function getPing(sessionId) {
  if (!guardSession(sessionId)) return { ok: false, error: "invalid session id" };
  const result = await requestJson(pingUrl(sessionId), { method: "GET" });
  if (!result.ok) return result;
  return { ok: true, ping: result.payload };
}
async function startExport(sessionId, request) {
  if (!guardSession(sessionId)) return { ok: false, error: "invalid session id" };
  const result = await requestJson(exportUrl(sessionId), jsonInit(request === null || request === void 0 ? {} : request));
  if (!result.ok) return result;
  const payload = result.payload;
  const job = payload.job !== null && typeof payload.job === "object" ? payload.job : null;
  const jobId = typeof payload.jobId === "string" ? payload.jobId : job !== null ? job.id : null;
  if (jobId === null) return { ok: false, error: "\u5BFC\u51FA\u4EFB\u52A1\u7F3A\u5C11 id" };
  return { ok: true, jobId, job, state: payload.state };
}
async function getExportJob(sessionId, jobId) {
  if (!guardSession(sessionId) || typeof jobId !== "string" || jobId === "") {
    return { ok: false, error: "invalid export job" };
  }
  const result = await requestJson(exportUrl(sessionId, jobId), { method: "GET" });
  if (!result.ok) return result;
  const job = result.payload.job;
  if (job === null || typeof job !== "object") return { ok: false, error: "missing job" };
  return { ok: true, job };
}
function useWorkbench(sessionId) {
  const [state, setState] = import_react.default.useState(null);
  const [error, setError] = import_react.default.useState(null);
  const [busy, setBusy] = import_react.default.useState(false);
  const [loading, setLoading] = import_react.default.useState(true);
  const stateRef = import_react.default.useRef(null);
  const revisionRef = import_react.default.useRef(-1);
  const busyRef = import_react.default.useRef(false);
  const aliveRef = import_react.default.useRef(true);
  const adopt = import_react.default.useCallback((next) => {
    if (next === null || typeof next !== "object") return false;
    const revision = Number.isFinite(next.revision) ? next.revision : 0;
    if (revision === revisionRef.current) {
      stateRef.current = next;
      return false;
    }
    revisionRef.current = revision;
    stateRef.current = next;
    setState(next);
    return true;
  }, []);
  const refresh = import_react.default.useCallback(async () => {
    const result = await getState(sessionId);
    if (!aliveRef.current) return result;
    if (result.ok) {
      adopt(result.state);
      setError(null);
    } else {
      setError(result.error);
    }
    setLoading(false);
    return result;
  }, [sessionId, adopt]);
  import_react.default.useEffect(() => {
    aliveRef.current = true;
    revisionRef.current = -1;
    setLoading(true);
    void refresh();
    let timer = 0;
    const canPoll = () => typeof document === "undefined" ? true : document.visibilityState === "visible";
    const tick = () => {
      if (busyRef.current || !aliveRef.current || !canPoll()) return;
      void getState(sessionId).then((result) => {
        if (!aliveRef.current) return;
        if (result.ok) {
          adopt(result.state);
          setLoading(false);
        } else {
          setError(result.error);
        }
      });
    };
    timer = setInterval(tick, STATE_POLL_MS);
    const onVisibility = () => {
      if (canPoll()) tick();
    };
    if (typeof document !== "undefined" && typeof document.addEventListener === "function") {
      document.addEventListener("visibilitychange", onVisibility);
    }
    return () => {
      aliveRef.current = false;
      clearInterval(timer);
      if (typeof document !== "undefined" && typeof document.removeEventListener === "function") {
        document.removeEventListener("visibilitychange", onVisibility);
      }
    };
  }, [sessionId, refresh, adopt]);
  const op = import_react.default.useCallback(async (payload) => {
    busyRef.current = true;
    setBusy(true);
    try {
      const result = await postOp(sessionId, payload);
      if (!aliveRef.current) return result;
      if (result.ok) {
        adopt(result.state);
        setError(null);
      } else {
        setError(result.error);
      }
      return result;
    } finally {
      busyRef.current = false;
      if (aliveRef.current) setBusy(false);
    }
  }, [sessionId, adopt]);
  const clearError = import_react.default.useCallback(() => setError(null), []);
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
    sessionId
  };
}
function usePing(sessionId) {
  const [ping, setPing] = import_react.default.useState(null);
  import_react.default.useEffect(() => {
    let alive = true;
    void getPing(sessionId).then((result) => {
      if (!alive) return;
      if (result.ok) {
        const payload = result.ping;
        setPing({
          ffmpeg: payload !== null && typeof payload === "object" && payload.ffmpeg !== null && typeof payload.ffmpeg === "object" ? payload.ffmpeg : { available: false },
          ffprobe: payload !== null && typeof payload === "object" && payload.ffprobe !== null && typeof payload.ffprobe === "object" ? payload.ffprobe : { available: false }
        });
      } else {
        setPing({ ffmpeg: { available: false }, ffprobe: { available: false }, error: result.error });
      }
    });
    return () => {
      alive = false;
    };
  }, [sessionId]);
  return ping;
}
function createDockPoller() {
  const sessions = /* @__PURE__ */ new Map();
  let disposed = false;
  function stop(sessionId) {
    const entry = sessions.get(sessionId);
    if (entry === void 0) return;
    sessions.delete(sessionId);
    if (entry.timer !== 0) clearInterval(entry.timer);
  }
  function publish(sessionId, snapshot) {
    const entry = sessions.get(sessionId);
    if (entry === void 0) return;
    entry.snapshot = snapshot;
    for (const listener of entry.listeners) {
      try {
        listener(snapshot);
      } catch {
      }
    }
  }
  function tick(sessionId) {
    const entry = sessions.get(sessionId);
    if (entry === void 0 || entry.inFlight) return;
    if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
    entry.inFlight = true;
    void getState(sessionId).then((result) => {
      const current = sessions.get(sessionId);
      if (current === void 0) return;
      current.inFlight = false;
      if (!result.ok) return;
      const layout = result.state.timeline !== null && typeof result.state.timeline === "object" ? result.state.timeline : null;
      const duration = layout !== null && Number.isFinite(layout.duration) ? layout.duration : 0;
      publish(sessionId, {
        count: Array.isArray(result.state.media) ? result.state.media.length : 0,
        duration,
        revision: result.state.revision
      });
    }, () => {
      const current = sessions.get(sessionId);
      if (current !== void 0) current.inFlight = false;
    });
  }
  return {
    subscribe(sessionId, listener) {
      if (disposed || !isSessionId(sessionId) || typeof listener !== "function") return () => {
      };
      let entry = sessions.get(sessionId);
      if (entry === void 0) {
        entry = { listeners: /* @__PURE__ */ new Set(), timer: 0, snapshot: null, inFlight: false };
        sessions.set(sessionId, entry);
      }
      entry.listeners.add(listener);
      if (entry.snapshot !== null) listener(entry.snapshot);
      if (entry.listeners.size === 1) {
        entry.timer = setInterval(() => tick(sessionId), DOCK_POLL_MS);
        tick(sessionId);
      }
      return () => {
        const current = sessions.get(sessionId);
        if (current === void 0) return;
        current.listeners.delete(listener);
        if (current.listeners.size === 0) stop(sessionId);
      };
    },
    dispose() {
      disposed = true;
      for (const sessionId of [...sessions.keys()]) stop(sessionId);
      sessions.clear();
    }
  };
}

// video-editor/src/client/Workbench.jsx
var import_react7 = __toESM(require("react"), 1);

// video-editor/src/client/timebus.js
function createTimeBus(initial) {
  let time = Number.isFinite(initial) ? initial : 0;
  const listeners = /* @__PURE__ */ new Set();
  return {
    get() {
      return time;
    },
    set(next) {
      if (!Number.isFinite(next) || next === time) return;
      time = next;
      for (const listener of listeners) {
        try {
          listener(time);
        } catch {
        }
      }
    },
    /** Force a publish even when the value did not change (after a seek). */
    emit() {
      for (const listener of listeners) {
        try {
          listener(time);
        } catch {
        }
      }
    },
    subscribe(listener) {
      listeners.add(listener);
      try {
        listener(time);
      } catch {
      }
      return () => {
        listeners.delete(listener);
      };
    },
    reset(next) {
      time = Number.isFinite(next) ? next : 0;
      this.emit();
    }
  };
}

// video-editor/src/client/model.js
var MIN_CLIP = 0.2;
var ZOOM_MIN = 40;
var ZOOM_MAX = 400;
var ZOOM_DEFAULT = 110;
var RULER_HEIGHT = 26;
var TRACK_HEIGHT = 56;
var EMPTY_LAYOUT = { main: [], overlays: [], duration: 0 };
function roundTime(value) {
  return Math.round(value * 1e3) / 1e3;
}
function clampNumber(value, low, high) {
  if (!Number.isFinite(value)) return low;
  return Math.min(Math.max(value, low), high);
}
function formatClock(seconds) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const minutes = Math.floor(total / 60);
  const rest = total % 60;
  return `${String(minutes).padStart(2, "0")}:${String(rest).padStart(2, "0")}`;
}
function formatTimecode(seconds, fps) {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const value = Math.max(0, Number.isFinite(seconds) ? seconds : 0);
  const totalSeconds = Math.floor(value);
  const minutes = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  let frames = Math.floor((value - totalSeconds) * safeFps + 1e-6);
  if (frames >= safeFps) frames = safeFps - 1;
  return `${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}:${String(frames).padStart(2, "0")}`;
}
function frameOfTime(seconds, fps) {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  return Math.max(0, Math.round((Number.isFinite(seconds) ? seconds : 0) * safeFps));
}
function totalFrames(duration, fps) {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  return Math.max(0, Math.round((Number.isFinite(duration) ? duration : 0) * safeFps));
}
function stepFrame(seconds, fps, direction) {
  const safeFps = Number.isFinite(fps) && fps > 0 ? fps : 30;
  const frame = Math.round((Number.isFinite(seconds) ? seconds : 0) * safeFps);
  return Math.max(0, (frame + Math.sign(direction)) / safeFps);
}
function chooseStep(pxPerSec) {
  const target = 64;
  const candidates = [1, 2, 5, 10, 30, 60, 120, 300, 600];
  for (const candidate of candidates) {
    if (candidate * pxPerSec >= target) return candidate;
  }
  return 600;
}
function clipDuration(clip) {
  if (clip === null || clip === void 0) return 0;
  const from = Number(clip.in);
  const to = Number(clip.out);
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0;
  return roundTime(Math.max(0, to - from));
}
function layoutClips(clips) {
  const list = Array.isArray(clips) ? clips : [];
  const main = [];
  let cursor = 0;
  for (const clip of list) {
    if (clip === null || clip === void 0 || clip.track !== 0) continue;
    const duration = clipDuration(clip);
    const start = roundTime(cursor);
    main.push({ clipId: clip.id, start, end: roundTime(cursor + duration), duration });
    cursor = roundTime(cursor + duration);
  }
  const total = roundTime(cursor);
  const overlays = [];
  for (const clip of list) {
    if (clip === null || clip === void 0 || clip.track !== 1) continue;
    const duration = clipDuration(clip);
    const wanted = Math.min(duration, total);
    let start = Math.min(Math.max(0, Number.isFinite(clip.start) ? clip.start : 0), total);
    let visible = roundTime(Math.min(duration, total - start));
    if (visible < 0.01 && wanted >= 0.01) {
      start = roundTime(Math.max(0, total - wanted));
      visible = wanted;
    }
    overlays.push({ clipId: clip.id, start: roundTime(start), end: roundTime(start + visible), duration: visible });
  }
  return { main, overlays, duration: total };
}
function layoutOfState(state) {
  if (state === null || state === void 0) return EMPTY_LAYOUT;
  return layoutClips(state.clips);
}
function clipAtTime(layout, time) {
  if (layout === null || layout === void 0 || layout.main.length === 0) return null;
  const target = Number.isFinite(time) ? time : 0;
  for (const slice of layout.main) {
    if (target >= slice.start && target < slice.end) return slice;
  }
  if (target <= 0) return layout.main[0];
  const last = layout.main[layout.main.length - 1];
  return target >= last.end ? last : null;
}
function reorderIndexAt(layout, seconds, draggedId) {
  if (layout === null || layout === void 0) return 0;
  let index = 0;
  for (const slice of layout.main) {
    if (slice.clipId === draggedId) continue;
    if (seconds >= (slice.start + slice.end) / 2) index += 1;
  }
  return index;
}
function filmstripTimes(clip, count) {
  const total = Math.max(1, Math.round(count));
  const duration = clipDuration(clip);
  if (duration <= 0) return [];
  const from = Number(clip.in) || 0;
  const times = [];
  for (let index = 0; index < total; index += 1) {
    const offset = duration * (index + 0.5) / total;
    times.push(roundTime(Math.min(from + offset, Number(clip.out) - 1e-3)));
  }
  return times;
}
function overlayRect(clip, state) {
  const width = state !== null && state !== void 0 && Number.isFinite(state.width) ? state.width : 1920;
  const height = state !== null && state !== void 0 && Number.isFinite(state.height) ? state.height : 1080;
  const x = Number.isFinite(clip?.x) ? clip.x : 0;
  const y = Number.isFinite(clip?.y) ? clip.y : 0;
  const scale = clampNumber(Number.isFinite(clip?.scale) ? clip.scale : 0.35, 0.05, 1);
  return {
    left: `${x / width * 100}%`,
    top: `${y / height * 100}%`,
    width: `${scale * 100}%`
  };
}
function clampSeek(seconds, duration) {
  const total = Number.isFinite(duration) ? Math.max(0, duration) : 0;
  return clampNumber(Number.isFinite(seconds) ? seconds : 0, 0, total);
}
function fitZoom(duration, viewportWidth, min = ZOOM_MIN, max = ZOOM_MAX) {
  const safeWidth = Number.isFinite(viewportWidth) ? viewportWidth : 0;
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 0;
  if (safeDuration <= 0) return ZOOM_DEFAULT;
  return clampNumber(safeWidth / safeDuration, min, max);
}
function hasClip(state, clipId) {
  if (clipId === null || clipId === void 0) return false;
  const clips = state !== null && state !== void 0 && Array.isArray(state.clips) ? state.clips : [];
  return clips.some((clip) => clip !== null && clip !== void 0 && clip.id === clipId);
}

// video-editor/src/client/MediaBin.jsx
var import_react3 = __toESM(require("react"), 1);

// video-editor/src/client/icons.jsx
var import_react2 = __toESM(require("react"), 1);
function svg(props, children, viewBox) {
  return import_react2.default.createElement(
    "svg",
    {
      width: props.size === void 0 ? 14 : props.size,
      height: props.size === void 0 ? 14 : props.size,
      viewBox: viewBox === void 0 ? "0 0 16 16" : viewBox,
      fill: "currentColor",
      stroke: "none",
      "aria-hidden": "true",
      focusable: "false",
      style: { display: "block", flex: "0 0 auto" },
      className: props.className
    },
    children
  );
}
function FilmIcon(props) {
  return svg(props, [
    import_react2.default.createElement("rect", {
      key: "r",
      x: 1.75,
      y: 2.75,
      width: 12.5,
      height: 10.5,
      rx: 1.2,
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1.4
    }),
    import_react2.default.createElement("path", {
      key: "p",
      d: "M5.25 2.75v10.5M10.75 2.75v10.5M1.75 7.2h3.5M1.75 9.4h3.5M10.75 7.2h3.5M10.75 9.4h3.5",
      fill: "none",
      stroke: "currentColor",
      "stroke-width": 1,
      opacity: 0.6
    })
  ]);
}
function PlayIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M5 3.2l7.6 4.8-7.6 4.8z", fill: "currentColor", stroke: "none" })
  ]);
}
function PauseIcon(props) {
  return svg(props, [
    import_react2.default.createElement("rect", { key: "a", x: 4.6, y: 3.1, width: 2.6, height: 9.8, fill: "currentColor" }),
    import_react2.default.createElement("rect", { key: "b", x: 8.8, y: 3.1, width: 2.6, height: 9.8, fill: "currentColor" })
  ]);
}
function StepBackIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M4.4 3v10", fill: "none", stroke: "currentColor", "stroke-width": 1.5 }),
    import_react2.default.createElement("path", { key: "t", d: "M12 3.4L5.9 8l6.1 4.6z", fill: "currentColor" })
  ]);
}
function StepForwardIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M11.6 3v10", fill: "none", stroke: "currentColor", "stroke-width": 1.5 }),
    import_react2.default.createElement("path", { key: "t", d: "M4 3.4L10.1 8 4 12.6z", fill: "currentColor" })
  ]);
}
function PlusIcon(props) {
  return svg(props, [import_react2.default.createElement("path", { key: "p", d: "M8 3.5v9M3.5 8h9", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" })]);
}
function TrashIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M3.2 4.6h9.6M6.2 4.6V3.2h3.6v1.4M4.6 4.6l.6 8h5.6l.6-8", fill: "none", stroke: "currentColor", "stroke-width": 1.4, "stroke-linecap": "round" })
  ]);
}
function UploadIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M8 10.5V3.4M5 6.2L8 3.2l3 3M3 11.4v1.1h10v-1.1", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" })
  ]);
}
function DownloadIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M8 3.2v7.4M5 7.6L8 10.6l3-3M3 11.6v1.2h10v-1.2", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" })
  ]);
}
function UndoIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M6.2 4.2L3.4 7l2.8 2.8", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" }),
    import_react2.default.createElement("path", { key: "a", d: "M3.6 7h6a3.2 3.2 0 0 1 0 6.4H6.2", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" })
  ]);
}
function RedoIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M9.8 4.2L12.6 7l-2.8 2.8", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" }),
    import_react2.default.createElement("path", { key: "a", d: "M12.4 7h-6a3.2 3.2 0 0 0 0 6.4h3.4", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" })
  ]);
}
function SplitIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M8 2.5v11", fill: "none", stroke: "currentColor", "stroke-width": 1.5 }),
    import_react2.default.createElement("path", { key: "a", d: "M2.6 5.4l3.2 2.6-3.2 2.6M13.4 5.4L10.2 8l3.2 2.6", fill: "none", stroke: "currentColor", "stroke-width": 1.4, "stroke-linecap": "round" })
  ]);
}
function ExportIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M8 10V2.8M5 5.8L8 2.8l3 3", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" }),
    import_react2.default.createElement("path", { key: "a", d: "M3 9.6v3.2h10v-3.2", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" })
  ]);
}
function FitIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M2.6 6V2.6h3.4M13.4 6V2.6H10M2.6 10v3.4H6M13.4 10v3.4H10", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" })
  ]);
}
function WarningIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M8 2.6l6 10.8h-12z", fill: "none", stroke: "currentColor", "stroke-width": 1.4, "stroke-linejoin": "round" }),
    import_react2.default.createElement("path", { key: "a", d: "M8 6v3.6M8 11.4v.5", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" })
  ]);
}
function CloseIcon(props) {
  return svg(props, [import_react2.default.createElement("path", { key: "p", d: "M4.2 4.2l7.6 7.6M11.8 4.2L4.2 11.8", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" })]);
}
function VolumeIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M3 6.2h2.3L8.4 3.4v9.2L5.3 9.8H3z", fill: "none", stroke: "currentColor", "stroke-width": 1.4, "stroke-linejoin": "round" }),
    import_react2.default.createElement("path", { key: "a", d: "M10.6 6a3 3 0 0 1 0 4M12.6 4.4a5.6 5.6 0 0 1 0 7.2", fill: "none", stroke: "currentColor", "stroke-width": 1.3, "stroke-linecap": "round", opacity: 0.75 })
  ]);
}
function RetryIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M13 8a5 5 0 1 1-1.6-3.7", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" }),
    import_react2.default.createElement("path", { key: "a", d: "M13.2 2.6v2.6h-2.6", fill: "none", stroke: "currentColor", "stroke-width": 1.5, "stroke-linecap": "round" })
  ]);
}
function PathIcon(props) {
  return svg(props, [
    import_react2.default.createElement("path", { key: "p", d: "M2.6 8.4h2.2l1.2 1.4h1.8l1.2-1.4h2.4", fill: "none", stroke: "currentColor", "stroke-width": 1.3 }),
    import_react2.default.createElement("path", { key: "a", d: "M2.6 8.4V4.2h6.2v2.8", fill: "none", stroke: "currentColor", "stroke-width": 1.3, "stroke-linecap": "round" })
  ]);
}

// video-editor/src/client/MediaBin.jsx
function Poster(props) {
  const { src, alt } = props;
  const [failed, setFailed] = import_react3.default.useState(false);
  import_react3.default.useEffect(() => {
    setFailed(false);
  }, [src]);
  if (failed || src === void 0 || src === null) {
    return /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-thumb", "aria-hidden": "true" }, /* @__PURE__ */ import_react3.default.createElement(FilmIcon, { size: 16 }));
  }
  return /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-thumb" }, /* @__PURE__ */ import_react3.default.createElement("img", { src, alt, draggable: false, loading: "lazy", onError: () => setFailed(true) }));
}
function MediaBin(props) {
  const { state, sessionId, op, refresh, t, onAddClip, adoptState, busy } = props;
  const registerImport = props.registerImport;
  const media = Array.isArray(state?.media) ? state.media : [];
  const [dropActive, setDropActive] = import_react3.default.useState(false);
  const [uploading, setUploading] = import_react3.default.useState(0);
  const [pathOpen, setPathOpen] = import_react3.default.useState(false);
  const [pathValue, setPathValue] = import_react3.default.useState("");
  const [error, setError] = import_react3.default.useState(null);
  const [notice, setNotice] = import_react3.default.useState(null);
  const fileRef = import_react3.default.useRef(null);
  const openPicker = import_react3.default.useCallback(() => {
    const input = fileRef.current;
    if (input === null || input === void 0) return;
    input.click();
  }, []);
  import_react3.default.useEffect(() => {
    if (typeof registerImport !== "function") return void 0;
    registerImport(openPicker);
    return () => registerImport(null);
  }, [registerImport, openPicker]);
  const uploadFiles = import_react3.default.useCallback(async (files) => {
    const list = Array.from(files ?? []).filter((file) => file !== null && file !== void 0 && typeof file.name === "string");
    if (list.length === 0) return;
    setError(null);
    setNotice(null);
    for (const file of list) {
      setUploading((count) => count + 1);
      const result = await uploadMedia(sessionId, file);
      setUploading((count) => Math.max(0, count - 1));
      if (!result.ok) {
        setError(t("error.upload", { message: result.error }));
        continue;
      }
      if (typeof adoptState === "function" && result.state !== void 0) adoptState(result.state);
      else if (typeof refresh === "function") await refresh();
      const item = result.media;
      if (item !== null && item !== void 0 && typeof item.id === "string") {
        setNotice(`+ ${item.name}`);
      }
    }
  }, [sessionId, refresh, t, adoptState]);
  const onFileChange = import_react3.default.useCallback((event) => {
    const files = event.target.files;
    if (files === null || files === void 0) return;
    void uploadFiles(files);
    event.target.value = "";
  }, [uploadFiles]);
  const onDragOver = import_react3.default.useCallback((event) => {
    if (event.dataTransfer === null || event.dataTransfer === void 0) return;
    const hasFiles = Array.from(event.dataTransfer.types ?? []).includes("Files");
    const hasMedia = Array.from(event.dataTransfer.types ?? []).includes("application/x-ve-media");
    if (!hasFiles && !hasMedia) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = hasFiles ? "copy" : "move";
    setDropActive(true);
  }, []);
  const onDragLeave = import_react3.default.useCallback((event) => {
    if (event.currentTarget === event.target) setDropActive(false);
  }, []);
  const onDrop = import_react3.default.useCallback((event) => {
    if (event.dataTransfer === null || event.dataTransfer === void 0) return;
    const files = event.dataTransfer.files;
    setDropActive(false);
    if (files !== null && files !== void 0 && files.length > 0) {
      event.preventDefault();
      void uploadFiles(files);
    }
  }, [uploadFiles]);
  const importPathValue = import_react3.default.useCallback(async () => {
    const paths = pathValue.split(/[\n,]+/).map((entry) => entry.trim()).filter((entry) => entry !== "");
    if (paths.length === 0) {
      setError(t("bin.pathEmpty"));
      return;
    }
    const result = await importPaths(sessionId, paths);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (Array.isArray(result.skipped) && result.skipped.length > 0) {
      setNotice(`${result.skipped.length} skipped`);
    }
    setPathOpen(false);
    setPathValue("");
    setError(null);
    if (typeof adoptState === "function" && result.state !== void 0) adoptState(result.state);
    else if (typeof refresh === "function") await refresh();
  }, [pathValue, sessionId, refresh, adoptState, t]);
  const removeMedia = import_react3.default.useCallback(async (mediaId) => {
    const result = await op({ type: "removeMedia", mediaId });
    if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
    else setError(null);
  }, [op]);
  return /* @__PURE__ */ import_react3.default.createElement("aside", { className: "ve-bin" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-head" }, /* @__PURE__ */ import_react3.default.createElement("span", { className: "ve-bin-title" }, t("bin.title")), /* @__PURE__ */ import_react3.default.createElement("span", { className: "ve-bin-count" }, t("bin.count", { count: media.length })), /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-grow" }), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-icon-btn",
      onClick: () => setPathOpen((value) => !value),
      title: t("bin.path"),
      "aria-label": t("bin.path")
    },
    /* @__PURE__ */ import_react3.default.createElement(PathIcon, { size: 11 })
  ), /* @__PURE__ */ import_react3.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-btn",
      onClick: openPicker,
      title: t("bin.import")
    },
    /* @__PURE__ */ import_react3.default.createElement(UploadIcon, { size: 11 }),
    /* @__PURE__ */ import_react3.default.createElement("span", null, t("bin.import"))
  ), /* @__PURE__ */ import_react3.default.createElement(
    "input",
    {
      ref: fileRef,
      type: "file",
      accept: "video/*",
      multiple: true,
      style: { display: "none" },
      onChange: onFileChange
    }
  )), pathOpen ? /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-pathbar" }, /* @__PURE__ */ import_react3.default.createElement(
    "textarea",
    {
      className: "ve-textarea",
      value: pathValue,
      placeholder: t("bin.pathPlaceholder"),
      onChange: (event) => setPathValue(event.target.value),
      "aria-label": t("bin.path")
    }
  ), /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-row-end" }, /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", className: "ve-icon-btn", onClick: () => {
    setPathOpen(false);
    setPathValue("");
  } }, /* @__PURE__ */ import_react3.default.createElement(CloseIcon, { size: 11 }), /* @__PURE__ */ import_react3.default.createElement("span", null, t("bin.pathCancel"))), /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", className: "ve-btn ve-btn-primary", onClick: () => void importPathValue() }, t("bin.pathConfirm")))) : null, error === null ? null : /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-error-inline" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-error-inline-body" }, error), /* @__PURE__ */ import_react3.default.createElement("button", { type: "button", className: "ve-mini-btn", onClick: () => setError(null), "aria-label": t("common.close") }, /* @__PURE__ */ import_react3.default.createElement(CloseIcon, { size: 10 }))), notice === null ? null : /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-uploading" }, /* @__PURE__ */ import_react3.default.createElement("span", null, notice)), media.length === 0 ? /* @__PURE__ */ import_react3.default.createElement(
    "div",
    {
      className: "ve-bin-list ve-bin-empty",
      onDragOver,
      onDragLeave,
      onDrop
    },
    /* @__PURE__ */ import_react3.default.createElement(FilmIcon, { size: 26 }),
    /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-empty-title" }, t("bin.empty")),
    /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-empty-hint" }, t("bin.emptyHint"))
  ) : /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-list", onDragOver, onDragLeave, onDrop }, media.map((item) => /* @__PURE__ */ import_react3.default.createElement(
    "div",
    {
      key: item.id,
      className: "ve-bin-row",
      draggable: true,
      onDragStart: (event) => {
        if (event.dataTransfer === null || event.dataTransfer === void 0) return;
        event.dataTransfer.setData("application/x-ve-media", item.id);
        event.dataTransfer.effectAllowed = "copy";
      },
      title: item.name
    },
    /* @__PURE__ */ import_react3.default.createElement(Poster, { src: posterUrl(sessionId, item.id), alt: item.name }),
    /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-meta" }, /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-name" }, item.name), /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-sub" }, /* @__PURE__ */ import_react3.default.createElement("span", { className: "ve-duration" }, formatClock(item.duration)), /* @__PURE__ */ import_react3.default.createElement("span", { className: "ve-dot" }), /* @__PURE__ */ import_react3.default.createElement("span", null, `${item.width}\xD7${item.height}`), item.hasAudio === true ? /* @__PURE__ */ import_react3.default.createElement("span", { className: "ve-dot" }) : null, item.hasAudio === true ? /* @__PURE__ */ import_react3.default.createElement("span", null, t("bin.hasAudio")) : null)),
    /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-actions" }, /* @__PURE__ */ import_react3.default.createElement(
      "button",
      {
        type: "button",
        className: "ve-mini-btn",
        onClick: (event) => {
          event.stopPropagation();
          onAddClip(item.id);
        },
        title: t("bin.addToTimeline"),
        "aria-label": t("bin.addToTimeline"),
        disabled: busy
      },
      /* @__PURE__ */ import_react3.default.createElement(PlusIcon, { size: 10 })
    ), /* @__PURE__ */ import_react3.default.createElement(
      "button",
      {
        type: "button",
        className: "ve-mini-btn ve-mini-btn-danger",
        onClick: (event) => {
          event.stopPropagation();
          void removeMedia(item.id);
        },
        title: t("bin.remove"),
        "aria-label": t("bin.remove"),
        disabled: busy
      },
      /* @__PURE__ */ import_react3.default.createElement(TrashIcon, { size: 10 })
    ))
  ))), uploading > 0 ? /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-uploading" }, /* @__PURE__ */ import_react3.default.createElement("span", { className: "ve-spin" }), /* @__PURE__ */ import_react3.default.createElement("span", null, t("bin.uploading"))) : null, dropActive ? /* @__PURE__ */ import_react3.default.createElement("div", { className: "ve-bin-drop" }, /* @__PURE__ */ import_react3.default.createElement(UploadIcon, { size: 22 }), /* @__PURE__ */ import_react3.default.createElement("div", null, t("bin.dropHint"))) : null);
}

// video-editor/src/client/Preview.jsx
var import_react4 = __toESM(require("react"), 1);
var DRIFT_LIMIT = 0.25;
var PUBLISH_MS = 33;
function safeCall(fn) {
  try {
    return fn();
  } catch {
    return void 0;
  }
}
function startElement(element) {
  if (element === null || element === void 0) return;
  const promise = safeCall(() => element.play());
  if (promise !== null && promise !== void 0 && typeof promise.catch === "function") promise.catch(() => {
  });
}
function pauseElement(element) {
  if (element === null || element === void 0) return;
  safeCall(() => element.pause());
}
function fitStage(box, canvasWidth, canvasHeight, mode) {
  const width = Number.isFinite(box?.width) ? box.width : 0;
  const height = Number.isFinite(box?.height) ? box.height : 0;
  const canvasW = Number.isFinite(canvasWidth) && canvasWidth > 0 ? canvasWidth : 1920;
  const canvasH = Number.isFinite(canvasHeight) && canvasHeight > 0 ? canvasHeight : 1080;
  if (mode === "actual") return { width: canvasW, height: canvasH };
  if (width <= 0 || height <= 0) return { width: 0, height: 0 };
  const aspect = canvasW / canvasH;
  let stageWidth = width;
  let stageHeight = width / aspect;
  if (stageHeight > height) {
    stageHeight = height;
    stageWidth = height * aspect;
  }
  return { width: Math.max(0, Math.floor(stageWidth)), height: Math.max(0, Math.floor(stageHeight)) };
}
var HIDDEN = "none";
var SHOWN = "block";
function setVisible(element, visible) {
  if (element === null || element === void 0) return;
  const next = visible ? SHOWN : HIDDEN;
  if (element.style.display !== next) element.style.display = next;
}
function Preview(props) {
  const { state, sessionId, clock, playing, onPlaying, t, error, onRegisterApi } = props;
  const canvasW = Number.isFinite(state?.width) ? state.width : 1920;
  const canvasH = Number.isFinite(state?.height) ? state.height : 1080;
  const fps = Number.isFinite(state?.fps) ? state.fps : 30;
  const layout = import_react4.default.useMemo(() => layoutOfState(state), [state]);
  const duration = layout.duration;
  const clipById = import_react4.default.useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const clip of Array.isArray(state?.clips) ? state.clips : []) {
      if (clip !== null && typeof clip === "object" && typeof clip.id === "string") map.set(clip.id, clip);
    }
    return map;
  }, [state]);
  const mediaById = import_react4.default.useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const item of Array.isArray(state?.media) ? state.media : []) {
      if (item !== null && typeof item === "object" && typeof item.id === "string") map.set(item.id, item);
    }
    return map;
  }, [state]);
  const overlayClips = import_react4.default.useMemo(() => {
    const list = Array.isArray(state?.clips) ? state.clips : [];
    return list.filter((clip) => clip !== null && typeof clip === "object" && clip.track === 1).slice(0, 2);
  }, [state]);
  const [volume, setVolume] = import_react4.default.useState(100);
  const [mode, setMode] = import_react4.default.useState("fit");
  const [timeDisplay, setTimeDisplay] = import_react4.default.useState(() => clock.get());
  const [playError, setPlayError] = import_react4.default.useState(null);
  const [box, setBox] = import_react4.default.useState({ width: 0, height: 0 });
  const wrapRef = import_react4.default.useRef(null);
  const slotARef = import_react4.default.useRef(null);
  const slotBRef = import_react4.default.useRef(null);
  const overlayARef = import_react4.default.useRef(null);
  const overlayBRef = import_react4.default.useRef(null);
  const engineRef = import_react4.default.useRef({
    active: 0,
    loaded: [null, null],
    time: 0,
    raf: 0,
    lastWall: 0,
    lastPublish: 0
  });
  const playingRef = import_react4.default.useRef(playing);
  playingRef.current = playing;
  import_react4.default.useEffect(() => {
    const element = wrapRef.current;
    if (element === null || element === void 0) return void 0;
    const measure = () => {
      const width = safeCall(() => element.clientWidth) ?? 0;
      const height = safeCall(() => element.clientHeight) ?? 0;
      setBox((previous) => previous.width === width && previous.height === height ? previous : { width, height });
    };
    measure();
    if (typeof ResizeObserver === "function") {
      const observer = new ResizeObserver(measure);
      observer.observe(element);
      return () => observer.disconnect();
    }
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("resize", measure);
      return () => window.removeEventListener("resize", measure);
    }
    return void 0;
  }, []);
  const stage = fitStage(box, canvasW, canvasH, mode);
  import_react4.default.useEffect(() => {
    const level = Math.min(1, Math.max(0, volume / 100));
    for (const element of [slotARef.current, slotBRef.current, overlayARef.current, overlayBRef.current]) {
      if (element === null || element === void 0) continue;
      safeCall(() => {
        element.volume = level;
        element.muted = level <= 0;
      });
    }
  }, [volume]);
  const localOf = import_react4.default.useCallback((clip, timelineTime) => {
    const slice = layout.main.find((entry) => entry.clipId === clip.id);
    const start = slice === void 0 ? 0 : slice.start;
    const sourceIn = Number.isFinite(clip.in) ? clip.in : 0;
    const local = sourceIn + (timelineTime - start);
    return Math.max(0, Number.isFinite(local) ? local : 0);
  }, [layout]);
  const syncMain = import_react4.default.useCallback((timelineTime, force) => {
    const engine = engineRef.current;
    const elementA = slotARef.current;
    const elementB = slotBRef.current;
    const slice = clipAtTime(layout, timelineTime);
    const clip = slice === null ? null : clipById.get(slice.clipId) ?? null;
    if (clip === null) {
      pauseElement(elementA);
      pauseElement(elementB);
      setVisible(elementA, false);
      setVisible(elementB, false);
      return;
    }
    const media = mediaById.get(clip.mediaId);
    if (media === void 0) {
      pauseElement(elementA);
      pauseElement(elementB);
      setVisible(elementA, false);
      setVisible(elementB, false);
      return;
    }
    let slot = -1;
    if (engine.loaded[engine.active] === clip.mediaId) slot = engine.active;
    else if (engine.loaded[1 - engine.active] === clip.mediaId) slot = 1 - engine.active;
    if (slot === -1) {
      slot = 1 - engine.active;
      const incoming = slot === 0 ? elementA : elementB;
      engine.loaded[slot] = clip.mediaId;
      if (incoming !== null && incoming !== void 0) {
        pauseElement(incoming);
        safeCall(() => {
          incoming.src = playUrl(sessionId, clip.mediaId);
        });
        safeCall(() => incoming.load());
      }
    }
    const element = slot === 0 ? elementA : elementB;
    const isActive = slot === engine.active;
    if (!isActive) {
      pauseElement(engine.active === 0 ? elementA : elementB);
      engine.active = slot;
    }
    setVisible(element, true);
    setVisible(slot === 0 ? elementB : elementA, false);
    if (element === null || element === void 0) return;
    const target = localOf(clip, timelineTime);
    const bounded = Number.isFinite(element.duration) && element.duration > 0 ? Math.min(target, Math.max(0, element.duration - 0.04)) : target;
    const drift = Math.abs(element.currentTime - bounded);
    if (force === true || drift > DRIFT_LIMIT) {
      safeCall(() => {
        element.currentTime = bounded;
      });
    }
    if (playingRef.current) startElement(element);
    else pauseElement(element);
  }, [layout, clipById, mediaById, sessionId, localOf]);
  const syncOverlays = import_react4.default.useCallback((timelineTime, force) => {
    const refs = [overlayARef.current, overlayBRef.current];
    for (let index = 0; index < 2; index += 1) {
      const element = refs[index];
      const clip = overlayClips[index];
      if (element === null || element === void 0 || clip === void 0) continue;
      const slice = layout.overlays.find((entry) => entry.clipId === clip.id);
      if (slice === void 0 || timelineTime < slice.start || timelineTime >= slice.end) {
        pauseElement(element);
        setVisible(element, false);
        continue;
      }
      setVisible(element, true);
      const target = Math.max(0, (Number.isFinite(clip.in) ? clip.in : 0) + (timelineTime - slice.start));
      const bounded = Number.isFinite(element.duration) && element.duration > 0 ? Math.min(target, Math.max(0, element.duration - 0.04)) : target;
      if (force === true || Math.abs(element.currentTime - bounded) > DRIFT_LIMIT) {
        safeCall(() => {
          element.currentTime = bounded;
        });
      }
      if (playingRef.current) startElement(element);
      else pauseElement(element);
    }
  }, [layout, overlayClips]);
  const syncAt = import_react4.default.useCallback((timelineTime, force) => {
    engineRef.current.time = timelineTime;
    syncMain(timelineTime, force);
    syncOverlays(timelineTime, force);
  }, [syncMain, syncOverlays]);
  import_react4.default.useEffect(() => {
    const off = clock.subscribe((value) => {
      const engine = engineRef.current;
      if (Math.abs(value - engine.time) < 1e-6) {
        setTimeDisplay(value);
        return;
      }
      engine.time = value;
      setTimeDisplay(value);
      syncAt(value, true);
    });
    return off;
  }, [clock, syncAt]);
  import_react4.default.useEffect(() => {
    const engine = engineRef.current;
    if (!playing) {
      if (engine.raf !== 0) {
        safeCall(() => cancelAnimationFrame(engine.raf));
        engine.raf = 0;
      }
      pauseElement(engine.active === 0 ? slotARef.current : slotBRef.current);
      pauseElement(overlayARef.current);
      pauseElement(overlayBRef.current);
      return void 0;
    }
    if (duration <= 0) {
      onPlaying(false);
      return void 0;
    }
    const nowOf = () => typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
    engine.lastWall = nowOf();
    engine.lastPublish = 0;
    let cancelled = false;
    const step = () => {
      if (cancelled) return;
      const now = nowOf();
      const delta = Math.max(0, Math.min(0.5, (now - engine.lastWall) / 1e3));
      engine.lastWall = now;
      const next = engine.time + delta;
      if (next >= duration) {
        engine.time = duration;
        clock.set(duration);
        setTimeDisplay(duration);
        syncAt(duration, true);
        onPlaying(false);
        return;
      }
      engine.time = next;
      clock.set(next);
      syncAt(next, false);
      if (now - engine.lastPublish >= PUBLISH_MS) {
        engine.lastPublish = now;
        setTimeDisplay(next);
      }
      engine.raf = safeCall(() => requestAnimationFrame(step)) ?? 0;
    };
    engine.raf = safeCall(() => requestAnimationFrame(step)) ?? 0;
    return () => {
      cancelled = true;
      if (engine.raf !== 0) {
        safeCall(() => cancelAnimationFrame(engine.raf));
        engine.raf = 0;
      }
    };
  }, [playing, duration, clock, syncAt, onPlaying]);
  const poolSignature = import_react4.default.useMemo(() => {
    const ids = layout.main.map((slice) => {
      const clip = clipById.get(slice.clipId);
      return `${slice.clipId}:${clip === void 0 ? "?" : clip.mediaId}:${clip === void 0 ? 0 : clip.in}:${clip === void 0 ? 0 : clip.out}`;
    });
    return `${sessionId}|${state?.revision ?? 0}|${ids.join("|")}`;
  }, [sessionId, state, layout, clipById]);
  import_react4.default.useEffect(() => {
    const engine = engineRef.current;
    engine.loaded = [null, null];
    engine.active = 0;
    pauseElement(slotARef.current);
    pauseElement(slotBRef.current);
    setVisible(slotARef.current, false);
    setVisible(slotBRef.current, false);
    engine.time = Math.max(0, Math.min(engine.time, duration));
    syncAt(engine.time, true);
  }, [poolSignature, duration, syncAt]);
  const current = Math.min(timeDisplay, duration > 0 ? duration : timeDisplay);
  const frame = frameOfTime(current, fps);
  const total = totalFrames(duration, fps);
  const activeSlice = clipAtTime(layout, current);
  const activeClip = activeSlice === null ? null : clipById.get(activeSlice.clipId) ?? null;
  const activeMedia = activeClip === null ? null : mediaById.get(activeClip.mediaId) ?? null;
  const togglePlay = import_react4.default.useCallback(() => {
    if (duration <= 0) {
      onPlaying(false);
      return;
    }
    if (!playing && current >= duration - 1e-3) {
      engineRef.current.time = 0;
      clock.set(0);
      setTimeDisplay(0);
      syncAt(0, true);
    }
    onPlaying(!playing);
  }, [duration, playing, current, clock, syncAt, onPlaying]);
  const stepBy = import_react4.default.useCallback((frames) => {
    onPlaying(false);
    const next = clampSeek(stepFrame(engineRef.current.time, fps, frames), duration);
    engineRef.current.time = next;
    clock.set(next);
    setTimeDisplay(next);
    syncAt(next, true);
  }, [onPlaying, clock, fps, duration, syncAt]);
  import_react4.default.useEffect(() => {
    if (typeof onRegisterApi === "function") {
      onRegisterApi({
        togglePlay,
        stepBy,
        seek: (seconds) => {
          const next = clampSeek(seconds, duration);
          engineRef.current.time = next;
          clock.set(next);
          setTimeDisplay(next);
          syncAt(next, true);
        },
        getTime: () => engineRef.current.time
      });
      return () => onRegisterApi(null);
    }
    return void 0;
  }, [onRegisterApi, togglePlay, stepBy, duration, clock, syncAt]);
  const stageStyle = stage.width > 0 || stage.height > 0 ? { width: stage.width > 0 ? `${stage.width}px` : void 0, height: stage.height > 0 ? `${stage.height}px` : void 0 } : void 0;
  const empty = layout.main.length === 0;
  return /* @__PURE__ */ import_react4.default.createElement("section", { className: "ve-preview-pane" }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-stage-wrap", ref: wrapRef }, /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-stage", style: stageStyle }, /* @__PURE__ */ import_react4.default.createElement("video", { ref: slotARef, className: "ve-video", playsInline: true, preload: "auto", onError: () => setPlayError("main") }), /* @__PURE__ */ import_react4.default.createElement("video", { ref: slotBRef, className: "ve-video", playsInline: true, preload: "auto", onError: () => setPlayError("main") }), overlayClips.map((clip, index) => {
    const rect = overlayRect(clip, state);
    const slice = layout.overlays.find((entry) => entry.clipId === clip.id);
    const visible = slice !== void 0 && current >= slice.start && current < slice.end;
    return /* @__PURE__ */ import_react4.default.createElement(
      "video",
      {
        key: `overlay-${index}`,
        ref: index === 0 ? overlayARef : overlayBRef,
        className: "ve-overlay-video",
        playsInline: true,
        preload: "auto",
        src: playUrl(sessionId, clip.mediaId),
        style: { left: rect.left, top: rect.top, width: rect.width, display: visible ? SHOWN : HIDDEN },
        onError: () => setPlayError("overlay")
      }
    );
  }), empty ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-stage-empty" }, /* @__PURE__ */ import_react4.default.createElement(FilmIcon, { size: 26 }), /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-stage-empty-title" }, t("preview.empty")), /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-stage-empty-hint" }, t("preview.emptyHint"))) : null, activeMedia !== null ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-stage-badge" }, /* @__PURE__ */ import_react4.default.createElement("span", null, activeMedia.name), /* @__PURE__ */ import_react4.default.createElement("span", null, "\xB7"), /* @__PURE__ */ import_react4.default.createElement("span", null, `${canvasW}\xD7${canvasH}`)) : null, playError !== null || error !== null ? /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-stage-error" }, error !== null ? error : t("preview.error")) : null)), /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-transport" }, /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      type: "button",
      className: playing ? "ve-play-btn ve-play-btn-active" : "ve-play-btn",
      onClick: togglePlay,
      disabled: duration <= 0,
      "aria-label": playing ? t("preview.pause") : t("preview.play"),
      title: playing ? t("preview.pause") : t("preview.play")
    },
    playing ? /* @__PURE__ */ import_react4.default.createElement(PauseIcon, { size: 12 }) : /* @__PURE__ */ import_react4.default.createElement(PlayIcon, { size: 12 })
  ), /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-transport-time" }, /* @__PURE__ */ import_react4.default.createElement("span", { className: "ve-transport-current ve-timecode" }, formatTimecode(current, fps)), /* @__PURE__ */ import_react4.default.createElement("span", { className: "ve-transport-sep" }, "/"), /* @__PURE__ */ import_react4.default.createElement("span", { className: "ve-transport-total ve-timecode" }, formatTimecode(duration, fps)), /* @__PURE__ */ import_react4.default.createElement("span", { className: "ve-transport-frame" }, t("preview.frame", { frame, total }))), /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-transport-grow" }), /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-icon-btn",
      onClick: () => stepBy(-1),
      disabled: duration <= 0,
      title: t("preview.prevFrame"),
      "aria-label": t("preview.prevFrame")
    },
    /* @__PURE__ */ import_react4.default.createElement(StepBackIcon, { size: 11 }),
    /* @__PURE__ */ import_react4.default.createElement("span", { className: "ve-num" }, "-1")
  ), /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-icon-btn",
      onClick: () => stepBy(1),
      disabled: duration <= 0,
      title: t("preview.nextFrame"),
      "aria-label": t("preview.nextFrame")
    },
    /* @__PURE__ */ import_react4.default.createElement("span", { className: "ve-num" }, "+1"),
    /* @__PURE__ */ import_react4.default.createElement(StepForwardIcon, { size: 11 })
  ), /* @__PURE__ */ import_react4.default.createElement("div", { className: "ve-volume" }, /* @__PURE__ */ import_react4.default.createElement(VolumeIcon, { size: 12 }), /* @__PURE__ */ import_react4.default.createElement(
    "input",
    {
      className: "ve-range ve-volume-range",
      type: "range",
      min: 0,
      max: 100,
      step: 1,
      value: volume,
      onChange: (event) => setVolume(Number(event.target.value)),
      "aria-label": t("preview.volume")
    }
  )), /* @__PURE__ */ import_react4.default.createElement(
    "button",
    {
      type: "button",
      className: mode === "actual" ? "ve-icon-btn ve-icon-btn-active" : "ve-icon-btn",
      onClick: () => setMode(mode === "fit" ? "actual" : "fit"),
      title: `${t("preview.fit")} / ${t("preview.actual")}`
    },
    /* @__PURE__ */ import_react4.default.createElement(FitIcon, { size: 11 }),
    /* @__PURE__ */ import_react4.default.createElement("span", null, mode === "fit" ? t("preview.fit") : t("preview.actual"))
  )));
}

// video-editor/src/client/Timeline.jsx
var import_react5 = __toESM(require("react"), 1);
var FILMSTRIP_FRAMES = 6;
function StripFrame(props) {
  const { src, alt } = props;
  const [failed, setFailed] = import_react5.default.useState(false);
  if (failed) return /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-clip-frame-fallback", "aria-hidden": "true" });
  return /* @__PURE__ */ import_react5.default.createElement(
    "img",
    {
      className: "ve-clip-frame",
      src,
      alt,
      draggable: false,
      loading: "lazy",
      onError: () => setFailed(true)
    }
  );
}
function ClipBlock(props) {
  const {
    clip,
    media,
    slice,
    selected,
    pxPerSec,
    thumbCount,
    sessionId,
    t,
    onSelect,
    onTrimStart,
    onBodyDragStart,
    dragging,
    dropTarget
  } = props;
  const times = import_react5.default.useMemo(() => filmstripTimes(clip, thumbCount), [clip, thumbCount]);
  const left = slice.start * pxPerSec;
  const width = Math.max(6, slice.duration * pxPerSec);
  const dense = width < 96;
  const handleDown = (edge) => (event) => {
    event.preventDefault();
    event.stopPropagation();
    onTrimStart(clip, edge, event);
  };
  const bodyDown = (event) => {
    if (event.button !== void 0 && event.button !== 0) return;
    event.stopPropagation();
    onSelect(clip.id);
    onBodyDragStart(clip, event);
  };
  const classes = [
    "ve-clip",
    clip.track === 1 ? "ve-clip-overlay" : "ve-clip-main",
    selected ? "ve-clip-selected" : "",
    dragging ? "ve-clip-dragging" : "",
    dropTarget ? "ve-clip-droptarget" : ""
  ].filter(Boolean).join(" ");
  return /* @__PURE__ */ import_react5.default.createElement(
    "div",
    {
      className: classes,
      "data-clip-id": clip.id,
      style: { left: `${left}px`, width: `${width}px` },
      onMouseDown: bodyDown,
      role: "presentation",
      title: `${media === void 0 || media === null ? clip.mediaId : media.name} \xB7 ${formatTimecode(slice.duration, props.fps)}`
    },
    /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-clip-strip" }, times.length === 0 ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-clip-frame-fallback", "aria-hidden": "true" }) : times.map((time, index) => /* @__PURE__ */ import_react5.default.createElement(
      StripFrame,
      {
        key: `${clip.id}-frame-${index}`,
        src: frameUrl(sessionId, clip.mediaId, time),
        alt: ""
      }
    ))),
    /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-clip-shade" }),
    /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-clip-label" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "ve-clip-name" }, media === void 0 || media === null ? clip.mediaId : media.name), dense ? null : /* @__PURE__ */ import_react5.default.createElement("span", { className: "ve-clip-dur" }, formatClock(slice.duration))),
    clip.track === 1 ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-clip-badge" }, `${Math.round((Number.isFinite(clip.scale) ? clip.scale : 0.35) * 100)}%`) : null,
    /* @__PURE__ */ import_react5.default.createElement(
      "div",
      {
        className: "ve-clip-handle ve-clip-handle-left",
        role: "slider",
        tabIndex: -1,
        "aria-label": t("timeline.trim"),
        onMouseDown: handleDown("in")
      }
    ),
    /* @__PURE__ */ import_react5.default.createElement(
      "div",
      {
        className: "ve-clip-handle ve-clip-handle-right",
        role: "slider",
        tabIndex: -1,
        "aria-label": t("timeline.trim"),
        onMouseDown: handleDown("out")
      }
    )
  );
}
function Ruler(props) {
  const { duration, pxPerSec, width, onSeekStart } = props;
  const step = chooseStep(pxPerSec);
  const total = Math.max(duration, 0);
  const count = Math.ceil((total + step) / step);
  const ticks = [];
  for (let index = 0; index <= count; index += 1) {
    const time = index * step;
    if (time > total + step) break;
    ticks.push(time);
  }
  const handleDown = (event) => {
    if (event.button !== void 0 && event.button !== 0) return;
    event.preventDefault();
    onSeekStart(event);
  };
  return /* @__PURE__ */ import_react5.default.createElement(
    "div",
    {
      className: "ve-ruler",
      style: { width: `${width}px` },
      onMouseDown: handleDown,
      role: "presentation",
      title: formatTimecode(total, 30)
    },
    ticks.map((time, index) => {
      const major = index % 2 === 0;
      return /* @__PURE__ */ import_react5.default.createElement(import_react5.default.Fragment, { key: `tick-${time}` }, /* @__PURE__ */ import_react5.default.createElement(
        "div",
        {
          className: major ? "ve-ruler-tick ve-ruler-tick-major" : "ve-ruler-tick",
          style: { left: `${time * pxPerSec}px`, height: major ? RULER_HEIGHT : 8 }
        }
      ), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-ruler-label", style: { left: `${time * pxPerSec}px` } }, formatClock(time)));
    })
  );
}
function Timeline(props) {
  const {
    state,
    sessionId,
    op,
    clock,
    t,
    ping,
    selectedClipId,
    onSelectClip,
    transport,
    onImportRequest,
    busy
  } = props;
  const fps = Number.isFinite(state?.fps) ? state.fps : 30;
  const layout = import_react5.default.useMemo(() => layoutOfState(state), [state]);
  const duration = layout.duration;
  const clipById = import_react5.default.useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const clip of Array.isArray(state?.clips) ? state.clips : []) {
      if (clip !== null && typeof clip === "object" && typeof clip.id === "string") map.set(clip.id, clip);
    }
    return map;
  }, [state]);
  const mediaById = import_react5.default.useMemo(() => {
    const map = /* @__PURE__ */ new Map();
    for (const item of Array.isArray(state?.media) ? state.media : []) {
      if (item !== null && typeof item === "object" && typeof item.id === "string") map.set(item.id, item);
    }
    return map;
  }, [state]);
  const [pxPerSec, setPxPerSec] = import_react5.default.useState(ZOOM_DEFAULT);
  const [drag, setDrag] = import_react5.default.useState(null);
  const [dropIndex, setDropIndex] = import_react5.default.useState(-1);
  const [dropActive, setDropActive] = import_react5.default.useState(false);
  const [error, setError] = import_react5.default.useState(null);
  const scrollRef = import_react5.default.useRef(null);
  const contentRef = import_react5.default.useRef(null);
  const playheadRef = import_react5.default.useRef(null);
  const clipAreaRef = import_react5.default.useRef(null);
  const dragRef = import_react5.default.useRef(null);
  const trackWidth = Math.max(1, Math.round(Math.max(duration, 12) * pxPerSec + 240));
  const paintPlayhead = import_react5.default.useCallback((time) => {
    const element = playheadRef.current;
    if (element === null || element === void 0) return;
    const left = `${time * pxPerSec}px`;
    if (element.style.left !== left) element.style.left = left;
  }, [pxPerSec]);
  import_react5.default.useEffect(() => clock.subscribe((time) => paintPlayhead(time)), [clock, paintPlayhead]);
  import_react5.default.useEffect(() => clock.subscribe((time) => {
    const scroll = scrollRef.current;
    if (scroll === null || scroll === void 0) return;
    if (props.playing !== true) return;
    const visibleLeft = scroll.scrollLeft;
    const visibleRight = visibleLeft + scroll.clientWidth - 96;
    const x = time * pxPerSec;
    if (x > visibleRight) scroll.scrollLeft = Math.max(0, x - scroll.clientWidth * 0.5);
    else if (x < visibleLeft) scroll.scrollLeft = Math.max(0, x - scroll.clientWidth * 0.2);
  }), [clock, pxPerSec, props.playing]);
  const seekFromEvent = import_react5.default.useCallback((clientX) => {
    const content = contentRef.current;
    if (content === null || content === void 0) return 0;
    const rect = content.getBoundingClientRect();
    const seconds = (clientX - rect.left) / pxPerSec;
    return clampSeek(seconds, duration);
  }, [pxPerSec, duration]);
  const beginSeek = import_react5.default.useCallback((event) => {
    const apply2 = (clientX) => {
      const next = seekFromEvent(clientX);
      clock.set(next);
      if (transport !== null && transport !== void 0 && typeof transport.seek === "function") transport.seek(next);
    };
    apply2(event.clientX);
    const move = (moveEvent) => apply2(moveEvent.clientX);
    const up = () => {
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      }
    };
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }
  }, [seekFromEvent, clock, transport]);
  const beginTrim = import_react5.default.useCallback((clip, edge, event) => {
    if (op === null || op === void 0) return;
    const media = mediaById.get(clip.mediaId);
    const startX = event.clientX;
    const origin = { in: Number(clip.in) || 0, out: Number(clip.out) || 0 };
    let preview = null;
    const mediaDuration = media !== void 0 && media !== null && Number.isFinite(media.duration) ? media.duration : origin.out;
    const move = (moveEvent) => {
      const delta = (moveEvent.clientX - startX) / pxPerSec;
      if (edge === "in") {
        const nextIn = clampNumber(origin.in + delta, 0, origin.out - MIN_CLIP);
        preview = { in: roundTime(nextIn), out: roundTime(origin.out) };
      } else {
        const nextOut = clampNumber(origin.out + delta, origin.in + MIN_CLIP, mediaDuration);
        preview = { in: roundTime(origin.in), out: roundTime(nextOut) };
      }
      const element = clipAreaRef.current;
      if (element !== null && element !== void 0 && preview !== null) {
        const target = element.querySelector(`[data-clip-id="${clip.id}"]`);
        if (target !== null && target !== void 0) {
          const slice = clip.track === 0 ? layout.main.find((entry) => entry.clipId === clip.id) : layout.overlays.find((entry) => entry.clipId === clip.id);
          if (slice !== void 0) {
            const nextDuration = Math.max(MIN_CLIP, preview.out - preview.in);
            target.style.width = `${Math.max(6, nextDuration * pxPerSec)}px`;
            if (clip.track === 1) {
              const start = Math.max(0, Number.isFinite(clip.start) ? clip.start : 0);
              target.style.left = `${start * pxPerSec}px`;
            }
          }
        }
      }
    };
    const up = () => {
      removeWindow();
      if (preview === null) return;
      const unchanged = Math.abs(preview.in - origin.in) < 1e-3 && Math.abs(preview.out - origin.out) < 1e-3;
      if (unchanged) {
        setDrag(null);
        return;
      }
      setDrag(null);
      void op({ type: "trim", clipId: clip.id, in: preview.in, out: preview.out }).then((result) => {
        if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
        else setError(null);
      });
    };
    const removeWindow = () => {
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      }
    };
    setDrag({ kind: "trim", clipId: clip.id, edge });
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }
  }, [op, mediaById, layout, pxPerSec]);
  const beginBodyDrag = import_react5.default.useCallback((clip, event) => {
    if (op === null || op === void 0) return;
    const startX = event.clientX;
    const originStart = Math.max(0, Number.isFinite(clip.start) ? clip.start : 0);
    const mainIndex = layout.main.findIndex((slice) => slice.clipId === clip.id);
    let target = mainIndex;
    let previewStart = originStart;
    dragRef.current = { penalty: 0 };
    const move = (moveEvent) => {
      const delta = (moveEvent.clientX - startX) / pxPerSec;
      if (clip.track === 1) {
        previewStart = Math.max(0, originStart + delta);
        const target2 = clipAreaRef.current === null ? null : clipAreaRef.current.querySelector(`[data-clip-id="${clip.id}"]`);
        if (target2 !== null && target2 !== void 0) target2.style.left = `${previewStart * pxPerSec}px`;
        setDrag({ kind: "overlay-move", clipId: clip.id, start: previewStart });
        return;
      }
      const content = contentRef.current;
      if (content === null || content === void 0) return;
      const rect = content.getBoundingClientRect();
      const seconds = (moveEvent.clientX - rect.left) / pxPerSec;
      const nextIndex = reorderIndexAt(layout, seconds, clip.id);
      target = nextIndex;
      setDropIndex(nextIndex);
      setDrag({ kind: "reorder", clipId: clip.id, toIndex: nextIndex });
    };
    const up = () => {
      removeWindow();
      dragRef.current = null;
      setDropIndex(-1);
      setDrag(null);
      if (clip.track === 1) {
        if (Math.abs(previewStart - originStart) < 1e-3) return;
        void op({ type: "updateOverlay", clipId: clip.id, start: roundTime(previewStart) }).then((result) => {
          if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
          else setError(null);
        });
        return;
      }
      if (target === mainIndex || target < 0) return;
      void op({ type: "move", clipId: clip.id, toIndex: target }).then((result) => {
        if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
        else setError(null);
      });
    };
    const removeWindow = () => {
      if (typeof window !== "undefined" && typeof window.removeEventListener === "function") {
        window.removeEventListener("mousemove", move);
        window.removeEventListener("mouseup", up);
      }
    };
    setDrag({ kind: clip.track === 1 ? "overlay-move" : "reorder", clipId: clip.id, toIndex: mainIndex, start: originStart });
    if (typeof window !== "undefined" && typeof window.addEventListener === "function") {
      window.addEventListener("mousemove", move);
      window.addEventListener("mouseup", up);
    }
  }, [op, layout, pxPerSec]);
  const zoomAround = import_react5.default.useCallback((nextZoom, clientX) => {
    const scroll = scrollRef.current;
    const content = contentRef.current;
    if (scroll === null || content === null) {
      setPxPerSec(nextZoom);
      return;
    }
    const rect = content.getBoundingClientRect();
    const anchor = clientX === void 0 ? scroll.clientWidth / 2 : clientX - rect.left;
    const seconds = (scroll.scrollLeft + anchor) / pxPerSec;
    const clamped = clampNumber(nextZoom, ZOOM_MIN, ZOOM_MAX);
    setPxPerSec(clamped);
    const commit = () => {
      const next = scrollRef.current;
      if (next === null || next === void 0) return;
      next.scrollLeft = Math.max(0, seconds * clamped - (clientX === void 0 ? next.clientWidth / 2 : anchor));
    };
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(commit);
    else commit();
  }, [pxPerSec]);
  const fit = import_react5.default.useCallback(() => {
    const scroll = scrollRef.current;
    const width = scroll === null ? 0 : Math.max(1, scroll.clientWidth - 24);
    const next = fitZoom(duration, width, ZOOM_MIN, ZOOM_MAX);
    setPxPerSec(next);
    if (scroll !== null) scroll.scrollLeft = 0;
  }, [duration]);
  const onWheel = import_react5.default.useCallback((event) => {
    if (event.ctrlKey || event.metaKey) {
      event.preventDefault();
      const factor = event.deltaY < 0 ? 1.18 : 1 / 1.18;
      zoomAround(pxPerSec * factor, event.clientX);
      return;
    }
    const scroll = scrollRef.current;
    if (scroll === null || scroll === void 0) return;
    if (event.deltaY !== 0 && event.deltaX === 0) {
      scroll.scrollLeft += event.deltaY;
      event.preventDefault();
    }
  }, [pxPerSec, zoomAround]);
  import_react5.default.useEffect(() => {
    const scroll = scrollRef.current;
    if (scroll === null || scroll === void 0) return void 0;
    if (typeof scroll.addEventListener !== "function") return void 0;
    scroll.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      if (typeof scroll.removeEventListener === "function") scroll.removeEventListener("wheel", onWheel, { passive: false });
    };
  }, [onWheel]);
  const split = import_react5.default.useCallback(() => {
    if (op === null || op === void 0 || selectedClipId === null) return;
    const clip = clipById.get(selectedClipId);
    if (clip === void 0 || clip === null) return;
    if (clip.track !== 0) {
      setError("\u76EE\u524D\u53EA\u80FD\u5728\u4E3B\u8F68\u9053\u4E0A\u5207\u5206\u7247\u6BB5");
      return;
    }
    const at = clampSeek(clock.get(), duration);
    void op({ type: "split", clipId: clip.id, at: roundTime(at) }).then((result) => {
      if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
      else setError(null);
    });
  }, [op, selectedClipId, clipById, clock, duration]);
  const removeSelected = import_react5.default.useCallback(() => {
    if (op === null || op === void 0 || selectedClipId === null) return;
    void op({ type: "delete", clipIds: [selectedClipId] }).then((result) => {
      if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
      else {
        setError(null);
        onSelectClip(null);
      }
    });
  }, [op, selectedClipId, onSelectClip]);
  const appendMediaAtEnd = import_react5.default.useCallback((mediaId) => {
    if (op === null || op === void 0) return;
    void op({ type: "addClip", mediaId, track: 0 }).then((result) => {
      if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
      else setError(null);
    });
  }, [op]);
  const onDragOver = import_react5.default.useCallback((event) => {
    if (event.dataTransfer !== null && event.dataTransfer !== void 0) {
      const types = Array.from(event.dataTransfer.types ?? []);
      if (!types.includes("application/x-ve-media")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
      setDropActive(true);
    }
  }, []);
  const onDragLeave = import_react5.default.useCallback((event) => {
    if (event.currentTarget === event.target) setDropActive(false);
  }, []);
  const onDrop = import_react5.default.useCallback((event) => {
    const data = event.dataTransfer === null || event.dataTransfer === void 0 ? "" : event.dataTransfer.getData("application/x-ve-media");
    setDropActive(false);
    if (typeof data !== "string" || data === "") return;
    event.preventDefault();
    appendMediaAtEnd(data);
  }, [appendMediaAtEnd]);
  const onKeyDown = import_react5.default.useCallback((event) => {
    const target = event.target;
    if (target !== null && target !== void 0) {
      const tag = typeof target.tagName === "string" ? target.tagName.toLowerCase() : "";
      if (tag === "input" || tag === "textarea" || tag === "select" || target.isContentEditable === true) return;
    }
    const mod = event.ctrlKey || event.metaKey;
    if (event.key === " " || event.code === "Space") {
      event.preventDefault();
      if (transport !== null && transport !== void 0) transport.togglePlay();
      return;
    }
    if (mod && (event.key === "z" || event.key === "Z")) {
      event.preventDefault();
      void op({ type: event.shiftKey ? "redo" : "undo" });
      return;
    }
    if (mod && (event.key === "y" || event.key === "Y")) {
      event.preventDefault();
      void op({ type: "redo" });
      return;
    }
    if (mod) return;
    if (event.key === "s" || event.key === "S") {
      event.preventDefault();
      split();
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelected();
      return;
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      const direction = event.key === "ArrowLeft" ? -1 : 1;
      if (event.shiftKey) {
        const next = clampSeek(clock.get() + direction * 1, duration);
        clock.set(next);
        if (transport !== null && transport !== void 0) transport.seek(next);
      } else if (transport !== null && transport !== void 0) {
        transport.stepBy(direction);
      }
    }
  }, [op, split, removeSelected, clock, duration, transport]);
  const mainSlices = layout.main;
  const overlaySlices = layout.overlays;
  const total = duration;
  const empty = mainSlices.length === 0 && overlaySlices.length === 0;
  const thumbCount = Math.max(1, Math.min(FILMSTRIP_FRAMES, Math.round(pxPerSec / 26)));
  const clipNode = (slice) => {
    const clip = clipById.get(slice.clipId);
    if (clip === void 0 || clip === null) return null;
    const media = mediaById.get(clip.mediaId);
    return /* @__PURE__ */ import_react5.default.createElement(
      ClipBlock,
      {
        key: clip.id,
        clip,
        media,
        slice,
        fps,
        selected: selectedClipId === clip.id,
        pxPerSec,
        thumbCount,
        sessionId,
        t,
        dragging: drag !== null && drag.clipId === clip.id,
        dropTarget: dropIndex >= 0 && drag !== null && drag.kind === "reorder" && mainSlices[dropIndex] !== void 0 && mainSlices[dropIndex].clipId === clip.id,
        onSelect: onSelectClip,
        onTrimStart: beginTrim,
        onBodyDragStart: beginBodyDrag
      }
    );
  };
  return /* @__PURE__ */ import_react5.default.createElement("section", { className: "ve-timeline", tabIndex: 0, onKeyDown, "aria-label": t("timeline.title") }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-head" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-title" }, t("timeline.title")), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-icon-btn",
      onClick: split,
      disabled: selectedClipId === null || busy,
      title: `${t("timeline.splitAtPlayhead")} (S)`,
      "aria-label": t("timeline.splitAtPlayhead")
    },
    /* @__PURE__ */ import_react5.default.createElement(SplitIcon, { size: 11 }),
    /* @__PURE__ */ import_react5.default.createElement("span", null, t("timeline.split"))
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-icon-btn",
      onClick: removeSelected,
      disabled: selectedClipId === null || busy,
      title: `${t("timeline.deleteClip")} (Del)`,
      "aria-label": t("timeline.deleteClip")
    },
    /* @__PURE__ */ import_react5.default.createElement(TrashIcon, { size: 11 })
  ), /* @__PURE__ */ import_react5.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-icon-btn",
      onClick: () => onImportRequest(),
      title: t("bin.import"),
      "aria-label": t("bin.import")
    },
    /* @__PURE__ */ import_react5.default.createElement(PlusIcon, { size: 11 })
  ), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-grow" }), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-zoom" }, /* @__PURE__ */ import_react5.default.createElement("span", null, t("timeline.zoom")), /* @__PURE__ */ import_react5.default.createElement(
    "input",
    {
      className: "ve-range ve-zoom-range",
      type: "range",
      min: ZOOM_MIN,
      max: ZOOM_MAX,
      step: 10,
      value: Math.round(pxPerSec),
      onChange: (event) => zoomAround(Number(event.target.value), void 0),
      "aria-label": t("timeline.zoom")
    }
  ), /* @__PURE__ */ import_react5.default.createElement("span", { className: "ve-zoom-value" }, `${Math.round(pxPerSec)} px/s`)), /* @__PURE__ */ import_react5.default.createElement("button", { type: "button", className: "ve-icon-btn", onClick: fit, title: t("timeline.fit") }, /* @__PURE__ */ import_react5.default.createElement(FitIcon, { size: 11 }), /* @__PURE__ */ import_react5.default.createElement("span", null, t("timeline.fit"))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-total" }, /* @__PURE__ */ import_react5.default.createElement("span", null, t("timeline.total")), /* @__PURE__ */ import_react5.default.createElement("span", { className: "ve-timecode" }, formatTimecode(total, fps)))), error === null ? null : /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-error-inline" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-error-inline-body" }, error), /* @__PURE__ */ import_react5.default.createElement("button", { type: "button", className: "ve-btn ve-btn-ghost", onClick: () => setError(null) }, t("common.close"))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-body" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-labels" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-labels-spacer" }), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-track-label", style: { height: `${TRACK_HEIGHT}px` } }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-track-label-name" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "ve-track-label-dot ve-track-label-dot-main" }), t("timeline.trackMain")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-track-label-hint" }, t("timeline.mainHint"))), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-track-label", style: { height: `${TRACK_HEIGHT}px` } }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-track-label-name" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "ve-track-label-dot ve-track-label-dot-overlay" }), t("timeline.trackOverlay")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-track-label-hint" }, t("timeline.overlayHint")))), /* @__PURE__ */ import_react5.default.createElement(
    "div",
    {
      className: "ve-tl-scroll",
      ref: scrollRef,
      onDragOver,
      onDragLeave,
      onDrop
    },
    /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-content", ref: contentRef, style: { width: `${trackWidth}px` } }, /* @__PURE__ */ import_react5.default.createElement(Ruler, { duration, pxPerSec, width: trackWidth, onSeekStart: beginSeek }), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-track-row", ref: clipAreaRef, style: { width: `${trackWidth}px` } }, mainSlices.map((slice) => clipNode(slice)), dropActive ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-track-drop" }) : null), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-track-row ve-track-row-empty", style: { width: `${trackWidth}px` } }, overlaySlices.map((slice) => clipNode(slice))), empty ? /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-empty" }, /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-empty-title" }, t("timeline.empty")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-empty-hint" }, t("timeline.mainHint"))) : null, /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-playhead", ref: playheadRef, style: { left: `${clock.get() * pxPerSec}px` } }), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-playhead-handle", style: { left: `${clock.get() * pxPerSec}px` }, onMouseDown: beginSeek }))
  )), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-hintbar" }, /* @__PURE__ */ import_react5.default.createElement("span", { className: "ve-tl-hint-key" }, t("timeline.shortcuts")), /* @__PURE__ */ import_react5.default.createElement("div", { className: "ve-tl-grow" }), ping !== null && ping !== void 0 && ping.ffmpeg !== void 0 && ping.ffmpeg.available === false ? /* @__PURE__ */ import_react5.default.createElement("span", null, t("toolbar.ffmpegMissing")) : null));
}

// video-editor/src/client/ExportDialog.jsx
var import_react6 = __toESM(require("react"), 1);
function defaultName(now) {
  const stamp = now === void 0 ? /* @__PURE__ */ new Date() : now;
  const pad = (value) => String(value).padStart(2, "0");
  return `edit-${stamp.getFullYear()}${pad(stamp.getMonth() + 1)}${pad(stamp.getDate())}-${pad(stamp.getHours())}${pad(stamp.getMinutes())}${pad(stamp.getSeconds())}.mp4`;
}
function jobStatusKey(job) {
  if (job === null || job === void 0) return "export.queued";
  if (job.status === "done") return "export.done";
  if (job.status === "error") return "export.failed";
  if (job.status === "running") return "export.running";
  return "export.queued";
}
function ExportDialog(props) {
  const { sessionId, state, ping, t, open, onClose, onStarted } = props;
  const layout = import_react6.default.useMemo(() => layoutOfState(state), [state]);
  const [filename, setFilename] = import_react6.default.useState(() => defaultName());
  const [quality, setQuality] = import_react6.default.useState("high");
  const [jobId, setJobId] = import_react6.default.useState(null);
  const [job, setJob] = import_react6.default.useState(null);
  const [error, setError] = import_react6.default.useState(null);
  const [submitting, setSubmitting] = import_react6.default.useState(false);
  const ffmpegMissing = ping !== null && ping !== void 0 && ping.ffmpeg !== void 0 && ping.ffmpeg.available === false;
  const cycle = layout.duration > 0;
  import_react6.default.useEffect(() => {
    if (open === true) {
      setError(null);
      if (jobId === null) setFilename(defaultName());
    }
  }, [open]);
  const status = job === null || job === void 0 ? null : job.status;
  const settled = status === "done" || status === "error";
  import_react6.default.useEffect(() => {
    if (jobId === null || settled) return void 0;
    let alive = true;
    const tick = () => {
      void getExportJob(sessionId, jobId).then((result) => {
        if (!alive) return;
        if (result.ok) setJob(result.job);
        else setError(result.error);
      });
    };
    const timer = setInterval(tick, EXPORT_POLL_MS);
    tick();
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [sessionId, jobId, settled]);
  const start = import_react6.default.useCallback(async () => {
    if (ffmpegMissing || !cycle) return;
    setSubmitting(true);
    setError(null);
    const result = await startExport(sessionId, { filename, quality });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setJobId(result.jobId);
    setJob(result.job ?? { id: result.jobId, status: "queued", progress: 0, filename });
    if (typeof onStarted === "function") onStarted(result.jobId);
  }, [sessionId, filename, quality, ffmpegMissing, cycle, onStarted]);
  if (open !== true) return null;
  const percent = job === null || job === void 0 || !Number.isFinite(job.progress) ? 0 : Math.round(Math.max(0, Math.min(1, job.progress)) * 100);
  const running = submitting || jobId !== null && job !== null && job !== void 0 && (job.status === "running" || job.status === "queued");
  const done = job !== null && job !== void 0 && job.status === "done";
  const failed = job !== null && job !== void 0 && job.status === "error";
  return /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-backdrop", onMouseDown: (event) => {
    if (event.target === event.currentTarget) onClose();
  } }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal", role: "dialog", "aria-modal": "true", "aria-label": t("export.title") }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-head" }, /* @__PURE__ */ import_react6.default.createElement(ExportIcon, { size: 13 }), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-title" }, t("export.title")), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-grow" }), /* @__PURE__ */ import_react6.default.createElement("button", { type: "button", className: "ve-mini-btn", onClick: onClose, "aria-label": t("export.close") }, /* @__PURE__ */ import_react6.default.createElement(CloseIcon, { size: 11 }))), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-body" }, ffmpegMissing ? /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-error-inline", style: { margin: 0 } }, /* @__PURE__ */ import_react6.default.createElement(WarningIcon, { size: 12 }), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-error-inline-body" }, t("export.ffmpegMissing"))) : null, !cycle ? /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-note" }, t("export.empty")) : null, /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-form-row" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "ve-form-label", htmlFor: "ve-export-name" }, t("export.filename")), /* @__PURE__ */ import_react6.default.createElement(
    "input",
    {
      id: "ve-export-name",
      className: "ve-input ve-input-mono",
      value: filename,
      onChange: (event) => setFilename(event.target.value),
      disabled: running
    }
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-form-row" }, /* @__PURE__ */ import_react6.default.createElement("label", { className: "ve-form-label", htmlFor: "ve-export-quality" }, t("export.quality")), /* @__PURE__ */ import_react6.default.createElement(
    "select",
    {
      id: "ve-export-quality",
      className: "ve-select",
      value: quality,
      onChange: (event) => setQuality(event.target.value),
      disabled: running
    },
    /* @__PURE__ */ import_react6.default.createElement("option", { value: "high" }, t("export.qualityHigh")),
    /* @__PURE__ */ import_react6.default.createElement("option", { value: "fast" }, t("export.qualityFast"))
  )), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-progress" }, /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-progress-bar", style: { width: `${done ? 100 : percent}%` } })), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-progress-meta" }, /* @__PURE__ */ import_react6.default.createElement("span", null, job === null || job === void 0 ? t("export.queued") : t(jobStatusKey(job))), job !== null && job !== void 0 && Number.isFinite(job.duration) && job.duration > 0 ? /* @__PURE__ */ import_react6.default.createElement("span", null, formatClock(job.duration)) : null, /* @__PURE__ */ import_react6.default.createElement("span", { className: "ve-progress-percent" }, done ? 100 : percent, "%")), failed ? /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-error" }, job.error === void 0 || job.error === null ? t("export.failed") : String(job.error)) : null, error === null ? null : /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-error" }, error), done ? /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-form-row" }, /* @__PURE__ */ import_react6.default.createElement("span", { className: "ve-form-label" }, t("export.outputPath")), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-output-path" }, job.outputPath ?? t("common.unknown")), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-note" }, t("export.openHint"))) : null), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-foot" }, /* @__PURE__ */ import_react6.default.createElement("button", { type: "button", className: "ve-btn ve-btn-ghost", onClick: onClose }, t("export.close")), /* @__PURE__ */ import_react6.default.createElement("div", { className: "ve-modal-grow" }), done ? /* @__PURE__ */ import_react6.default.createElement(
    "a",
    {
      className: "ve-link",
      href: exportFileUrl(sessionId, job.id),
      download: job.filename ?? void 0
    },
    /* @__PURE__ */ import_react6.default.createElement(DownloadIcon, { size: 12 }),
    /* @__PURE__ */ import_react6.default.createElement("span", null, t("export.download"))
  ) : null, done ? /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-btn",
      onClick: () => {
        setJob(null);
        setJobId(null);
        setError(null);
        setFilename(defaultName());
      }
    },
    /* @__PURE__ */ import_react6.default.createElement(ExportIcon, { size: 12 }),
    /* @__PURE__ */ import_react6.default.createElement("span", null, t("export.again"))
  ) : /* @__PURE__ */ import_react6.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-btn ve-btn-primary",
      onClick: () => void start(),
      disabled: running || ffmpegMissing || !cycle
    },
    running ? /* @__PURE__ */ import_react6.default.createElement("span", { className: "ve-spin" }) : /* @__PURE__ */ import_react6.default.createElement(ExportIcon, { size: 12 }),
    /* @__PURE__ */ import_react6.default.createElement("span", null, running ? t("export.running") : t("export.start"))
  ))));
}

// video-editor/src/client/Workbench.jsx
var PRESETS = [
  { id: "1920x1080", width: 1920, height: 1080, key: "preset.landscape1080" },
  { id: "1280x720", width: 1280, height: 720, key: "preset.landscape720" },
  { id: "1080x1920", width: 1080, height: 1920, key: "preset.portrait1080" },
  { id: "1080x1080", width: 1080, height: 1080, key: "preset.square1080" },
  { id: "3840x2160", width: 3840, height: 2160, key: "preset.uhd4k" }
];
var FPS_OPTIONS = [24, 25, 30, 50, 60];
function currentPreset(state) {
  const width = Number.isFinite(state?.width) ? state.width : 1920;
  const height = Number.isFinite(state?.height) ? state.height : 1080;
  const match = PRESETS.find((preset) => preset.width === width && preset.height === height);
  return match === void 0 ? "custom" : match.id;
}
function WorkbenchBody(props) {
  const { sessionId, t, initialFocus, openBus } = props;
  const { state, error, busy, loading, op, refresh, setError, clearError, adoptState } = useWorkbench(sessionId);
  const ping = usePing(sessionId);
  const clock = import_react7.default.useMemo(() => createTimeBus(0), []);
  const [playing, setPlaying] = import_react7.default.useState(false);
  const [selectedClipId, setSelectedClipId] = import_react7.default.useState(null);
  const [exportOpen, setExportOpen] = import_react7.default.useState(false);
  const [titleEditing, setTitleEditing] = import_react7.default.useState(false);
  const [titleDraft, setTitleDraft] = import_react7.default.useState("");
  const [transport, setTransport] = import_react7.default.useState(null);
  const titleRef = import_react7.default.useRef(null);
  const importRef = import_react7.default.useRef(null);
  const focusRequest = import_react7.default.useRef(initialFocus);
  const registerImport = import_react7.default.useCallback((handler) => {
    importRef.current = typeof handler === "function" ? handler : null;
  }, []);
  const registerTransport = import_react7.default.useCallback((api) => {
    setTransport(api === null || api === void 0 ? null : api);
  }, []);
  const requestImport = import_react7.default.useCallback(() => {
    if (importRef.current !== null) {
      importRef.current();
      return;
    }
    if (typeof document === "undefined") return;
    const trigger = document.querySelector('[data-ve-import-trigger="true"]');
    if (trigger !== null && trigger !== void 0 && typeof trigger.focus === "function") trigger.focus();
  }, []);
  import_react7.default.useEffect(() => {
    if (openBus === null || openBus === void 0 || typeof openBus.register !== "function") return void 0;
    const off = openBus.register(() => requestImport());
    return () => {
      if (typeof off === "function") off();
    };
  }, [requestImport, openBus]);
  import_react7.default.useEffect(() => {
    const focus = focusRequest.current;
    focusRequest.current = null;
    if (focus === null || focus === void 0) return void 0;
    if (typeof window === "undefined" || typeof window.setTimeout !== "function") return void 0;
    const timer = window.setTimeout(() => requestImport(), 0);
    return () => window.clearTimeout(timer);
  }, [requestImport]);
  import_react7.default.useEffect(() => {
    if (selectedClipId === null) return;
    if (!hasClip(state, selectedClipId)) setSelectedClipId(null);
  }, [state, selectedClipId]);
  const duration = layoutOfState(state).duration;
  import_react7.default.useEffect(() => {
    if (duration <= 0 && playing) setPlaying(false);
  }, [duration, playing]);
  const setProject = import_react7.default.useCallback((patch) => {
    void op({ type: "setProject", ...patch }).then((result) => {
      if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
    });
  }, [op, setError]);
  const startTitleEdit = import_react7.default.useCallback(() => {
    if (state === null || state === void 0) return;
    setTitleDraft(state.title ?? "");
    setTitleEditing(true);
  }, [state]);
  import_react7.default.useEffect(() => {
    if (!titleEditing) return;
    const input = titleRef.current;
    if (input === null || input === void 0) return;
    if (typeof input.focus === "function") input.focus();
    if (typeof input.select === "function") input.select();
  }, [titleEditing]);
  const commitTitle = import_react7.default.useCallback(() => {
    setTitleEditing(false);
    const next = titleDraft.trim();
    if (next === "" || state !== null && state !== void 0 && next === state.title) return;
    setProject({ title: next });
  }, [titleDraft, state, setProject]);
  const addMediaClip = import_react7.default.useCallback((mediaId) => {
    void op({ type: "addClip", mediaId, track: 0 }).then((result) => {
      if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
    });
  }, [op, setError]);
  const undo = import_react7.default.useCallback(() => {
    void op({ type: "undo" }).then((result) => {
      if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
    });
  }, [op, setError]);
  const redo = import_react7.default.useCallback(() => {
    void op({ type: "redo" }).then((result) => {
      if (result !== null && result !== void 0 && result.ok === false) setError(result.error);
    });
  }, [op, setError]);
  if (error !== null && state === null) {
    return /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-root" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-error-card", style: { marginTop: "auto", marginBottom: "auto" } }, /* @__PURE__ */ import_react7.default.createElement(WarningIcon, { size: 16 }), /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-error-card-body" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-error-card-title" }, t("error.load")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-error-card-detail" }, error)), /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", className: "ve-btn", onClick: () => {
      void refresh();
      clearError();
    } }, /* @__PURE__ */ import_react7.default.createElement(RetryIcon, { size: 12 }), /* @__PURE__ */ import_react7.default.createElement("span", null, t("error.retry")))));
  }
  const preset = currentPreset(state);
  const ffmpegMissing = ping !== null && ping !== void 0 && ping.ffmpeg !== void 0 && ping.ffmpeg.available === false;
  const title = state === null || state === void 0 ? t("toolbar.titlePlaceholder") : String(state.title ?? t("toolbar.titlePlaceholder"));
  const fps = Number.isFinite(state?.fps) ? state.fps : 30;
  const canUndo = state !== null && state !== void 0 && state.canUndo === true;
  const canRedo = state !== null && state !== void 0 && state.canRedo === true;
  return /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-root" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-toolbar" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-brand" }, /* @__PURE__ */ import_react7.default.createElement(FilmIcon, { size: 15 }), /* @__PURE__ */ import_react7.default.createElement("span", { className: "ve-brand-dot" })), titleEditing ? /* @__PURE__ */ import_react7.default.createElement(
    "input",
    {
      ref: titleRef,
      className: "ve-title ve-title-input",
      value: titleDraft,
      onChange: (event) => setTitleDraft(event.target.value),
      onBlur: commitTitle,
      onKeyDown: (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commitTitle();
        }
        if (event.key === "Escape") {
          event.preventDefault();
          setTitleEditing(false);
        }
      },
      maxLength: 80,
      "aria-label": t("toolbar.titleEdit")
    }
  ) : /* @__PURE__ */ import_react7.default.createElement(
    "div",
    {
      className: "ve-title",
      role: "button",
      tabIndex: 0,
      onDoubleClick: startTitleEdit,
      onKeyDown: (event) => {
        if (event.key === "Enter") startTitleEdit();
      },
      title: t("toolbar.titleEdit")
    },
    title
  ), /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-spacer" }), /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-field" }, /* @__PURE__ */ import_react7.default.createElement("span", { className: "ve-field-label" }, t("toolbar.canvas")), /* @__PURE__ */ import_react7.default.createElement(
    "select",
    {
      className: "ve-select",
      value: preset,
      onChange: (event) => {
        const next = PRESETS.find((item) => item.id === event.target.value);
        if (next === void 0) return;
        setProject({ width: next.width, height: next.height });
      },
      "aria-label": t("toolbar.canvas")
    },
    PRESETS.map((item) => /* @__PURE__ */ import_react7.default.createElement("option", { key: item.id, value: item.id }, t(item.key))),
    preset === "custom" ? /* @__PURE__ */ import_react7.default.createElement("option", { value: "custom" }, t("toolbar.custom")) : null
  )), /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-field" }, /* @__PURE__ */ import_react7.default.createElement("span", { className: "ve-field-label" }, t("toolbar.fps")), /* @__PURE__ */ import_react7.default.createElement(
    "select",
    {
      className: "ve-select",
      value: fps,
      onChange: (event) => setProject({ fps: Number(event.target.value) }),
      "aria-label": t("toolbar.fps")
    },
    FPS_OPTIONS.map((item) => /* @__PURE__ */ import_react7.default.createElement("option", { key: item, value: item }, item))
  )), /* @__PURE__ */ import_react7.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-icon-btn",
      onClick: undo,
      disabled: !canUndo || busy || loading,
      title: `${t("toolbar.undo")} \xB7 Ctrl+Z`,
      "aria-label": t("toolbar.undo")
    },
    /* @__PURE__ */ import_react7.default.createElement(UndoIcon, { size: 12 })
  ), /* @__PURE__ */ import_react7.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-icon-btn",
      onClick: redo,
      disabled: !canRedo || busy || loading,
      title: `${t("toolbar.redo")} \xB7 Ctrl+Y`,
      "aria-label": t("toolbar.redo")
    },
    /* @__PURE__ */ import_react7.default.createElement(RedoIcon, { size: 12 })
  ), /* @__PURE__ */ import_react7.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-btn",
      "data-ve-import-trigger": "true",
      onClick: requestImport
    },
    /* @__PURE__ */ import_react7.default.createElement(UploadIcon, { size: 11 }),
    /* @__PURE__ */ import_react7.default.createElement("span", null, t("toolbar.import"))
  ), /* @__PURE__ */ import_react7.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-btn ve-btn-primary",
      onClick: () => setExportOpen(true),
      disabled: ffmpegMissing || duration <= 0
    },
    /* @__PURE__ */ import_react7.default.createElement(ExportIcon, { size: 12 }),
    /* @__PURE__ */ import_react7.default.createElement("span", null, t("toolbar.export"))
  ), ffmpegMissing ? /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-warn-chip", title: t("toolbar.ffmpegHint") }, /* @__PURE__ */ import_react7.default.createElement(WarningIcon, { size: 11 }), /* @__PURE__ */ import_react7.default.createElement("span", null, t("toolbar.ffmpegMissing"))) : null, busy ? /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-busy-chip" }, /* @__PURE__ */ import_react7.default.createElement("span", { className: "ve-spin" }), /* @__PURE__ */ import_react7.default.createElement("span", null, t("toolbar.busy"))) : null), /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-main" }, /* @__PURE__ */ import_react7.default.createElement(
    MediaBin,
    {
      state,
      sessionId,
      op,
      refresh,
      adoptState,
      t,
      onAddClip: addMediaClip,
      busy,
      registerImport
    }
  ), /* @__PURE__ */ import_react7.default.createElement(
    Preview,
    {
      state,
      sessionId,
      clock,
      playing,
      onPlaying: setPlaying,
      t,
      error: null,
      onRegisterApi: registerTransport
    }
  )), /* @__PURE__ */ import_react7.default.createElement(
    Timeline,
    {
      state,
      sessionId,
      op,
      clock,
      t,
      ping,
      selectedClipId,
      onSelectClip: setSelectedClipId,
      transport,
      onImportRequest: requestImport,
      busy,
      playing
    }
  ), error === null ? null : /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-error-inline", style: { position: "absolute", left: 8, right: 8, bottom: 6, margin: 0, zIndex: 7 } }, /* @__PURE__ */ import_react7.default.createElement(WarningIcon, { size: 12 }), /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-error-inline-body" }, t("error.op", { message: error })), /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", className: "ve-mini-btn", onClick: clearError, "aria-label": t("common.close") }, /* @__PURE__ */ import_react7.default.createElement(CloseIcon, { size: 10 }))), /* @__PURE__ */ import_react7.default.createElement(
    ExportDialog,
    {
      sessionId,
      state,
      ping,
      t,
      open: exportOpen,
      onClose: () => setExportOpen(false)
    }
  ));
}
function ErrorCard(props) {
  const { t, message, onRetry } = props;
  return /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-root" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-error-card" }, /* @__PURE__ */ import_react7.default.createElement(WarningIcon, { size: 16 }), /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-error-card-body" }, /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-error-card-title" }, t("error.title")), /* @__PURE__ */ import_react7.default.createElement("div", { className: "ve-error-card-detail" }, message)), /* @__PURE__ */ import_react7.default.createElement("button", { type: "button", className: "ve-btn", onClick: onRetry }, /* @__PURE__ */ import_react7.default.createElement(RetryIcon, { size: 12 }), /* @__PURE__ */ import_react7.default.createElement("span", null, t("error.retry")))));
}
var ViewErrorBoundary = class extends import_react7.default.Component {
  constructor(props) {
    super(props);
    this.state = { failure: null };
    this.handleRetry = this.handleRetry.bind(this);
  }
  static getDerivedStateFromError(failure) {
    return { failure };
  }
  componentDidCatch(failure, info) {
    console.error("[video-editor] workbench render failed:", failure, info);
  }
  handleRetry() {
    this.setState({ failure: null });
  }
  render() {
    const { t } = this.props;
    if (this.state.failure !== null) {
      const message = String(this.state.failure && this.state.failure.message || this.state.failure);
      return /* @__PURE__ */ import_react7.default.createElement(ErrorCard, { t, message, onRetry: this.handleRetry });
    }
    return this.props.children;
  }
};
function Workbench(props) {
  const t = props !== null && props !== void 0 && typeof props.t === "function" ? props.t : (key) => key;
  const sessionId = props !== null && props !== void 0 && typeof props.sessionId === "string" && props.sessionId !== "" ? props.sessionId : void 0;
  if (sessionId === void 0) {
    return /* @__PURE__ */ import_react7.default.createElement(ErrorCard, { t, message: t("error.noSession"), onRetry: () => {
    } });
  }
  let body;
  try {
    body = /* @__PURE__ */ import_react7.default.createElement(
      WorkbenchBody,
      {
        sessionId,
        t,
        initialFocus: props.viewRequest,
        openBus: props.openBus
      }
    );
  } catch (failure) {
    const message = String(failure && failure.message || failure);
    return /* @__PURE__ */ import_react7.default.createElement(ErrorCard, { t, message, onRetry: () => {
    } });
  }
  return /* @__PURE__ */ import_react7.default.createElement(ViewErrorBoundary, { t }, body);
}

// video-editor/src/client/index.jsx
var inject = ["slots", "locale"];
var NS2 = "videoEditor";
var OPEN_EVENT = "dsh-video-editor:open";
var VIEW_ID = "video-editor";
function safe(fn, fallback) {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
function translateOf(props, fallback) {
  return props !== null && props !== void 0 && typeof props.t === "function" ? props.t : fallback;
}
function createOpenBus() {
  const handlers = /* @__PURE__ */ new Set();
  return {
    register(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    dispatch() {
      for (const handler of [...handlers]) {
        safe(handler);
      }
    },
    size() {
      return handlers.size;
    }
  };
}
function OpenerRow(props) {
  const t = translateOf(props, (key) => key);
  const onOpen = props.onOpen;
  const onDismiss = props.onDismiss;
  const activate = () => {
    safe(() => onOpen(VIEW_ID));
    safe(() => onDismiss());
  };
  return import_react8.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-opener-row",
      onClick: activate,
      title: t("opener.title"),
      "data-ve-opener": VIEW_ID
    },
    import_react8.default.createElement("span", { className: "ve-opener-icon" }, import_react8.default.createElement(FilmIcon, { size: 14 })),
    import_react8.default.createElement(
      "span",
      { className: "ve-opener-label" },
      import_react8.default.createElement("span", { className: "ve-opener-title" }, t("opener.title")),
      import_react8.default.createElement("span", { className: "ve-opener-detail" }, t("opener.detail"))
    )
  );
}
function DockStatus(props) {
  const t = translateOf(props, (key) => key);
  const poller = props.poller;
  const sessionId = props.sessionId;
  const [snapshot, setSnapshot] = import_react8.default.useState(null);
  import_react8.default.useEffect(() => {
    if (poller === null || poller === void 0) return void 0;
    if (!isSessionId(sessionId)) return void 0;
    const off = poller.subscribe(sessionId, (next) => setSnapshot(next));
    return () => {
      safe(off);
    };
  }, [poller, sessionId]);
  const count = snapshot === null ? null : snapshot.count;
  const duration = snapshot === null ? 0 : snapshot.duration;
  const minutes = Math.floor(Math.max(0, duration) / 60);
  const seconds = Math.floor(Math.max(0, duration) % 60);
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  const activate = () => {
    if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
    if (typeof CustomEvent !== "function") return;
    safe(() => window.dispatchEvent(new CustomEvent(OPEN_EVENT)));
  };
  return import_react8.default.createElement(
    "button",
    {
      type: "button",
      className: "ve-dock",
      onClick: activate,
      title: t("dock.hint"),
      "data-ve-dock": VIEW_ID
    },
    import_react8.default.createElement("span", { className: "ve-dock-icon" }, import_react8.default.createElement(FilmIcon, { size: 13 })),
    import_react8.default.createElement("span", { className: "ve-dock-label" }, t("dock.label")),
    import_react8.default.createElement("span", { className: "ve-dock-dot" }),
    import_react8.default.createElement("span", { className: "ve-dock-meta" }, t("dock.summary", { count: count === null ? "\u2013" : count, time: clock })),
    import_react8.default.createElement("span", { className: "ve-dock-grow" }),
    import_react8.default.createElement("span", { className: "ve-dock-hint" }, t("dock.hint"))
  );
}
function apply(ctx) {
  const copy = installCopy(ctx);
  const t = copy.t;
  ctx.effect(() => {
    const remove = insertStyles();
    return () => {
      safe(remove);
    };
  }, "video-editor: stylesheet");
  const poller = createDockPoller();
  ctx.effect(() => () => {
    safe(() => poller.dispose());
  }, "video-editor: dock poll timer");
  const openBus = createOpenBus();
  ctx.effect(() => {
    if (typeof window === "undefined" || typeof window.addEventListener !== "function") return () => {
    };
    const onOpen = () => openBus.dispatch();
    window.addEventListener(OPEN_EVENT, onOpen);
    return () => {
      safe(() => window.removeEventListener(OPEN_EVENT, onOpen));
    };
  }, "video-editor: open event listener");
  ctx.slots.inject("conversation.view", () => ctx.slots.register(
    {
      name: "conversation.view",
      id: VIEW_ID,
      order: 20,
      locale: NS2,
      label: () => t("view.label")
    },
    (props) => import_react8.default.createElement(Workbench, { ...props, t: translateOf(props, t), openBus })
  ));
  ctx.slots.inject("conversation.session.header.views.actions", () => ctx.slots.register(
    {
      name: "conversation.session.header.views.actions",
      id: "video-editor.opener",
      order: 0,
      locale: NS2
    },
    (props) => import_react8.default.createElement(OpenerRow, { ...props, t: translateOf(props, t) })
  ));
  ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register(
    {
      name: "conversation.composer.dock",
      id: "video-editor.status",
      order: 12,
      locale: NS2
    },
    (props) => import_react8.default.createElement(DockStatus, { ...props, t: translateOf(props, t), poller })
  ));
}

    return module.exports;
  },
});
