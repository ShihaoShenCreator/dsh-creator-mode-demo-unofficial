/**
 * Project state machine unit test — no ffmpeg, no filesystem.
 *
 * Run: node video-editor/host/projecttest.mjs
 */

import { createProjects, layout, resolveMedia } from './project.js'

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`PASS  ${name}${detail === '' ? '' : `  ${detail}`}`)
  else {
    failures += 1
    console.log(`FAIL  ${name}${detail === '' ? '' : `  ${detail}`}`)
  }
}

const fakeMedia = {
  async probe(path) {
    if (path.includes('missing')) throw new Error('无法读取该文件')
    return { duration: path.includes('b.mp4') ? 8 : 12, width: 1280, height: 720, fps: 30, hasAudio: !path.includes('b.mp4'), size: 1000 }
  },
}
const documents = new Map()
const projects = createProjects({
  media: fakeMedia,
  read: async (sessionId) => documents.get(sessionId) ?? null,
  write: async (sessionId, document) => {
    documents.set(sessionId, document)
  },
  resolvePath: async (candidate) => (candidate.startsWith('/') ? candidate : `/media/${candidate}`),
})

const sid = 's1'
const a = await projects.apply(sid, { type: 'importPath', paths: ['a.mp4', 'b.mp4'] })
check('imports both media', a.media.length === 2, a.media.map((item) => `${item.id}:${item.name}`).join(','))
check('media ids sequential', a.media[0].id === 'm1' && a.media[1].id === 'm2')
check('poster url built', a.media[0].posterUrl === '/video-editor/s/s1/media/m1/poster.jpg', a.media[0].posterUrl)
check('revision starts at 1', a.revision === 1, String(a.revision))

let s = await projects.apply(sid, { type: 'addClip', mediaId: 'a', out: 4 })
check('add clip by name', s.clips.length === 1, JSON.stringify(s.clips[0]))
check('default in=0 out=duration clamp', s.clips[0].in === 0 && s.clips[0].out === 4)

s = await projects.apply(sid, { type: 'addClip', mediaId: 'm2', out: 3 })
check('two clips contiguous', s.timeline.main.length === 2 && s.timeline.main[1].start === 4, JSON.stringify(s.timeline.main))
check('duration 7', s.timeline.duration === 7, String(s.timeline.duration))

// out beyond source duration clamps
s = await projects.apply(sid, { type: 'addClip', mediaId: 'b', in: 5, out: 99 })
check('out clamps to media duration', s.clips.at(-1).out === 8, String(s.clips.at(-1).out))

// trim
s = await projects.apply(sid, { type: 'trim', clipId: 1, in: 1.25, out: 3.5 })
check('trim applied', s.clips[0].in === 1.25 && s.clips[0].out === 3.5)
check('layout follows trim', s.timeline.main[0].duration === 2.25, String(s.timeline.main[0].duration))

// split at 1.0 → clip 1 becomes 0..1 and 1..2.25
s = await projects.apply(sid, { type: 'split', clipId: 1, at: 1 })
check('split produced 4 main clips', s.timeline.main.length === 4, String(s.timeline.main.length))
check('split windows', s.clips[0].in === 1.25 && s.clips[0].out === 2.25 && s.clips[1].in === 2.25 && s.clips[1].out === 3.5,
  JSON.stringify([s.clips[0], s.clips[1]]))

// split near the edge refuses
let threw = ''
try {
  await projects.apply(sid, { type: 'split', clipId: 1, at: 0.02 })
} catch (error) {
  threw = error.message
}
check('edge split refused', threw !== '', threw)

// move
const beforeOrder = s.clips.filter((clip) => clip.track === 0).map((clip) => clip.id)
s = await projects.apply(sid, { type: 'move', clipId: 1, toIndex: 2 })
const afterOrder = s.clips.filter((clip) => clip.track === 0).map((clip) => clip.id)
check('move reorders main track', afterOrder[2] === beforeOrder[0], `${beforeOrder} -> ${afterOrder}`)

// undo / redo
s = await projects.apply(sid, { type: 'undo' })
check('undo restores order', JSON.stringify(s.clips.filter((clip) => clip.track === 0).map((clip) => clip.id)) === JSON.stringify(beforeOrder))
check('canRedo true after undo', s.canRedo === true)
s = await projects.apply(sid, { type: 'redo' })
check('redo re-applies', JSON.stringify(s.clips.filter((clip) => clip.track === 0).map((clip) => clip.id)) === JSON.stringify(afterOrder))

// delete
s = await projects.apply(sid, { type: 'delete', clipIds: [1] })
check('delete by index', s.timeline.main.length === 3)

// overlay: an 8s overlay over a ~5s programme must stay visible, so layout
// slides it in whole rather than letting it hang off the end.
s = await projects.apply(sid, { type: 'addClip', mediaId: 'b', track: 1, start: 1, x: 800, y: 400, scale: 0.3 })
check('overlay fields', s.clips.at(-1).track === 1 && s.clips.at(-1).x === 800 && s.clips.at(-1).scale === 0.3, JSON.stringify(s.clips.at(-1)))
const overlayFit = s.timeline.overlays[0]
check('overlay in layout', s.timeline.overlays.length === 1
  && overlayFit.start >= 0
  && overlayFit.end <= s.timeline.duration
  && Math.abs(overlayFit.start + overlayFit.duration - overlayFit.end) < 0.001,
  JSON.stringify(overlayFit))
check('overlay keeps the requested start in the clip record', s.clips.at(-1).start === 1, String(s.clips.at(-1).start))
s = await projects.apply(sid, { type: 'updateOverlay', clipId: s.clips.at(-1).id, start: 2.5, scale: 0.5 })
check('updateOverlay', s.clips.at(-1).start === 2.5 && s.clips.at(-1).scale === 0.5)

// removeMedia refuses while in use
threw = ''
try {
  await projects.apply(sid, { type: 'removeMedia', mediaId: 'm1' })
} catch (error) {
  threw = error.message
}
check('remove in-use media refused', threw.includes('正被'), threw)

// setProject
s = await projects.apply(sid, { type: 'setProject', title: '旅行剪辑', width: 1280, height: 720, fps: 60 })
check('setProject applies', s.title === '旅行剪辑' && s.width === 1280 && s.fps === 60)
let badFps = ''
try {
  await projects.apply(sid, { type: 'setProject', fps: 33 })
} catch (error) {
  badFps = error.message
}
check('invalid fps refused', badFps.includes('fps'), badFps)

// unknown op
let unknown = ''
try {
  await projects.apply(sid, { type: 'nope' })
} catch (error) {
  unknown = error.message
}
check('unknown op refused', unknown.includes('未知操作'), unknown)

// resolveMedia errors
let mediaErr = ''
try {
  resolveMedia(s, 'zzz')
} catch (error) {
  mediaErr = error.message
}
check('unknown media message lists options', mediaErr.includes('找不到素材'), mediaErr)

// persistence round trip
await new Promise((settle) => setTimeout(settle, 400))
const saved = documents.get(sid)
check('project persisted', saved !== null && saved.version === 1 && Array.isArray(saved.clips), JSON.stringify(saved?.title))
const projects2 = createProjects({
  media: fakeMedia,
  read: async (id) => documents.get(id) ?? null,
  write: async (id, doc) => documents.set(id, doc),
  resolvePath: async (candidate) => `/media/${candidate}`,
})
const reloaded = await projects2.apply(sid, { type: 'state' === 'state' ? 'setProject' : 'setProject', title: '重载后' })
check('reload keeps clips', reloaded.clips.length === saved.clips.length, String(reloaded.clips.length))

// layout is pure and idempotent
const l1 = layout({ clips: saved.clips, width: 1920, height: 1080 })
const l2 = layout({ clips: saved.clips, width: 1920, height: 1080 })
check('layout deterministic', JSON.stringify(l1) === JSON.stringify(l2))

// An overlay cannot exist without a programme to paint on.
const empty = createProjects({
  media: fakeMedia,
  read: async () => null,
  write: async () => {},
  resolvePath: async (candidate) => `/media/${candidate}`,
})
const importedEmpty = await empty.apply('empty', { type: 'importPath', paths: ['b.mp4'] })
check('overlay needs a non-empty programme', await empty.apply('empty', { type: 'addClip', mediaId: 'm1', track: 1 })
  .then(() => false, (error) => error.message.includes('主轨道')))

// Overlay start past the programme end is clamped into the programme.
const clamped = await empty.apply('empty', { type: 'addClip', mediaId: 'm1', out: 2 })
const clampedState = await empty.apply('empty', { type: 'addClip', mediaId: 'm1', track: 1, start: 999, out: 3 })
const overlaySlice = clampedState.timeline.overlays[0]
check('overlay start is clamped into the programme', overlaySlice.start >= 0 && overlaySlice.end <= clampedState.timeline.duration,
  JSON.stringify(overlaySlice))
check('overlay cannot extend the programme duration', clampedState.timeline.duration === clampedState.timeline.main.reduce((sum, slice) => sum + slice.duration, 0),
  String(clampedState.timeline.duration))

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
