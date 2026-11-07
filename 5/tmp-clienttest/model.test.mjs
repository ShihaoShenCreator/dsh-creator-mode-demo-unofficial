/**
 * Unit tests for the pure timeline math, including a cross-check that
 * `layoutClips` agrees with the Host's authoritative `layout()` for the same
 * clip list. The Host module is imported read-only — no state, no I/O.
 *
 * Run: node tmp-clienttest\model.test.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const workspace = join(here, '..')

// --- load model.js as a plain module (it has no React / DOM dependency) -------
const modelSource = readFileSync(join(workspace, 'video-editor', 'src', 'client', 'model.js'), 'utf8')
const dataUrl = `data:text/javascript;base64,${Buffer.from(modelSource, 'utf8').toString('base64')}`
const model = await import(dataUrl)

// --- load the Host layout for the cross-check ---------------------------------
const projectModule = await import(
  `data:text/javascript;base64,${Buffer.from(
    readFileSync(join(workspace, 'video-editor', 'host', 'project.js'), 'utf8'),
    'utf8',
  ).toString('base64')}`
)

let failures = 0
let checks = 0
function check(name, condition, detail) {
  checks += 1
  if (condition) {
    console.log(`PASS  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  } else {
    failures += 1
    console.log(`FAIL  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

function near(a, b, epsilon = 1e-6) {
  return Math.abs(a - b) <= epsilon
}

/* --------------------------------------------------------------- formatting */

check('formatClock 0', model.formatClock(0) === '00:00', model.formatClock(0))
check('formatClock 65.4', model.formatClock(65.4) === '01:05', model.formatClock(65.4))
check('formatClock negative clamps', model.formatClock(-3) === '00:00', model.formatClock(-3))
check('formatClock NaN clamps', model.formatClock(Number.NaN) === '00:00', model.formatClock(Number.NaN))

check('formatTimecode 0@30', model.formatTimecode(0, 30) === '00:00:00', model.formatTimecode(0, 30))
check('formatTimecode 61.5@30', model.formatTimecode(61.5, 30) === '01:01:15', model.formatTimecode(61.5, 30))
check('formatTimecode 10@24', model.formatTimecode(10, 24) === '00:10:00', model.formatTimecode(10, 24))
check('formatTimecode never reports frame == fps', model.formatTimecode(0.999999, 30) === '00:00:29', model.formatTimecode(0.999999, 30))
check('formatTimecode tolerates fps=0', model.formatTimecode(2.5, 0) === '00:02:15', model.formatTimecode(2.5, 0))

check('frameOfTime 1.5@30', model.frameOfTime(1.5, 30) === 45, String(model.frameOfTime(1.5, 30)))
check('totalFrames 4@30', model.totalFrames(4, 30) === 120, String(model.totalFrames(4, 30)))
check('stepFrame +1 quantizes to grid', near(model.stepFrame(1.0333, 30, 1), 1.0666666666666667, 1e-6), String(model.stepFrame(1.0333, 30, 1)))
check('stepFrame -1 at 0 clamps', model.stepFrame(0, 30, -1) === 0 || near(model.stepFrame(0, 30, -1), 0, 1e-9), String(model.stepFrame(0, 30, -1)))

/* -------------------------------------------------------------------- ruler */

check('chooseStep 110 -> 1s', model.chooseStep(110) === 1, String(model.chooseStep(110)))
check('chooseStep 40 -> 2s', model.chooseStep(40) === 2, String(model.chooseStep(40)))
check('chooseStep 400 -> 1s', model.chooseStep(400) === 1, String(model.chooseStep(400)))
check('chooseStep 10 -> 10s', model.chooseStep(10) === 10, String(model.chooseStep(10)))

/* ------------------------------------------------------------------- layout */

const clips = [
  { id: 'c1', mediaId: 'm1', track: 0, in: 1, out: 4 },
  { id: 'c2', mediaId: 'm2', track: 0, in: 0, out: 3 },
  { id: 'c3', mediaId: 'm1', track: 0, in: 2, out: 2.5 },
]
const layout = model.layoutClips(clips)
check('layout main count', layout.main.length === 3, String(layout.main.length))
check('layout main contiguous', layout.main[1].start === layout.main[0].end, `${layout.main[0].end} / ${layout.main[1].start}`)
check('layout main durations', near(layout.main[0].duration, 3) && near(layout.main[1].duration, 3), `${layout.main[0].duration}, ${layout.main[1].duration}`)
check('layout duration = main track length', near(layout.duration, 6.5), String(layout.duration))

const hostLayout = projectModule.layout({ clips })
check('cross-check: main matches Host layout', JSON.stringify(layout.main) === JSON.stringify(hostLayout.main),
  `${JSON.stringify(layout.main)} vs ${JSON.stringify(hostLayout.main)}`)
check('cross-check: overlays match Host layout', JSON.stringify(layout.overlays) === JSON.stringify(hostLayout.overlays))
check('cross-check: duration matches Host layout', near(layout.duration, hostLayout.duration), `${layout.duration} vs ${hostLayout.duration}`)

const withOverlay = [
  { id: 'c1', mediaId: 'm1', track: 0, in: 0, out: 2 },
  { id: 'c2', mediaId: 'm2', track: 1, in: 0, out: 5, start: 1.5, x: 100, y: 50, scale: 0.3 },
]
const overlayLayout = model.layoutClips(withOverlay)
check('overlay layout: start respected', overlayLayout.overlays[0].start === 1.5, String(overlayLayout.overlays[0].start))
check('overlay is clipped to the programme end', near(overlayLayout.overlays[0].duration, 0.5), String(overlayLayout.overlays[0].duration))
check('overlay does not extend the programme', near(overlayLayout.duration, 2), String(overlayLayout.duration))
check('cross-check: overlay slice matches Host', JSON.stringify(overlayLayout.overlays) === JSON.stringify(projectModule.layout({ clips: withOverlay }).overlays))
check('cross-check: overlay duration matches Host', near(overlayLayout.duration, projectModule.layout({ clips: withOverlay }).duration))

const longOverlay = [
  { id: 'c1', mediaId: 'm1', track: 0, in: 0, out: 2 },
  { id: 'c2', mediaId: 'm2', track: 0, in: 0, out: 4 },
  { id: 'c3', mediaId: 'm3', track: 1, in: 1, out: 3, start: 5 },
]
const shortOverlayLayout = model.layoutClips(longOverlay)
check('overlay is clipped at the programme end', shortOverlayLayout.overlays[0].start === 5 && shortOverlayLayout.overlays[0].duration === 1,
  `${shortOverlayLayout.overlays[0].start} / ${shortOverlayLayout.overlays[0].duration}`)
check('cross-check: clamped overlay matches Host', JSON.stringify(shortOverlayLayout.overlays) === JSON.stringify(projectModule.layout({ clips: longOverlay }).overlays))

/* --------------------------------------------------------------- clip lookup */

check('clipAtTime inside first clip', model.clipAtTime(layout, 1.25).clipId === 'c1', model.clipAtTime(layout, 1.25).clipId)
check('clipAtTime boundary belongs to the later clip', model.clipAtTime(layout, 3).clipId === 'c2', model.clipAtTime(layout, 3).clipId)
check('clipAtTime before 0 gives the first clip', model.clipAtTime(layout, -1).clipId === 'c1', model.clipAtTime(layout, -1).clipId)
check('clipAtTime past the end gives the last clip', model.clipAtTime(layout, 99).clipId === 'c3', model.clipAtTime(layout, 99).clipId)
check('clipAtTime on an empty layout is null', model.clipAtTime(model.EMPTY_LAYOUT, 1) === null)
check('overlaysAtTime selects the covering window', model.overlaysAtTime(overlayLayout, 1.7).length === 1, String(model.overlaysAtTime(overlayLayout, 1.7).length))
check('overlaysAtTime empty outside the window', model.overlaysAtTime(overlayLayout, 2.1).length === 0, String(model.overlaysAtTime(overlayLayout, 2.1).length))
check('mainIndexOf finds c2', model.mainIndexOf(layout, 'c2') === 1, String(model.mainIndexOf(layout, 'c2')))
check('mainIndexOf unknown is -1', model.mainIndexOf(layout, 'zz') === -1)

/* ------------------------------------------------------------ reorder index */

check('reorderIndexAt drop before all -> 0', model.reorderIndexAt(layout, -1, 'c1') === 0, String(model.reorderIndexAt(layout, -1, 'c1')))
check('reorderIndexAt drop after all -> 2 for the dragged clip', model.reorderIndexAt(layout, 99, 'c1') === 2, String(model.reorderIndexAt(layout, 99, 'c1')))
check('reorderIndexAt ignores the dragged clip', model.reorderIndexAt(layout, 3.5, 'c2') === 1, String(model.reorderIndexAt(layout, 3.5, 'c2')))

/* --------------------------------------------------------------- filmstrip */

const stripTimes = model.filmstripTimes({ in: 1, out: 4 }, 6)
check('filmstripTimes count', stripTimes.length === 6, String(stripTimes.length))
check('filmstripTimes inside the source window', stripTimes.every((time) => time > 1 && time < 4), stripTimes.join(','))
check('filmstripTimes monotonic', stripTimes.every((time, index) => index === 0 || time > stripTimes[index - 1]))
check('filmstripTimes empty for a zero-length clip', model.filmstripTimes({ in: 2, out: 2 }, 6).length === 0)

/* ------------------------------------------------------------------ geometry */

const rect = model.overlayRect({ x: 384, y: 108, scale: 0.4 }, { width: 1920, height: 1080 })
check('overlayRect left = 20%', rect.left === '20%', rect.left)
check('overlayRect top = 10%', rect.top === '10%', rect.top)
check('overlayRect width = 40%', rect.width === '40%', rect.width)
const defaultRect = model.overlayRect({}, { width: 1920, height: 1080 })
check('overlayRect defaults', defaultRect.left === '0%' && defaultRect.top === '0%' && defaultRect.width === '35%', `${defaultRect.left} ${defaultRect.top} ${defaultRect.width}`)

/* -------------------------------------------------------------------- trims */

const trimmedLeft = model.trimEdge({ in: 1, out: 5 }, 10, 'in', 1)
check('trim in +1s', near(trimmedLeft.in, 2) && near(trimmedLeft.out, 5), JSON.stringify(trimmedLeft))
check('trim in clamps to 0', model.trimEdge({ in: 0.5, out: 5 }, 10, 'in', -5).in === 0, String(model.trimEdge({ in: 0.5, out: 5 }, 10, 'in', -5).in))
check('trim in keeps MIN_CLIP', near(model.trimEdge({ in: 1, out: 2 }, 10, 'in', 9).in, 2 - model.MIN_CLIP), String(model.trimEdge({ in: 1, out: 2 }, 10, 'in', 9).in))
check('trim out clamped to the media duration', near(model.trimEdge({ in: 1, out: 5 }, 6, 'out', 9).out, 6), String(model.trimEdge({ in: 1, out: 5 }, 6, 'out', 9).out))
check('trim out keeps MIN_CLIP', near(model.trimEdge({ in: 3, out: 5 }, 10, 'out', -9).out, 3 + model.MIN_CLIP), String(model.trimEdge({ in: 3, out: 5 }, 10, 'out', -9).out))

/* --------------------------------------------------------------------- zoom */

check('fitZoom for 10s in 1000px', model.fitZoom(10, 1000) === 100, String(model.fitZoom(10, 1000)))
check('fitZoom clamps low', model.fitZoom(1000, 100) === model.ZOOM_MIN, String(model.fitZoom(1000, 100)))
check('fitZoom clamps high', model.fitZoom(0.5, 4000) === model.ZOOM_MAX, String(model.fitZoom(0.5, 4000)))
check('fitZoom empty timeline -> default', model.fitZoom(0, 1000) === model.ZOOM_DEFAULT, String(model.fitZoom(0, 1000)))

/* ------------------------------------------------------------------ helpers */

check('clampSeek inside', model.clampSeek(2, 10) === 2)
check('clampSeek clamps high', model.clampSeek(99, 10) === 10)
check('clampSeek clamps low', model.clampSeek(-5, 10) === 0)
check('hasClip true', model.hasClip({ clips }, 'c1') === true)
check('hasClip false', model.hasClip({ clips }, 'nope') === false)
check('hasClip null state', model.hasClip(null, 'c1') === false)
check('layoutOfState tolerates null', model.layoutOfState(null).duration === 0)
check('layoutOfState tolerates garbage', model.layoutOfState({ clips: 'nope' }).main.length === 0)
check('mediaIndex maps ids', model.mediaIndex({ media: [{ id: 'm1' }, { id: 'm2' }] }).get('m2').id === 'm2')
check('clipDuration handles garbage', model.clipDuration({ in: 1, out: 'x' }) === 0, String(model.clipDuration({ in: 1, out: 'x' })))

console.log('')
console.log(`${checks - failures}/${checks} checks passed`)
if (failures === 0) {
  console.log('ALL MODEL CHECKS PASSED')
} else {
  console.log(`${failures} MODEL CHECK(S) FAILED`)
  process.exitCode = 1
}
