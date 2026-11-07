/**
 * HTTP route conformance test for the workbench API.
 *
 * Boots the plugin's routes against a fake webServer, then drives them with
 * synthetic IncomingMessage/ServerResponse pairs — the same requests the
 * browser view and the agent tool depend on.
 *
 * Run: node video-editor/host/routetest.mjs
 */

import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createTrackedServer } from './test-server.mjs'

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`PASS  ${name}${detail === '' ? '' : `  ${detail}`}`)
  else {
    failures += 1
    console.log(`FAIL  ${name}${detail === '' ? '' : `  ${detail}`}`)
  }
}

const here = fileURLToPath(new URL('.', import.meta.url))
const workspace = join(here, '..', '..')
// Scratch data lives inside the workspace: bundled ffmpeg may write only there.
const scratch = join(workspace, 'tmp-routetest')
await rm(scratch, { recursive: true, force: true })
await mkdir(scratch, { recursive: true })
process.chdir(workspace)
process.env.DSH_HOME = scratch
process.env.DSH_VIDEO_EDITOR_FFMPEG = join(workspace, 'video-editor', 'bin', 'ffmpeg.exe')
process.env.DSH_VIDEO_EDITOR_FFPROBE = join(workspace, 'video-editor', 'bin', 'ffprobe.exe')

function callbackCtx() {
  const effects = []
  const services = new Map()
  const ctx = {
    get(name) {
      return services.get(name)
    },
    provide(name, value) {
      services.set(name, value)
    },
    inject(_deps, callback) {
      callback(ctx)
    },
    effect(callback) {
      const dispose = typeof callback === 'function' ? callback() : undefined
      effects.push(dispose)
      return () => {}
    },
    logger: { warn() {}, info() {} },
    on() {
      return () => {}
    },
  }
  return { ctx, effects, services }
}

try {
  const server = createTrackedServer()
  const { ctx, services } = callbackCtx()
  services.set('webServer', server)
  services.set('tools', { register: () => () => {} })

  const plugin = await import(`../index.js?cache=${Date.now()}`)
  plugin.apply(ctx, {})

  check('plugin registered the workbench prefix route', server.routes.length === 1, JSON.stringify(server.routes.map((route) => `${route.kind} ${route.path}`)))

  const sid = 'session-test'
  const base = `/video-editor/s/${sid}`

  // ping
  let res = await server.dispatch({ method: 'GET', url: `${base}/ping` })
  check('ping 200', res.status === 200, String(res.status))
  check('ping reports ffmpeg available', res.json.ok === true && res.json.ffmpeg.available === true, JSON.stringify(res.json.ffmpeg))

  // state on a fresh session
  res = await server.dispatch({ method: 'GET', url: `${base}/state` })
  check('fresh state 200', res.status === 200)
  check('fresh state has empty media', res.json.state.media.length === 0)
  check('fresh state default canvas', res.json.state.width === 1920 && res.json.state.fps === 30)
  check('state carries media URLs after import later', true)

  // import a real file by path
  res = await server.dispatch({
    method: 'POST',
    url: `${base}/import`,
    body: JSON.stringify({ paths: ['test-media/demo-a.mp4', 'test-media/demo-b.mp4'] }),
  })
  check('import 200', res.status === 200, JSON.stringify(res.json.error ?? ''))
  check('import added two media', res.json.state.media.length === 2, JSON.stringify(res.json.state.media.map((item) => item.name)))
  check('imported media has poster URL', res.json.state.media[0].posterUrl.startsWith('/video-editor/s/session-test/media/'))
  check('imported media probed', res.json.state.media[0].duration > 11 && res.json.state.media[0].width === 1280, JSON.stringify(res.json.state.media[0].duration))

  // missing path fails cleanly
  res = await server.dispatch({
    method: 'POST',
    url: `${base}/import`,
    body: JSON.stringify({ paths: ['test-media/nope.mp4'] }),
  })
  check('bad import returns business error', res.status === 200 && res.json.ok === false, JSON.stringify(res.json))

  // op: add clips
  res = await server.dispatch({ method: 'POST', url: `${base}/op`, body: JSON.stringify({ op: { type: 'addClip', mediaId: 'demo-a', in: 1, out: 4 } }) })
  check('addClip op', res.json.ok === true && res.json.state.clips.length === 1)
  res = await server.dispatch({ method: 'POST', url: `${base}/op`, body: JSON.stringify({ op: { type: 'addClip', mediaId: 'demo-b', out: 3 } }) })
  check('second clip', res.json.state.timeline.main.length === 2 && res.json.state.timeline.duration === 6, String(res.json.state.timeline.duration))

  // op: split
  res = await server.dispatch({ method: 'POST', url: `${base}/op`, body: JSON.stringify({ op: { type: 'split', clipId: 2, at: 4.5 } }) })
  check('split op', res.json.ok === true && res.json.state.timeline.main.length === 3)

  // op: bad request. A malformed BODY is a transport fault (400); a refusal of a
  // well-formed operation is a business failure (200 with ok:false).
  res = await server.dispatch({ method: 'POST', url: `${base}/op`, body: '{not json' })
  check('malformed body rejected as transport error', res.status === 400 && res.json.ok === false, `${res.status} ${JSON.stringify(res.json)}`)

  res = await server.dispatch({ method: 'POST', url: `${base}/op`, body: JSON.stringify({ op: { type: 'nope' } }) })
  check('unknown op business failure', res.status === 200 && res.json.ok === false, JSON.stringify(res.json.error))

  // media streaming with ranges
  const mediaUrl = res.json.state?.media?.[0]?.playUrl ?? `${base}/media/m1`
  res = await server.dispatch({ method: 'GET', url: mediaUrl })
  check('media stream 200', res.status === 200 && res.headers['content-type'] === 'video/mp4', `${res.status} ${res.headers['content-type']}`)
  check('media stream advertises ranges', res.headers['accept-ranges'] === 'bytes')

  res = await server.dispatch({ method: 'GET', url: mediaUrl, headers: { range: 'bytes=0-1023' } })
  check('range 206', res.status === 206)
  check('range content-range correct', /^bytes 0-1023\/\d+$/.test(res.headers['content-range'] ?? ''), res.headers['content-range'])

  res = await server.dispatch({ method: 'GET', url: mediaUrl, headers: { range: 'bytes=999999999-' } })
  check('unsatisfiable range 416', res.status === 416, String(res.status))

  res = await server.dispatch({ method: 'HEAD', url: mediaUrl })
  check('HEAD media 200 without body', res.status === 200 && res.body === null)

  // poster + frame
  res = await server.dispatch({ method: 'GET', url: `${base}/media/m1/poster.jpg` })
  check('poster 200 jpeg', res.status === 200 && res.headers['content-type'] === 'image/jpeg')
  res = await server.dispatch({ method: 'GET', url: `${base}/media/m1/frame.jpg?t=3` })
  check('frame 200 jpeg', res.status === 200 && res.headers['content-type'] === 'image/jpeg')
  res = await server.dispatch({ method: 'GET', url: `${base}/media/mZZ/poster.jpg` })
  check('unknown media 404', res.status === 404)

  // export round trip
  res = await server.dispatch({ method: 'POST', url: `${base}/export`, body: JSON.stringify({ quality: 'fast' }) })
  check('export job created', res.json.ok === true && res.json.job.status !== 'error', JSON.stringify(res.json.job))
  const jobId = res.json.job.id
  let job = res.json.job
  const deadline = Date.now() + 120_000
  while (job.status === 'running' || job.status === 'queued') {
    if (Date.now() > deadline) break
    await new Promise((settle) => setTimeout(settle, 400))
    res = await server.dispatch({ method: 'GET', url: `${base}/export/${jobId}` })
    job = res.json.job
  }
  check('export finished', job.status === 'done', `${job.status} ${job.error ?? ''}`)
  check('export has output path', typeof job.outputPath === 'string' && job.outputPath.length > 0, job.outputPath)
  if (job.status === 'done') {
    res = await server.dispatch({ method: 'GET', url: `${base}/export/${jobId}/file`, method: 'GET' })
    check('export file served', res.status === 200 && (res.headers['content-type'] === 'video/mp4'))
    check('export file has attachment header', String(res.headers['content-disposition'] ?? '').includes('attachment'), res.headers['content-disposition'])
  }

  res = await server.dispatch({ method: 'GET', url: `${base}/export` })
  check('export listing', res.json.ok === true && res.json.jobs.length >= 1)

  // session isolation
  res = await server.dispatch({ method: 'GET', url: '/video-editor/s/other-session/state' })
  check('second session starts empty', res.json.state.media.length === 0 && res.json.state.clips.length === 0)

  // route fencing
  res = await server.dispatch({ method: 'GET', url: '/video-editor/s/../../etc/state' })
  check('path traversal rejected', res.status === 404, String(res.status))

  // undo via HTTP
  res = await server.dispatch({ method: 'POST', url: `${base}/op`, body: JSON.stringify({ op: { type: 'undo' } }) })
  check('undo over HTTP', res.json.ok === true && res.json.state.canRedo === true)
} finally {
  await rm(scratch, { recursive: true, force: true })
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
