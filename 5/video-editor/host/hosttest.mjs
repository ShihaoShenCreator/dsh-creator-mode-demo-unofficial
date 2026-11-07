/**
 * End-to-end Host test: state machine + media probing + export, driven without
 * the DSH runtime.
 *
 * Run: node video-editor/host/hosttest.mjs
 *
 * It boots the same modules the plugin uses, builds a project from the test
 * media, exercises every operation, and renders a real mp4 through ffmpeg.
 *
 * Scratch space lives INSIDE the workspace (`tmp-hosttest/`) on purpose: the
 * DSH sandbox lets bundled ffmpeg write only under the workspace, so a system
 * temp directory makes the render fail with "Permission denied".
 */

import { mkdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMediaLibrary } from './media.js'
import { createRenderer } from './render.js'
import { createProjects } from './project.js'
import { createStore } from './store.js'

const here = fileURLToPath(new URL('.', import.meta.url))
const packageRoot = join(here, '..')
const workspace = join(packageRoot, '..')
const ffmpegPath = join(packageRoot, 'bin', 'ffmpeg.exe')
const ffprobePath = join(packageRoot, 'bin', 'ffprobe.exe')

let failures = 0
function check(name, condition, detail = '') {
  if (condition) {
    console.log(`PASS  ${name}${detail === '' ? '' : `  ${detail}`}`)
  } else {
    failures += 1
    console.log(`FAIL  ${name}${detail === '' ? '' : `  ${detail}`}`)
  }
}

async function main() {
  const scratch = join(workspace, 'tmp-hosttest')
  await rm(scratch, { recursive: true, force: true })
  await mkdir(scratch, { recursive: true })
  console.log(`scratch: ${scratch}`)
  const media = createMediaLibrary({ dir: scratch, ffmpegPath, ffprobePath })
  const renderer = createRenderer({ dir: scratch, ffmpegPath, ffprobePath })
  const store = createStore(scratch)
  const projects = createProjects({
    media,
    read: store.read,
    write: store.write,
    resolvePath: async (candidate) => {
      const { resolve } = await import('node:path')
      return resolve(workspace, candidate)
    },
  })

  try {
    const a = join(workspace, 'test-media', 'demo-a.mp4')
    const b = join(workspace, 'test-media', 'demo-b.mp4')

    const probedA = await media.probe(a)
    check('probe demo-a', Math.abs(probedA.duration - 12) < 0.1, `${probedA.width}x${probedA.height} ${probedA.fps}fps audio=${probedA.hasAudio}`)
    const probedB = await media.probe(b)
    check('probe demo-b', Math.abs(probedB.duration - 8) < 0.1, `${probedB.width}x${probedB.height} ${probedB.fps}fps audio=${probedB.hasAudio}`)
    check('demo-a has audio', probedA.hasAudio === true)
    check('demo-b is silent', probedB.hasAudio === false)

    const sessionId = 'test-session-1'
    let state = await projects.apply(sessionId, { type: 'importPath', paths: ['test-media/demo-a.mp4', 'test-media/demo-b.mp4'] })
    check('import two media', state.media.length === 2, state.media.map((item) => item.name).join(', '))

    state = await projects.apply(sessionId, { type: 'addClip', mediaId: 'm1', in: 1, out: 4 })
    state = await projects.apply(sessionId, { type: 'addClip', mediaId: 'm2', in: 0, out: 3 })
    check('two main clips', state.timeline.main.length === 2)
    check('total duration 6s', Math.abs(state.timeline.duration - 6) < 0.001, String(state.timeline.duration))

    state = await projects.apply(sessionId, { type: 'split', clipId: 1, at: 1.5 })
    check('split makes 3 main clips', state.timeline.main.length === 3, String(state.timeline.main.length))
    state = await projects.apply(sessionId, { type: 'undo' })
    check('undo restores 2 clips', state.timeline.main.length === 2)
    state = await projects.apply(sessionId, { type: 'redo' })
    check('redo splits again', state.timeline.main.length === 3)
    state = await projects.apply(sessionId, { type: 'delete', clipIds: [2] })
    check('delete removes middle clip', state.timeline.main.length === 2)
    state = await projects.apply(sessionId, { type: 'move', clipId: 1, toIndex: 1 })
    check('move swaps order', state.clips.filter((clip) => clip.track === 0)[0].id !== 'c1')

    state = await projects.apply(sessionId, { type: 'addClip', mediaId: 'demo-b', track: 1, start: 0, x: 860, y: 460, scale: 0.35 })
    check('overlay added', state.timeline.overlays.length === 1, JSON.stringify(state.timeline.overlays[0]))

    // Render a real file from the rebuilt main track.
    const outputPath = join(scratch, 'out.mp4')
    const mediaById = new Map(state.media.map((item) => [item.id, item]))
    const main = state.timeline.main.map((slice) => {
      const clip = state.clips.find((entry) => entry.id === slice.clipId)
      const item = mediaById.get(clip.mediaId)
      return { sourcePath: item.sourcePath, in: clip.in, out: clip.out, hasAudio: item.hasAudio }
    })
    const overlays = state.timeline.overlays.map((slice) => {
      const clip = state.clips.find((entry) => entry.id === slice.clipId)
      const item = mediaById.get(clip.mediaId)
      return {
        sourcePath: item.sourcePath,
        in: clip.in,
        out: clip.out,
        start: slice.start,
        x: clip.x ?? 0,
        y: clip.y ?? 0,
        scale: clip.scale ?? 0.35,
      }
    })
    let lastProgress = 0
    const result = await renderer.run({
      canvas: { width: state.width, height: state.height, fps: state.fps },
      quality: 'fast',
      outputPath,
      main,
      overlays,
    }, (progress) => {
      lastProgress = progress
    })
    check('render produced a file', result.outputPath === outputPath)
    const mainDuration = state.timeline.main.reduce((total, slice) => total + slice.duration, 0)
    check('render reports main-track duration', Math.abs(result.duration - mainDuration) < 0.35, `${result.duration} vs ${mainDuration}`)
    check('progress reached near completion', lastProgress > 0.9, lastProgress.toFixed(2))
    const rendered = await media.probe(outputPath)
    check('rendered duration matches main track', Math.abs(rendered.duration - mainDuration) < 0.4, `${rendered.duration}s vs ${mainDuration}s`)
    check('rendered has audio', rendered.hasAudio === true)
    check('rendered canvas', rendered.width === state.width && rendered.height === state.height, `${rendered.width}x${rendered.height}`)

    // Persistence round-trip.
    await store.write(sessionId, { version: 1, ...state, sessionId: undefined })
    const reloaded = await store.read(sessionId)
    check('persisted document reloads', reloaded !== null && reloaded.title === state.title)
  } finally {
    await rm(scratch, { recursive: true, force: true })
  }

  console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('hosttest crashed:', error)
  process.exit(1)
})
