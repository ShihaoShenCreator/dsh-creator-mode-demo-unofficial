/**
 * Toy Transformer forward pass.
 *
 * This is a deliberately tiny, fully hand-authored Transformer used by the 3D
 * teaching demo. Nothing here is random: every weight table below is a
 * constant chosen so that the arithmetic is *readable* and so that
 * "the cat sat on the ___" really does predict "mat".
 *
 * Pipeline (one block, pre-LN style):
 *
 *   token embedding + positional encoding        -> x            (8 dims)
 *   x -> Q/K/V per head -> scaled dot-product -> softmax        (2 heads)
 *   concat(head contexts) -> output projection -> attnOut
 *   residual1 = x + attnOut
 *   normed    = LayerNorm(residual1)
 *   ffn.pre   = W1 * normed + b1                                 (16 units)
 *   ffn.hidden= GELU(pre)
 *   ffn.out   = W2 * hidden
 *   residual2 = residual1 + ffn.out
 *   logits    = U * LayerNorm(residual2) + bias                  (VOCAB)
 *   distribution = softmax(logits)
 *
 * Dimension meanings (all vectors are length DIM):
 *   0 animal-ness, 1 furniture/flat-surface-ness, 2 action-ness,
 *   3 location-ness, 4 determiner-ness, 5 sitting/motion, 6 plural, 7 animacy.
 *
 * Teaching simplifications, stated honestly:
 *   - the toy has no pre-attention LayerNorm (attention reads `x` directly);
 *   - positional encoding is a light perturbation, so the semantic dimensions
 *     stay readable in the 3D view;
 *   - the output projection is close to the identity for the same reason.
 */

export const DIM = 8
export const HEADS = 2
export const HEAD_DIM = DIM / HEADS

/** Human-readable meaning of each embedding dimension (index = dimension). */
export const DIM_NAMES = [
  'animal', 'furniture', 'action', 'location',
  'determiner', 'sitting', 'plural', 'animacy',
]

export const VOCAB = [
  'the', 'a', 'cat', 'cats', 'dog', 'bird',
  'mat', 'rug', 'chair', 'sat', 'slept', 'ran',
  'on', 'under', 'roof',
]

/**
 * Hand-authored token embeddings. Each row tracks the meaning table above; the
 * values are small on purpose so they read as "this word is mostly animal".
 *                      anim furniture action location determ sitting plural animacy
 */
const TOKEN_VECS = {
  the:    [0.00, 0.00, 0.00, 0.00, 1.00, 0.00, 0.00, 0.00],
  a:      [0.00, 0.00, 0.00, 0.00, 0.90, 0.00, 0.00, 0.00],
  cat:    [1.00, 0.00, 0.00, 0.00, 0.00, 0.20, 0.00, 1.00],
  cats:   [0.95, 0.00, 0.00, 0.00, 0.00, 0.20, 0.85, 0.95],
  dog:    [0.90, 0.00, 0.00, 0.00, 0.00, 0.30, 0.00, 0.90],
  bird:   [0.60, 0.00, 0.00, 0.00, 0.00, 0.20, 0.00, 0.80],
  mat:    [0.00, 1.00, 0.00, 0.10, 0.00, 0.10, 0.00, 0.00],
  rug:    [0.00, 0.90, 0.00, 0.10, 0.00, 0.10, 0.00, 0.00],
  chair:  [0.00, 0.70, 0.00, 0.00, 0.00, 0.40, 0.00, 0.00],
  sat:    [0.00, 0.00, 1.00, 0.00, 0.00, 1.00, 0.00, 0.40],
  slept:  [0.00, 0.00, 1.00, 0.00, 0.00, 0.80, 0.00, 0.40],
  ran:    [0.00, 0.00, 1.00, 0.00, 0.00, 0.90, 0.00, 0.45],
  on:     [0.00, 0.00, 0.00, 1.00, 0.00, 0.00, 0.00, 0.00],
  under:  [0.00, 0.00, 0.00, 0.90, 0.00, 0.00, 0.00, 0.00],
  roof:   [0.00, 0.00, 0.00, 0.80, 0.00, 0.00, 0.00, 0.00],
}

/** Amplitude of the sinusoidal positional encoding inside the embedding stream. */
const POSITION_SCALE = 0.15

export function tokenEmbedding(token) {
  const vec = TOKEN_VECS[token]
  if (vec === undefined) throw new Error(`unknown token: ${token}`)
  return vec.slice()
}

/** Standard sinusoidal encoding, returned in [-1, 1] per dimension. */
export function positionalEncoding(pos, dim = DIM) {
  const out = new Array(dim)
  for (let d = 0; d < dim; d++) {
    const pair = Math.floor(d / 2)
    const denom = Math.pow(100, (2 * pair) / dim)
    const angle = pos / denom
    out[d] = d % 2 === 0 ? Math.sin(angle) : Math.cos(angle)
  }
  return out
}

/** Numerically stable softmax; an empty input returns an empty array. */
export function softmax(values) {
  const n = values.length
  if (n === 0) return []
  let max = -Infinity
  for (let i = 0; i < n; i++) {
    const v = values[i]
    if (v > max) max = v
  }
  if (!Number.isFinite(max)) {
    return new Array(n).fill(1 / n)
  }
  const exps = new Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const e = Math.exp(values[i] - max)
    exps[i] = e
    sum += e
  }
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = sum === 0 ? 1 / n : exps[i] / sum
  return out
}

/** LayerNorm without affine parameters; an all-equal vector becomes all zeros. */
export function layernorm(vector) {
  const n = vector.length
  if (n === 0) return []
  let mean = 0
  for (let i = 0; i < n; i++) mean += vector[i]
  mean /= n
  let variance = 0
  for (let i = 0; i < n; i++) {
    const d = vector[i] - mean
    variance += d * d
  }
  variance /= n
  const std = Math.sqrt(variance + 1e-5)
  const out = new Array(n)
  for (let i = 0; i < n; i++) out[i] = (vector[i] - mean) / std
  return out
}

/** GELU (tanh approximation), finite for any finite input. */
export function gelu(x) {
  return 0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x * x * x)))
}

/** matrix * vector, matrix given as rows. */
export function matVec(matrix, vector) {
  const out = new Array(matrix.length)
  for (let r = 0; r < matrix.length; r++) {
    const row = matrix[r]
    let acc = 0
    for (let c = 0; c < row.length; c++) acc += row[c] * (vector[c] ?? 0)
    out[r] = acc
  }
  return out
}

/* ------------------------------------------------------------------------- *
 *  Attention: two heads with different, explainable jobs.
 *  Head A ("subject asker"): a determiner asks "which animal is the subject?"
 *  Head B ("content tracker"): the same determiner asks "which content word
 *  fits here?" (animal, verb, or furniture all count, animal strongest).
 *  Both heads therefore land on the subject for the final "the", which is
 *  exactly the published behaviour of a small model on this prompt.
 * ------------------------------------------------------------------------- */

const WQ_A = [
  [0, 0, 0, 0, 4.0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
]
const WK_A = [
  [1.00, 0.15, 0.45, 0, 0, 0, 0, -0.35],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
]
const WV_A = [
  [1.00, 0, 0, 0, 0, 0, 0, 0.20],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
]

const WQ_B = [
  [0, 0, 0, 0, 2.6, 0, 0, 0.30],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
]
const WK_B = [
  [0.85, 0.35, 0.35, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
]
const WV_B = [
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0.80, 0, 0.50, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
]

/** Output projection: close to identity so head slices stay readable. */
const WO = [
  [1.00, 0, 0, 0, 0, 0, 0, 0],
  [0, 1.00, 0, 0, 0, 0, 0, 0],
  [0, 0, 1.00, 0, 0, 0, 0, 0],
  [0, 0, 0, 1.00, 0, 0, 0, 0],
  [0, 0, 0, 0, 1.00, 0, 0, 0],
  [0, 0, 0, 0, 0, 1.00, 0, 0],
  [0, 0, 0, 0, 0, 0, 1.00, 0],
  [0, 0, 0, 0, 0, 0, 0, 1.00],
]

/* ------------------------------------------------------------------------- *
 *  Feed-forward network: the block that stores the "cat -> mat" association.
 *  Unit 0 fires on "determiner + animal subject", unit 1 on "furniture +
 *  location", unit 2 on a verb, unit 3 on "animal + verb". Unit 0 is the one
 *  that writes furniture-ness back into the residual stream, which is what
 *  makes "mat" the prediction after the final "the".
 * ------------------------------------------------------------------------- */

const W1 = [
  [0.60, 0, 0, 0, 0.75, 0, 0, 0],       // 0: determiner + animal
  [0, 0.90, 0, 0.35, 0, 0, 0, 0],       // 1: furniture + location
  [0, 0, 0.80, 0, 0, 0.60, 0, 0],       // 2: verb
  [0.50, 0, 0.50, 0, 0, 0, 0, 0],       // 3: animal + verb
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0],
]
const B1 = [
  -0.90, -0.70, -0.60, -0.55,
  0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
]

const W2 = [
  [0.15, 0, 0, 0.35, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],  // animal
  [2.10, 1.20, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],  // furniture
  [0, 0, 0.30, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],     // action
  [0, 0.25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],     // location
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],        // determiner
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
]

/* ------------------------------------------------------------------------- *
 *  Unembedding: one row per vocabulary entry, reading the final normed stream.
 *  Rows are chosen so that furniture-ness selects "mat"/"rug", animal-ness
 *  selects "cat"/"dog", and so on.
 * ------------------------------------------------------------------------- */

const UNEMBED = {
  the:   [[4, 1.40]],
  a:     [[4, 1.20]],
  cat:   [[0, 2.20]],
  cats:  [[0, 1.70], [6, 1.00]],
  dog:   [[0, 2.10]],
  bird:  [[0, 1.60]],
  mat:   [[1, 3.00], [0, 0.15]],
  rug:   [[1, 2.70], [0, 0.10]],
  chair: [[1, 2.00]],
  sat:   [[2, 2.00], [5, 0.70]],
  slept: [[2, 1.90]],
  ran:   [[2, 1.80]],
  on:    [[3, 2.00]],
  under: [[3, 1.90]],
  roof:  [[3, 1.50]],
}
const UNEMBED_BIAS = {
  the: 0.25, a: 0.10, mat: 0.15, rug: 0.10,
}

const SCALE = Math.sqrt(HEAD_DIM)

function attentionHead(x, wq, wk, wv) {
  const n = x.length
  const q = x.map((v) => matVec(wq, v))
  const k = x.map((v) => matVec(wk, v))
  const v = x.map((vec) => matVec(wv, vec))
  const scores = new Array(n)
  const weights = new Array(n)
  const context = new Array(HEAD_DIM).fill(0)
  for (let i = 0; i < n; i++) {
    const row = new Array(n)
    for (let j = 0; j < n; j++) {
      let dot = 0
      for (let d = 0; d < HEAD_DIM; d++) dot += q[i][d] * k[j][d]
      row[j] = dot / SCALE
    }
    scores[i] = row
    const rowWeights = softmax(row)
    weights[i] = rowWeights
    for (let j = 0; j < n; j++) {
      for (let d = 0; d < HEAD_DIM; d++) context[d] += rowWeights[j] * v[j][d]
    }
    /* reset for the next query row */
    for (let d = 0; d < HEAD_DIM; d++) context[d] = 0
  }
  /* second pass so each row's context is its own */
  const contexts = new Array(n)
  for (let i = 0; i < n; i++) {
    const row = new Array(HEAD_DIM).fill(0)
    for (let j = 0; j < n; j++) {
      for (let d = 0; d < HEAD_DIM; d++) row[d] += weights[i][j] * v[j][d]
    }
    contexts[i] = row
  }
  return { q, k, v, scores, weights, contexts }
}

/**
 * Run the toy forward pass and return every intermediate value the demo draws.
 */
export function buildForward(tokens) {
  const n = tokens.length
  const embedding = new Array(n)
  const x = new Array(n)
  for (let i = 0; i < n; i++) {
    const vec = tokenEmbedding(tokens[i])
    const posVec = positionalEncoding(i, DIM).map((p) => p * POSITION_SCALE)
    const xi = new Array(DIM)
    for (let d = 0; d < DIM; d++) xi[d] = vec[d] + posVec[d]
    embedding[i] = { token: tokens[i], vec, posVec, x: xi }
    x[i] = xi
  }

  const headA = attentionHead(x, WQ_A, WK_A, WV_A)
  const headB = attentionHead(x, WQ_B, WK_B, WV_B)
  const heads = [
    {
      index: 0, offset: 0,
      scores: headA.scores, weights: headA.weights, context: headA.contexts,
    },
    {
      index: 1, offset: HEAD_DIM,
      scores: headB.scores, weights: headB.weights, context: headB.contexts,
    },
  ]

  /* Mean attention row over heads, for a single readable heat map. */
  const attentionWeights = new Array(n)
  for (let i = 0; i < n; i++) {
    const row = new Array(n)
    for (let j = 0; j < n; j++) row[j] = (headA.weights[i][j] + headB.weights[i][j]) / 2
    attentionWeights[i] = row
  }

  /* Per-position concatenated context and the output projection. */
  const context = new Array(n)
  const attnOut = new Array(n)
  for (let i = 0; i < n; i++) {
    const concat = new Array(DIM)
    for (let d = 0; d < HEAD_DIM; d++) {
      concat[d] = headA.contexts[i][d]
      concat[HEAD_DIM + d] = headB.contexts[i][d]
    }
    context[i] = concat
    attnOut[i] = matVec(WO, concat)
  }

  /* Residual + LayerNorm, then the feed-forward block for the last position. */
  const qkv = new Array(n)
  for (let i = 0; i < n; i++) {
    qkv[i] = {
      token: tokens[i],
      q: headA.q[i].slice(0, HEAD_DIM),
      k: headA.k[i].slice(0, HEAD_DIM),
      v: headA.v[i].slice(0, HEAD_DIM),
    }
  }

  const last = n - 1
  const residual1 = new Array(DIM)
  for (let d = 0; d < DIM; d++) residual1[d] = x[last][d] + attnOut[last][d]
  const normed = layernorm(residual1)
  const pre = new Array(W1.length)
  for (let u = 0; u < W1.length; u++) {
    let acc = B1[u]
    for (let d = 0; d < DIM; d++) acc += W1[u][d] * normed[d]
    pre[u] = acc
  }
  const hidden = pre.map((v) => gelu(v))
  const out = matVec(W2, hidden)
  const residual2 = new Array(DIM)
  for (let d = 0; d < DIM; d++) residual2[d] = residual1[d] + out[d]
  const finalNorm = layernorm(residual2)

  const logits = VOCAB.map((token) => {
    const pairs = UNEMBED[token] ?? []
    let acc = UNEMBED_BIAS[token] ?? 0
    for (const [dim, weight] of pairs) acc += weight * finalNorm[dim]
    return { token, logit: acc }
  })
  const probs = softmax(logits.map((l) => l.logit))
  const distribution = VOCAB.map((token, i) => ({ token, prob: probs[i] }))
  const sorted = distribution.slice().sort((a, b) => b.prob - a.prob)
  const topK = sorted.slice(0, 5).map((e) => ({ token: e.token, prob: e.prob }))

  /* Per-position residual stream, kept for the 3D "stack" view. */
  const positions = new Array(n)
  for (let i = 0; i < n; i++) {
    const res = new Array(DIM)
    for (let d = 0; d < DIM; d++) res[d] = x[i][d] + attnOut[i][d]
    positions[i] = { token: tokens[i], x: x[i], context: context[i], residual: res, normed: layernorm(res) }
  }

  return {
    tokens: tokens.slice(),
    dim: DIM,
    heads: HEADS,
    headDim: HEAD_DIM,
    embedding,
    positions,
    qkv,
    heads: heads,
    attentionWeights,
    context: context[last].slice(),
    ffn: { pre, hidden, out },
    residual1,
    normed,
    residual2,
    finalNorm,
    logits,
    distribution,
    top1: sorted[0].token,
    topK,
  }
}

/**
 * Score a hand-made attention distribution against the model's own row for one
 * query position. `guess` does not need to be normalized; negatives are
 * treated as zero. The score is 1 - total variation distance, so 1 is perfect.
 */
export function attentionGuessScore(trace, queryIndex, guess) {
  const row = trace.attentionWeights[queryIndex]
  const n = row.length
  const clean = new Array(n)
  let sum = 0
  for (let i = 0; i < n; i++) {
    const v = Number.isFinite(guess[i]) && guess[i] > 0 ? guess[i] : 0
    clean[i] = v
    sum += v
  }
  const normalized = sum > 0 ? clean.map((v) => v / sum) : new Array(n).fill(1 / n)

  const perTokenDiff = new Array(n)
  let variation = 0
  for (let i = 0; i < n; i++) {
    const diff = normalized[i] - row[i]
    perTokenDiff[i] = diff
    variation += Math.abs(diff)
  }
  const score = Math.max(0, Math.min(1, 1 - variation / 2))

  let bestIndex = 0
  let bestWeight = row[0]
  for (let i = 1; i < n; i++) {
    if (row[i] > bestWeight) {
      bestWeight = row[i]
      bestIndex = i
    }
  }
  const verdict = score >= 0.85 ? 'close' : score >= 0.55 ? 'fair' : 'off'
  return {
    perTokenDiff,
    score,
    verdict,
    bestToken: trace.tokens[bestIndex],
    bestWeight,
  }
}

/** What happens if the player bets on `guessToken` for the last position. */
export function nextTokenScore(trace, guessToken) {
  const sorted = trace.distribution.slice().sort((a, b) => b.prob - a.prob)
  const position = sorted.findIndex((entry) => entry.token === guessToken)
  const entry = position === -1 ? null : sorted[position]
  return {
    correct: guessToken === trace.top1,
    rank: position === -1 ? sorted.length + 1 : position + 1,
    chosenProb: entry === null ? 0 : entry.prob,
    top1: trace.top1,
  }
}

/** The `count` highest attention weights for one query position. */
export function topAttention(trace, queryIndex, count = 3) {
  const row = trace.attentionWeights[queryIndex]
  return row
    .map((weight, index) => ({ token: trace.tokens[index], index, weight }))
    .sort((a, b) => b.weight - a.weight)
    .slice(0, count)
}

export const PROMPTS = [
  ['the', 'cat', 'sat', 'on', 'the'],
  ['a', 'dog', 'slept', 'under', 'the'],
]
