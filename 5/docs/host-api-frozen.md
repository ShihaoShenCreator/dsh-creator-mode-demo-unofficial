# Host API conformance for the workbench UI

The UI polls and calls a small set of routes. These shapes are frozen; the Host
implementation in `video-editor/index.js` is written against this exact table.

## Bases

```
base = /video-editor/s/<sessionId>
```

`<sessionId>` is opaque, URL-safe, and comes from `props.sessionId`.

## Endpoints

### `GET {base}/state`
`200 { ok:true, state:ProjectState }` — polled every ~900 ms while visible.

### `POST {base}/op`
Body `{ op: { type, ... } }`. `200 { ok:true, state }` on success (the new state is
authoritative — adopt it directly), `200 { ok:false, error }` for a business refusal.

Ops the UI sends:

| type | payload | notes |
|---|---|---|
| `trim` | `{ clipId, in, out }` | seconds in the source media |
| `split` | `{ clipId, at }` | `at` is timeline seconds |
| `delete` | `{ clipIds: [id] }` | |
| `move` | `{ clipId, toIndex }` | 0-based main-track index |
| `updateOverlay` | `{ clipId, start?, x?, y?, scale? }` | |
| `addClip` | `{ mediaId, in?, out?, track?, start?, x?, y?, scale? }` | |
| `removeMedia` | `{ mediaId }` | refuses while clips still use it |
| `setProject` | `{ title?, width?, height?, fps? }` | |
| `undo` / `redo` | `{}` | |

### `POST {base}/media`
Raw video bytes; headers `content-type: video/*`, `x-file-name: <encodeURIComponent(name)>`.
`200 { ok:true, state, media }`. One file per request; the UI uploads concurrently up to 3.

### `POST {base}/import`
Body `{ paths: string[] }` — host-side paths (absolute, or relative to the session cwd).
`200 { ok:true, state, imported }`; a path that is not a readable video fails the whole
call with `ok:false` and a message listing the offending path.

### `POST {base}/export`
Body `{ filename?, quality? }`. `200 { ok:true, job }`.

### `GET {base}/export`
`200 { ok:true, jobs }` — every job for this Session, newest last.

### `GET {base}/export/{jobId}`
`200 { ok:true, job }`.

### `GET {base}/export/{jobId}/file`
`200` mp4 body with `content-disposition: attachment`.

### `GET {base}/ping`
`200 { ok:true, ffmpeg:{available}, ffprobe:{available} }` — used once per mount to show a
warning banner when the binaries are missing.

### Media assets
- `GET {base}/media/{mediaId}` — the video bytes (Range supported; the preview `<video>` relies on it).
- `GET {base}/media/{mediaId}/poster.jpg` — 320px-wide JPEG.
- `GET {base}/media/{mediaId}/frame.jpg?t=<seconds>` — 160px-wide JPEG for filmstrips.

All media asset URLs are already present on each `MediaItem` (`playUrl`, `posterUrl`,
`frameUrl`) — never construct them by hand in the UI.

## Failure handling

`ok:false` responses carry a human string; show it as an inline notice (not an alert).
Transport failures are retried once by the poll loop, then surfaced as a small
"连接中断，正在重试" chip; the page keeps showing the last good state.
