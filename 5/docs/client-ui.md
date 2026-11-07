# Client workbench UI spec (teammate B scope)

Build the browser half of the video workbench. Read `docs/video-editor-contract.md` first —
it owns the HTTP API and the state shape. This file owns layout, interaction, styling and code
organisation.

Source tree (yours to create):

```
video-editor/src/client/
  index.jsx        entry: exports `apply(ctx)`; registers locale dicts, the view, the More-menu
                   row, and the composer-dock status pill
  copy.js          zh + en dictionaries and the `t` helper
  api.js           fetch helpers for the routes (state/op/media/import/poster/frame/export/ping)
  model.js         pure timeline math (clip layout, total duration, time→clip lookup)
  Workbench.jsx    the workbench page component (layout + preview + timeline + dialogs)
  MediaBin.jsx     media library column
  Preview.jsx      preview stage + transport bar + playback engine
  Timeline.jsx     ruler, tracks, clips, trim/drag/scroll/zoom
  ExportDialog.jsx export modal
  styles.js        the scoped stylesheet as a template string
```

`node tools/build.mjs` (run from the workspace root) compiles everything to `video-editor/client.js`.
Run it after every change; the build must stay green. Never edit `client.js` by hand.

## Hard constraints

- No imports of Harness Client packages (`@deepseek-ai/dsh-client-ui-primitives` or anything
  else from `@deepseek-ai/*`). Only `react` / `react-dom` are provided by the module table.
- No JSX runtime packages: the build uses `jsxFactory: React.createElement`, so `import React from 'react'`
  must appear in every file that renders JSX.
- Only `ctx.slots`, `ctx.locale`, `ctx.effect` and plain browser APIs. Register everything inside
  `ctx.slots.inject(...)` / `ctx.effect(...)` so unload cleans up.
- The component must never throw during render: wrap the whole body in `try/catch` and render a
  compact error card with a Retry button instead. Fetch failures render inline, never throw.
- All user-visible copy must come from the `videoEditor` locale namespace (zh primary, en fallback).
  Register with `ctx.locale.register('videoEditor', 'zh', zhDict)` and the same for `'en'`;
  `const t = ctx.locale.bind('videoEditor')`, and subscribe to `ctx.locale.subscribe` to re-render
  on language change.
- Styles: one scoped stylesheet inserted with `ctx.effect(() => styles.insert(css))` (the
  `styles` helper is available as a global in the plugin factory's scope only if declared in
  `dsh.client` — it is not; so insert a `<style data-plugin-css="video-editor">` element
  yourself inside `apply` with `ctx.effect` cleanup and a stable id). Every selector is prefixed
  `.ve-`; no global resets. Dark NLE palette as CSS custom properties on `.ve-root`
  (`--ve-bg: #101216; --ve-panel: #171a21; --ve-panel-2: #1f232c; --ve-line: #2b303b; --ve-text: #e6e9ef;
  --ve-dim: #98a1b0; --ve-accent: #4c8dff; --ve-accent-2: #7aa8ff; --ve-danger: #ff5f57;`
  `--ve-warn: #e7b24c; --ve-track: #12151a;`). Text is `system-ui` stack; numbers use
  `font-variant-numeric: tabular-nums`.
- Sizes: the workbench fills its view area; it is its own scroll container
  (`height:100%; overflow:hidden; display:flex; flex-direction:column`). The preview region
  flexes (`flex:1 1 auto; min-height:240px`) and the timeline is `flex:0 0 42%; min-height:200px`.
  Media bin is a `flex:0 0 224px` column left of the preview.

## Slot registrations (exact)

```js
ctx.slots.inject('conversation.view', () => ctx.slots.register(
  { name: 'conversation.view', id: 'video-editor', order: 20, label: () => t('view.label') },
  Workbench,
))
```

- `conversation.session.header.views.actions` (list, root scope): one row opening the view.
  registration: `{ name, id: 'video-editor.opener', order: 0 }`; component receives
  `entries`, `onOpen`, `onDismiss`. Render one menu row button “剪辑工作台 / Video workbench”,
  `onClick = () => { onOpen('video-editor'); onDismiss() }`. Style it like a menu row
  (`display:flex; gap:8px; width:100%; padding:7px 10px; border:0; background:transparent;
  color:var(--ve-text); cursor:pointer; border-radius:6px`), hover uses `--ve-panel-2`.
  This row is the reliable programmatic opener (`onOpen` is the documented "select a View" API).
- `conversation.composer.dock` (list, session scope): `{ name, id: 'video-editor.status', order: 12 }`.
  A one-line status strip, height 26px: a small film glyph, `t('dock.label')`, `· N 素材 · MM:SS`
  (from a `GET state` poll — poll every 1.5 s while mounted, stop on unmount with
  `ctx.effect` cleanup), and a subtle hint `t('dock.hint')`. Clicking it dispatches
  `window.dispatchEvent(new CustomEvent('dsh-video-editor:open'))`; Workbench listens for that
  event while mounted (focus the import action). It must look like a quiet ambient row
  (border `1px solid var(--ve-line)`, `border-radius:8px`, background `var(--ve-panel)`), not a
  big button, and must be visually fine on both host themes.

## Layout

```
.toolbar  (40px)   project title (editable on double click) · canvas preset select · fps select ·
                    undo / redo · Import · Export · ping warning (ffmpeg missing)
.ve-main  (flex:1)  [ MediaBin 224px ] [ Preview flex:1 ]
.timeline (42%)     header row: 时间轴 · zoom slider · fit button · total duration
                    ruler, track labels (主视频 / 叠加层), clips, playhead
```

Media bin: header “素材” + `+ 导入` button (file input, `accept="video/*"`, multiple) + drop
zone over the whole bin; rows: 64x36 poster thumb, name (2-line clamp), `MM:SS`, and a `+` button
(add to main track end, `addClip`) and a `…`? keep: only `+` and a trash button. Dragging a row
starts a drag with `dataTransfer.setData('application/x-ve-media', mediaId)`.

Preview: centered box with letterboxing (`aspect-ratio: <w>/<h>`, max width/height 100%);
inside, an absolutely positioned stack: main `<video>` (object-fit: contain, black bg) and up to
two overlay `<video>`s positioned with `left:xpx; top:ypx; width:scale*100%` scaled by the
letterbox scale (use percentage positioning of the inner stage box so it maps 1:1 to the canvas
coordinate space). Transport bar under the box: play/pause, `current / total` with frame counter,
`-1 帧` / `+1 帧`, volume slider (0-100, applied to both videos), `适合窗口` toggle (fit / 100%).

Timeline: 
- header: label, `总时长 MM:SS:FF`, zoom range `40..400 px/s` (default 110), fit button.
- ruler: ticks every `chooseStep(pxPerSec)` (1/2/5/10/30/60 s) with `mm:ss` labels; click/drag
  seeks; the playhead is a red 2px line spanning ruler + both tracks with a handle triangle at the ruler.
- rows: track 0 (主视频, magnetic, contiguous) and track 1 (叠加层, free position). Each row is
  `position:relative; height:56px; background:var(--ve-track); border-top:1px solid var(--ve-line)`.
- clip block: absolutely positioned `left = start*pxPerSec`, `width = duration*pxPerSec`;
  background filmstrip built from up to 6 evenly spaced `frameUrl?t=` images
  (`img.draggable=false`, `object-fit:cover`, height 100%), a translucent dark overlay for the
  title row; top-left name + duration; selected => 2px `--ve-accent` border; hover shows
  `--ve-accent-2` border. Trim handles: 8px zone at each edge, `cursor: ew-resize`.
  Main clips: dragging the body reorders (`move` with `toIndex` computed from drop x); overlay
  clips: dragging the body moves `start`. Dragging the right handle of a main clip trims `out`
  (min 0.2 s and keep contiguous), left handle trims `in`.
- empty timeline: dashed hint `从素材库添加片段，或把视频拖到这里` and accepts a media drop
  (adds a clip at the end of the main track).
- keyboard while focused (attach listeners to the timeline root with `tabIndex=0`): Space toggles
  play, `S` splits the selected clip at the playhead, `Delete`/`Backspace` deletes the selection,
  `←/→` step one frame, `Shift+←/→` 1 s, `Ctrl+Z` undo, `Ctrl+Shift+Z` / `Ctrl+Y` redo.
  Guard against typing in an input.
- Wheel over timeline with `ctrl` zooms around the pointer; plain wheel scrolls horizontally.

## Data flow

- One `useWorkbench(sessionId)` hook (in `api.js` or `model.js`): holds `state`, `error`,
  `busy`, does `GET state` on mount, polls only while `document.visibilityState === 'visible'`
  every 900 ms, compares `revision`, and exposes `op(payload)` which POSTs and adopts the
  returned state (optimistic UI not allowed; a 40 ms op round-trip is fine).
- Playback: `Preview` owns `time` (timeline seconds, in a ref + state at ~30 Hz), `playing`.
  On play: drive the clock with `requestAnimationFrame` using wall time deltas; the main video
  element follows the clock (seek only when drift > 0.25 s). At a clip boundary, switch src to
  the next clip (a 2-element pool so the incoming element can preload). Overlay videos follow
  their own window `[start, start+len)`; outside it they pause.
- Trim/split/delete/move all call `op`. After any op the polled state replaces local state
  (the response already carries the new state, so no extra fetch is needed).

## Export dialog

Dark modal (`.ve-modal-backdrop` fixed inset 0 z-index 20, `.ve-modal` 420px panel). Fields:
filename `<input>` (default `edit-YYYYMMDD-HHmmss.mp4`), quality `<select>` (高清 / 快速),
progress bar (0-100 %), status text, `导出` disabled while running, `下载` link when done,
`打开所在位置` hint showing `outputPath` in monospace, `关闭`. Poll
`GET .../export/<jobId>` every 600 ms while running. On error show `job.error`.

## Verification you must do

1. `node tools/build.mjs` exits 0 and `video-editor/client.js` begins with the
   `window.__ModuleLoader__.load({ id: '@local/video-editor', ... })` handoff.
2. `node --check video-editor/client.js` parses (classic script syntax).
3. Every file in `src/client/` imported by `index.jsx` is reachable from the bundle
   (grep the built file for a distinctive string from each module).
4. Loading the bundle must not touch the network, DOM or React at script execution time: the
   only top-level statement is `window.__ModuleLoader__.load(...)`. Simulate with
   `node -e "globalThis.window={__ModuleLoader__:{load(handoff){...}}}; require('./video-editor/client.js')"`-style
   check: the factory must be registered without executing it.
5. In a factory-execution smoke test run under Node with a stubbed `ctx` (fake `slots.inject`
   and `locale.register/bind/subscribe`), `apply(ctx)` must register exactly the three expected
   slot entries and return without throwing. Put the fake in `/tmp`-style scratch (workspace
   `tmp-clienttest/`), not in the package.
