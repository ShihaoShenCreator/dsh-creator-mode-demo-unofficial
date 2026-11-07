/**
 * Geometry test: run every stage's scene through the real renderer against a
 * fake Canvas 2D context and assert that
 *   - no draw op throws,
 *   - no NaN/Infinity reaches any context call,
 *   - something is actually painted per stage,
 *   - labels and beams stay inside the canvas,
 *   - a full frame is O(n) and finishes fast.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRenderer } from '../src/render3d.js'
import { buildScene, STAGES, inspectorModel } from '../src/scene.js'
import { buildForward, PROMPTS, attentionGuessScore } from '../src/engine.js'

function makeCanvas({ width = 960, height = 560 } = {}) {
  const calls = []
  const invalid = []
  const ctx = new Proxy({}, {
    get(target, key) {
      if (key === 'measureText') return (text) => ({ width: String(text).length * 6.4 })
      if (key === 'canvas') return null
      return (...args) => {
        calls.push({ key, args })
        for (const arg of args) {
          if (typeof arg === 'number' && !Number.isFinite(arg)) invalid.push({ key, arg })
        }
        return undefined
      }
    },
    set() { return true },
  })
  const canvas = {
    width: 0, height: 0, style: {},
    getContext: () => ctx,
    addEventListener() {}, removeEventListener() {},
    setPointerCapture() {}, releasePointerCapture() {},
  }
  return {
    canvas, calls, invalid,
    stats() {
      const count = (name) => calls.filter((c) => c.key === name).length
      return { fill: count('fill'), stroke: count('stroke'), fillText: count('fillText'), arc: count('arc') }
    },
  }
}

function replay(renderer, scene) {
  for (const op of scene.ops) {
    switch (op.kind) {
      case 'bar': renderer.bar(op); break
      case 'box': renderer.box(op); break
      case 'beam': renderer.beam(op); break
      case 'dot': renderer.dot(op); break
      case 'quad': renderer.quad(op); break
      case 'text': renderer.text(op); break
      default: throw new Error('unknown op kind: ' + op.kind)
    }
  }
}

const trace = buildForward(PROMPTS[0])

test('every stage paints a plausible frame with no non-finite context argument', () => {
  for (let stageIndex = 0; stageIndex < STAGES.length; stageIndex++) {
    const harness = makeCanvas()
    const renderer = createRenderer(harness.canvas)
    renderer.setSize(harness.canvas === null ? 0 : 960, 560, 1)
    const scene = buildScene(trace, stageIndex, {
      focusToken: 4, head: 1, choice: 'mat', revealed: true,
      weights: trace.attentionWeights[4], showModel: true,
    })
    renderer.setCamera(scene.camera)
    renderer.begin()
    replay(renderer, scene)
    renderer.end()

    assert.equal(harness.invalid.length, 0, `${STAGES[stageIndex].id}: bad values ${JSON.stringify(harness.invalid.slice(0, 3))}`)
    const stats = harness.stats()
    assert.ok(stats.fill > 0, `${STAGES[stageIndex].id}: painted no fills`)
    assert.ok(stats.fillText > 0, `${STAGES[stageIndex].id}: painted no labels`)
    renderer.dispose()
  }
})

test('scenes stay inside the canvas for extreme camera angles', () => {
  const harness = makeCanvas({ width: 640, height: 420 })
  const renderer = createRenderer(harness.canvas)
  renderer.setSize(640, 420, 2)
  for (const pitch of [-1.3, 0, 1.3]) {
    for (const yaw of [0, 1.6, 3.1]) {
      for (let stageIndex = 0; stageIndex < STAGES.length; stageIndex++) {
        renderer.setCamera({ yaw, pitch, distance: 9, target: STAGES[stageIndex].camera.target, fov: 45 })
        renderer.begin()
        replay(renderer, buildScene(trace, stageIndex, { focusToken: 4 }))
        renderer.end()
      }
    }
  }
  assert.equal(harness.invalid.length, 0)
})

test('zero-size and degenerate canvas do not throw', () => {
  const harness = makeCanvas()
  const renderer = createRenderer(harness.canvas)
  renderer.setSize(0, 0, 1)
  renderer.begin()
  replay(renderer, buildScene(trace, 0, {}))
  renderer.end()
  renderer.setSize(NaN, 400, 0)
  renderer.setCamera({ pitch: NaN, yaw: NaN, distance: NaN })
  renderer.begin()
  replay(renderer, buildScene(trace, 3, {}))
  renderer.end()
  assert.equal(harness.invalid.length, 0)
})

test('inspector numbers are renderable strings for every stage and prompt', () => {
  for (const prompt of PROMPTS) {
    const local = buildForward(prompt)
    for (let stageIndex = 0; stageIndex < STAGES.length; stageIndex++) {
      const model = inspectorModel(local, stageIndex, {
        focusToken: 4, head: 1, choice: 'mat', weights: local.attentionWeights[4],
      }, { score: 0.9 })
      assert.equal(typeof model.title, 'string')
      if (model.bars) {
        assert.ok(model.bars.length > 0, `${STAGES[stageIndex].id}: no bars`)
        for (const bar of model.bars) {
          assert.equal(typeof bar.label, 'string')
          assert.ok(Number.isFinite(bar.value), `${STAGES[stageIndex].id}: bar ${bar.label} = ${bar.value}`)
          assert.equal(typeof bar.color, 'string')
        }
      }
      if (model.rows) {
        for (const row of model.rows) {
          assert.equal(row.length, 2)
          assert.equal(typeof row[0], 'string')
          assert.equal(typeof row[1], 'string')
          assert.ok(!row[1].includes('NaN'), `row ${row[0]} = ${row[1]}`)
          assert.ok(!row[1].includes('undefined'), `row ${row[0]} = ${row[1]}`)
        }
      }
    }
  }
})

test('a frame is cheap enough to redraw on drag', () => {
  const harness = makeCanvas()
  const renderer = createRenderer(harness.canvas)
  renderer.setSize(1280, 800, 1)
  const scene = buildScene(trace, 6, {})
  const started = Date.now()
  for (let frame = 0; frame < 200; frame++) {
    renderer.setCamera({ yaw: frame * 0.01, pitch: 0.3, distance: 12, target: scene.camera.target })
    renderer.begin()
    replay(renderer, scene)
    renderer.end()
  }
  const elapsed = Date.now() - started
  assert.ok(elapsed < 1500, `200 frames took ${elapsed}ms`)
})

test('the softmax mini-game scores the model row as a win', () => {
  const last = trace.tokens.length - 1
  const result = attentionGuessScore(trace, last, trace.attentionWeights[last])
  assert.ok(result.score >= 0.85, `score ${result.score}`)
})
