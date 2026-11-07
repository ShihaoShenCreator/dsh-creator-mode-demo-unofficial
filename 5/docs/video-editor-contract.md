# Video editing workbench — interface contract (v1)

Package: `@local/video-editor` (Cordis bundle, one Host half + one Client half).
Install target: `C:\Users\Shihao\Documents\deepseek-harness\default-workspace\5\video-editor`
Session-scoped: every project belongs to the Session whose id addresses it.

Two halves share exactly this contract. Host owns all data and media; Client is a view + polling client.

## 1. Host HTTP API

Route prefix `/video-editor`. All routes are fenced like other plugins: same-origin
loopback only. `:sid` is a Session id, validated `^[A-Za-z0-9._-]{1,120}$`.

| Method | Path | Body | Response |
|---|---|---|---|
| GET  | `/video-editor/s/:sid/state` | – | `{ ok:true, state }` |
| POST | `/video-editor/s/:sid/op` | `{ op: Op }` | `{ ok:true, state }` or `{ ok:false, error }` |
| POST | `/video-editor/s/:sid/media` | raw file bytes, header `x-file-name`, `content-type` | `{ ok:true, state, media }` |
| POST | `/video-editor/s/:sid/import` | `{ paths: string[] }` | `{ ok:true, state, imported:[media], skipped:[{path,reason}] }` |
| GET  | `/video-editor/s/:sid/media/:mediaId` | – (Range supported) | video bytes, `content-type` by extension |
| GET  | `/video-editor/s/:sid/media/:mediaId/poster.jpg` | – | JPEG poster (frame at 10% of duration), 320px wide |
| GET  | `/video-editor/s/:sid/media/:mediaId/frame.jpg?t=12.3` | – | JPEG filmstrip frame, 160px wide |
| POST | `/video-editor/s/:sid/export` | `{ filename?, quality?: 'high'\|'fast', width?, height?, fps? }` | `{ ok:true, jobId, state }` |
| GET  | `/video-editor/s/:sid/export` | – | `{ ok:true, jobs:[Job] }` |
| GET  | `/video-editor/s/:sid/export/:jobId` | – | `{ ok:true, job:Job }` |
| GET  | `/video-editor/s/:sid/export/:jobId/file` | – | mp4 download (`content-disposition: attachment`) |
| GET  | `/video-editor/s/:sid/ping` | – | `{ ok:true, ffmpeg:{available:boolean, version?:string}, ffprobe:{available:boolean} }` |

Client polls `GET .../state` (about 900 ms while the workbench view is visible) and compares
`state.revision`; the agent tool mutates the same Host store, so agent edits appear in the UI
without a reload. `GET .../export` is polled only while an export job is unfinished.

### State (authoritative JSON)

```ts
interface ProjectState {
  sessionId: string
  revision: number                  // monotonic; every mutation bumps it
  title: string
  width: number                     // program canvas, default 1920
  height: number                    // default 1080
  fps: number                       // default 30
  media: MediaItem[]
  clips: Clip[]                     // track 0 = main (magnetic, contiguous); track 1 = overlay
  timeline: {
    main: Array<{ clipId: string; start: number; end: number; duration: number }>
    overlays: Array<{ clipId: string; start: number; end: number; duration: number }>
    duration: number                // main track length (overlays past the end extend it)
  }
  canUndo: boolean
  canRedo: boolean
  updatedAt: number
}

interface MediaItem {
  id: string                        // "m1", "m2" ... stable
  name: string                      // display name (file name)
  sourcePath: string                // absolute path on the host
  origin: 'upload' | 'path'
  duration: number                  // seconds
  width: number
  height: number
  fps: number
  hasAudio: boolean
  size: number                      // bytes
  addedAt: number
  playUrl: string                   // "/video-editor/s/<sid>/media/<id>"
  posterUrl: string                 // "/video-editor/s/<sid>/media/<id>/poster.jpg"
  frameUrl: string                  // "/video-editor/s/<sid>/media/<id>/frame.jpg"
}

interface Clip {
  id: string                        // "c1", "c2" ...
  mediaId: string
  track: 0 | 1                      // 0 main sequence, 1 overlay (picture-in-picture)
  in: number                        // source in-point, seconds
  out: number                       // source out-point, seconds (> in)
  // track 1 only:
  start?: number                    // timeline start, seconds
  x?: number                        // overlay left, canvas px, default 0
  y?: number                        // overlay top, canvas px, default 0
  scale?: number                    // overlay width as fraction of canvas width, default 0.4
}
```

Main-track clips are ordered by their position in `clips` (array order among track 0).
The timeline lays them out contiguously in that order — no gaps, magnetic timeline.

### Operations (one logic for UI and tool)

```ts
type Op =
  | { type:'importPath'; paths: string[] }
  | { type:'removeMedia'; mediaId: string }
  | { type:'addClip'; mediaId: string; in?: number; out?: number; track?: 0|1;
      start?: number; x?: number; y?: number; scale?: number }
  | { type:'trim'; clipId: string; in: number; out: number }
  | { type:'split'; clipId: string; at: number }          // at = timeline seconds
  | { type:'delete'; clipIds: string[] }
  | { type:'move'; clipId: string; toIndex: number }      // main track reorder (0-based)
  | { type:'updateOverlay'; clipId: string; start?, x?, y?, scale? }
  | { type:'setProject'; title?: string; width?: number; height?: number; fps?: number }
  | { type:'undo' }
  | { type:'redo' }
```

Returns `{ ok:true, state }`; an op failure is `{ ok:false, error }` with an HTTP 200
(business failure, not transport). Undo/redo keeps at least 40 steps per Session.

### Export job

```ts
interface ExportJob {
  id: string
  status: 'queued' | 'running' | 'done' | 'error'
  progress: number                  // 0..1
  filename: string                  // output file name, e.g. "edit-2026-01-01.mp4"
  outputUrl?: string                // "/video-editor/s/<sid>/export/<jobId>/file"
  outputPath?: string               // absolute host path once done
  duration?: number
  error?: string
  createdAt: number
  finishedAt?: number
}
```

Export pipeline: main clips concatenated with per-clip trim + scale/pad to the project
canvas, audio concatenated (silent audio substituted for sources without an audio stream),
overlay clips composited with `overlay` + `enable=between(t,start,end)`, H.264 + AAC, `+faststart`.
`quality: 'fast'` uses a faster preset; default `high` uses `medium`, crf 20.

## 2. Agent tool

Tool name `video_editor`, actions on the session's project (session from the calling agent):

```
action: 'open'        -> state summary + a note that the workbench view is "剪辑工作台"
action: 'state'       -> same summary
action: 'import'      { paths: string[] }             paths resolved against the session cwd
action: 'add_clip'    { media: string; in?: number; out?: number; track?: 0|1; start?: number }
action: 'trim'        { clip: string|number; in: number; out: number }   // 1-based main index or id
action: 'split'       { clip: string|number; at: number }               // timeline seconds
action: 'delete'      { clips: Array<string|number> }
action: 'move'        { clip: string|number; toIndex: number }          // 0-based
action: 'set_project' { title?, width?, height?, fps? }
action: 'export'      { filename?, quality? }          // waits for completion (tool result)
action: 'export_async'{ filename?, quality? }          // returns job immediately
```

`media` accepts a media name (case-insensitive, unique prefix) or a media id.
Tool result text: a compact project summary (clips with times, media list, duration) plus
the resulting path for export. Errors: `Error: <reason>` via a thrown tool error.

## 3. Client half

Client module id `@local/video-editor`; registers:

1. `conversation.view` list entry `{ id: 'video-editor', order: 20, label: '剪辑工作台' }`
   — a tab beside Chat/Trajectory. Its component renders the workbench.
2. `conversation.composer.dock` list entry `{ id: 'video-editor.opener', order: 10 }`
   — a compact pill: "剪辑工作台" with media count; clicking it must open the view.
   The dock entry cannot call openView directly, so it broadcasts a `CustomEvent`
   `dsh-video-editor:open` on `window`; the workbench view (and the header tab) listen.
   Implementation detail: the view entry also registers a window listener so that when the
   user clicks the view tab, no action is needed.

Client responsibilities:
- Fetch + poll `state`; optimistic local updates are NOT allowed (all mutations go through `op`).
- Upload: file picker / drag & drop → `POST /media` raw bytes, then refresh state.
- Preview: `<video>` element playing the main sequence: at each time pick the active main
  clip, seek to `in + localTime`, play to `out`, advance. Overlay clips render as a second
  `<video>` absolutely positioned/scaled above the main one.
- Timeline: tracks, clip blocks with filmstrip background, trim handles, drag to reorder,
  playhead scrub, zoom, ruler with time labels, keyboard: Space play/pause, S split at
  playhead, Delete removes selected clip, arrow keys step 1 frame, Ctrl+Z/Y undo/redo.
- Media bin: import button, drag&drop, thumbnails, add-to-timeline, remove.
- Export dialog: filename, quality, progress bar polling the job, download link, host path.
- Dark editor look: scoped `--ve-*` palette in the component's own stylesheet; never rely on
  light host tokens for the workbench surface. It must still sit inside the host frame with
  no overflow of the app shell (workbench is its own scroll container).
- All visible copy goes through the `locale` service namespace `videoEditor` (zh + en).
