import test from 'node:test'
import assert from 'node:assert/strict'
import {
  VOCAB, DIM, HEADS, HEAD_DIM, PROMPTS,
  buildForward, softmax, layernorm, gelu, matVec,
  attentionGuessScore, nextTokenScore, topAttention,
} from '../src/engine.js'

test('exports have the documented shape', () => {
  assert.equal(DIM, 8)
  assert.equal(HEADS, 2)
  assert.equal(HEAD_DIM, DIM / HEADS)
  assert.ok(VOCAB.length >= 12)
  for (const token of ['the', 'cat', 'sat', 'on', 'mat']) {
    assert.ok(VOCAB.includes(token), `vocab missing ${token}`)
  }
  assert.equal(PROMPTS.length >= 2, true)
  assert.deepEqual(PROMPTS[0], ['the', 'cat', 'sat', 'on', 'the'])
  for (const prompt of PROMPTS) {
    assert.equal(prompt.length, 5)
    for (const token of prompt) assert.ok(VOCAB.includes(token), `prompt token ${token} not in vocab`)
  }
})

test('trace carries every documented field, all finite', () => {
  const trace = buildForward(PROMPTS[0])
  for (const key of ['tokens', 'dim', 'heads', 'headDim', 'embedding', 'positions', 'qkv', 'heads',
    'attentionWeights', 'context', 'ffn', 'residual1', 'normed', 'residual2', 'logits',
    'distribution', 'top1', 'topK']) {
    assert.ok(key in trace, `trace missing ${key}`)
  }
  const numbers = [
    ...trace.context, ...trace.residual1, ...trace.normed, ...trace.residual2,
    ...trace.ffn.pre, ...trace.ffn.hidden, ...trace.ffn.out,
    ...trace.logits.map((entry) => entry.logit),
    ...trace.distribution.map((entry) => entry.prob),
  ]
  for (const value of numbers) assert.ok(Number.isFinite(value), `non-finite value ${value}`)
})

test('the model predicts "mat" after "the cat sat on the"', () => {
  const trace = buildForward(PROMPTS[0])
  assert.equal(trace.top1, 'mat')
  assert.equal(trace.topK[0].token, 'mat')
  assert.ok(trace.topK[0].prob > 0.3, 'top probability should be meaningful')
  assert.equal(trace.topK.length, 5)
  for (let i = 1; i < trace.topK.length; i++) {
    assert.ok(trace.topK[i - 1].prob >= trace.topK[i].prob, 'topK must be sorted')
  }
})

test('attention rows are distributions with a clear peak on the subject', () => {
  const trace = buildForward(PROMPTS[0])
  const n = trace.tokens.length
  for (let i = 0; i < n; i++) {
    const sum = trace.attentionWeights[i].reduce((a, b) => a + b, 0)
    assert.ok(Math.abs(sum - 1) < 1e-6, `row ${i} sums to ${sum}`)
  }
  const last = trace.attentionWeights[n - 1]
  const sorted = last.slice().sort((a, b) => b - a)
  assert.ok(sorted[0] >= 0.35, `peak weight ${sorted[0]}`)
  assert.ok(sorted[0] / sorted[1] >= 1.6, `peak ratio ${sorted[0] / sorted[1]}`)
  const peakIndex = last.indexOf(sorted[0])
  assert.ok(['cat', 'sat'].includes(trace.tokens[peakIndex]), `peak sits on ${trace.tokens[peakIndex]}`)
})

test('distribution and per-head weights are well formed', () => {
  const trace = buildForward(PROMPTS[0])
  const sum = trace.distribution.reduce((acc, entry) => acc + entry.prob, 0)
  assert.ok(Math.abs(sum - 1) < 1e-6, `distribution sums to ${sum}`)
  assert.equal(trace.heads.length, HEADS)
  for (const head of trace.heads) {
    assert.equal(head.weights.length, trace.tokens.length)
    for (const row of head.weights) {
      const rowSum = row.reduce((a, b) => a + b, 0)
      assert.ok(Math.abs(rowSum - 1) < 1e-6, `head ${head.index} row sums to ${rowSum}`)
    }
  }
})

test('forward pass is deterministic', () => {
  assert.equal(JSON.stringify(buildForward(PROMPTS[0])), JSON.stringify(buildForward(PROMPTS[0])))
})

test('the second prompt is a usable, non-degenerate case', () => {
  const trace = buildForward(PROMPTS[1])
  assert.ok(VOCAB.includes(trace.top1))
  const maxProb = Math.max(...trace.distribution.map((entry) => entry.prob))
  assert.ok(maxProb < 0.9, `max prob ${maxProb}`)
  assert.ok(maxProb > 0.3, `max prob ${maxProb} should still be a clear winner`)
})

test('numeric helpers survive edge cases', () => {
  assert.deepEqual(softmax([]), [])
  assert.deepEqual(softmax([-1e6, 0, 1e6]), [0, 0, 1])
  const huge = softmax([1e9, 1e9, 1e9])
  for (const value of huge) assert.ok(Number.isFinite(value))
  const equal = layernorm([3, 3, 3, 3])
  assert.deepEqual(equal, [0, 0, 0, 0])
  const normal = layernorm([1, 2, 3, 4])
  for (const value of normal) assert.ok(Number.isFinite(value))
  assert.ok(Number.isFinite(gelu(1e9)) && Number.isFinite(gelu(-1e9)))
  assert.equal(gelu(0), 0)
  assert.deepEqual(matVec([], [1, 2]), [])
  assert.deepEqual(matVec([[1, 2]], []), [0])
})

test('attentionGuessScore rewards the model row and punishes a bad guess', () => {
  const trace = buildForward(PROMPTS[0])
  const last = trace.tokens.length - 1
  const modelRow = trace.attentionWeights[last]
  const perfect = attentionGuessScore(trace, last, modelRow)
  assert.ok(perfect.score >= 0.95, `perfect guess scored ${perfect.score}`)
  assert.equal(perfect.verdict, 'close')

  const reversed = modelRow.slice().reverse()
  const bad = attentionGuessScore(trace, last, reversed)
  assert.ok(bad.score < perfect.score)
  assert.deepEqual(bad.perTokenDiff.length, trace.tokens.length)
  assert.ok(['close', 'fair', 'off'].includes(bad.verdict))
  assert.ok(['the', 'cat', 'sat', 'on'].includes(perfect.bestToken))
})

test('nextTokenScore reports correctness, rank and probability', () => {
  const trace = buildForward(PROMPTS[0])
  const win = nextTokenScore(trace, 'mat')
  assert.equal(win.correct, true)
  assert.equal(win.rank, 1)
  assert.equal(win.top1, 'mat')
  assert.ok(win.chosenProb > 0.3)

  const lose = nextTokenScore(trace, 'cat')
  assert.equal(lose.correct, false)
  assert.ok(lose.rank > 1)
})

test('topAttention returns sorted entries', () => {
  const trace = buildForward(PROMPTS[0])
  const entries = topAttention(trace, trace.tokens.length - 1, 3)
  assert.equal(entries.length, 3)
  for (let i = 1; i < entries.length; i++) assert.ok(entries[i - 1].weight >= entries[i].weight)
  assert.ok(VOCAB.includes(entries[0].token))
})
