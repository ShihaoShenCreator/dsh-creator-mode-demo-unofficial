# Host internals: media + render modules (teammate A scope)

Two self-contained Node modules. No DSH imports, no network, no UI. Pure Node 20+ ESM.
Bundled binaries (already present, verified working):
- `video-editor/bin/ffmpeg.exe`  (ffmpeg N-92722, has libx264/aac)
- `video-editor/bin/ffprobe.exe` (ffprobe 5.1)

## File: `video-editor/host/media.js`

```js
export function createMediaLibrary(options: {
  dir: string          // session's storage dir, e.g. <home>/video-editor/<sid>
  ffmpegPath: string
  ffprobePath: string
}): MediaLibrary
```

`MediaLibrary` members:

```ts
probe(sourcePath: string): Promise<{          // ffprobe; throws Error('...') on unsupported/corrupt input
  duration: number; width: number; height: number; fps: number;
  hasAudio: boolean; size: number; codec: string;
}>
saveUpload(fileName: string, bytes: Buffer): Promise<string>  // returns absolute stored path under <dir>/media/
                                                              // deterministic safe name, keeps extension; never overwrite
importFromPath(sourcePath: string): Promise<string>           // verify readable video file; returns the SAME source path
                                                              // (external files are referenced in place, not copied)
poster(sourcePath: string, mediaId: string): Promise<string>  // JPEG at 10% duration (min 0.1s), width 320, cached at
                                                              // <dir>/poster/<mediaId>.jpg; returns cached path when the file exists
frame(sourcePath: string, mediaId: string, t: number): Promise<string> // JPEG at time t, width 160, cached at
                                                              // <dir>/frame/<mediaId>/<ms>.jpg
sendVideo(req: IncomingMessage, res: ServerResponse, sourcePath: string, contentType: string): void
                                                              // stream with HTTP Range support (206/416), correct
                                                              // content-length; HEAD omits the body
```

Rules:
- Poster/frame extraction: `ffmpeg -y -ss <t> -i <src> -frames:v 1 -vf scale=320:-2 -q:v 4 <out>`, atomically
  (write to `<out>.tmp` then rename). Two concurrent requests for the same frame must not corrupt the file.
- `frame` time is quantized to 0.1 s; clamp to `[0, duration - 0.05]`.
- Bad media: `probe` rejects with a message naming the file; never throws raw ffprobe stderr at the caller.
- No leaked processes: always await child exit; cap stderr capture; kill on timeout (30 s for probe/poster/frame).
- Use `child_process.execFile` with `windowsHide: true`.
- `sendVideo` must handle a request whose Range header is malformed by ignoring it (200 full), and
  `bytes=N-` open-ended ranges.

## File: `video-editor/host/render.js`

```js
export function createRenderer(options: {
  dir: string
  ffmpegPath: string
  ffprobePath: string
}): Renderer
```

`Renderer` members:

```ts
run(spec: RenderSpec, onProgress: (progress: number) => void, signal?: AbortSignal): Promise<RenderResult>
```

```ts
interface RenderSpec {
  canvas: { width: number; height: number; fps: number }
  quality: 'high' | 'fast'
  outputPath: string                 // absolute; parent dir created by caller
  main: Array<{                      // timeline order, contiguous
    sourcePath: string
    in: number; out: number
    hasAudio: boolean
  }>
  overlays: Array<{
    sourcePath: string
    in: number; out: number
    start: number                    // timeline start
    x: number; y: number             // canvas px, top-left
    scale: number                    // width fraction of canvas
  }>
}
interface RenderResult { outputPath: string; duration: number }
```

Behavior:
- Empty `main` → throw `Error('时间轴上还没有片段')`-style message (English in code,
  `no clips on the timeline`) before spawning.
- Build ONE ffmpeg invocation with `-filter_complex`:
  - normalize each main input: `trim` by in/out, `setpts`, `scale` preserving aspect and
    `pad` to the canvas, `setsar=1`, `fps=<canvas fps>`; concat with the `concat` filter.
  - audio: for sources with audio use `atrim`/`asetpts` and `aresample=44100`; for sources without
    audio synthesize silence of the clip duration (`anullsrc` or `aevalsrc=0`); `concat` audio.
  - overlays: scale by `scale` fraction, then `overlay=x:y:enable='between(t,start,start+len)'`
    applied after the main concat; overlay length = `out-in`; if the overlay extends past the
    main duration it is truncated by the base stream (that is acceptable — never fail for it).
  - output: `-c:v libx264 -preset <medium|veryfast> -crf 20 -pix_fmt yuv420p -c:a aac -b:a 160k
    -movflags +faststart -r <fps>`.
  - `-progress pipe:1 -nostdin -hide_banner -loglevel error` and parse `out_time_ms=` lines into
    progress in `[0, 0.99]` (final 1.0 after exit 0).
  - Estimate total duration from the main clips and pass it back in `RenderResult.duration`.
- Abort: `signal` → kill the child (`taskkill /pid <pid> /t /f` on Windows fallback, child.kill first),
  reject with `Error('export cancelled')`.
- Non-zero exit → reject with the last 400 chars of stderr (never leave the partial file behind:
  unlink it).
- Windows path quirks: pass `-i` values as absolute paths; ffmpeg filtergraph paths are not involved
  (inputs are `-i` arguments, so no escaping problem). Keep filter labels ASCII.

## Self-test (must be runnable, left in the workspace)

`video-editor/host/selftest.mjs` — `node video-editor/host/selftest.mjs`
1. probe `test-media/demo-a.mp4` and `test-media/demo-b.mp4` (created already) and print metadata.
2. poster + 2 frames for demo-a; assert files exist and are non-empty JPEG (start with FF D8).
3. render a 6 s cut: demo-a in 1..4 + demo-b in 0..3 at 1280x720 30fps with one overlay
   (demo-b at scale 0.35, x=820, y=430, start 1) → `tmp-render/out.mp4`; assert exit 0,
   file > 20 kB, and `probe` reports duration ≈ 6 s (allow ±0.3 s).
4. print PASS/FAIL lines and exit non-zero on any failure.
Clean up only files it created itself.
