/**
 * Scene model for the Transformer 3D lab.
 *
 * Pure module: given a forward trace, the current stage and the player's
 * interaction state, it returns a list of draw operations. The React panel
 * feeds those operations to the Canvas renderer, and a Node test can feed the
 * same list to a fake renderer, which is how the geometry is verified without
 * a browser.
 *
 * World coordinates: +X runs along the token sequence (left to right), +Y is
 * height, +Z points at the viewer. The token row sits on the y = 0 plane.
 */

export const PALETTE = {
  token: '#7aa2ff',
  query: '#ffc15e',
  positive: '#7aa2ff',
  negative: '#41507f',
  attention: '#6fd8ff',
  context: '#9d7bff',
  ffn: '#b58cff',
  predict: '#5fe3a8',
  muted: '#8b96b8',
  grid: '#26304d',
  text: '#e9eeff',
  textDim: '#a8b3d6',
}

const DIM_LABELS = ['animal', 'furniture', 'action', 'location', 'determiner', 'sitting', 'plural', 'animacy']

export const STAGES = [
  {
    id: 'embed',
    title: { zh: '词嵌入', en: 'Token embeddings' },
    hint: {
      zh: '每个词变成一个 8 维向量。向上是正数、向下是负数，亮度表示大小。拖拽旋转看不同角度。',
      en: 'Every token becomes an 8-dim vector. Up is positive, down is negative, brightness is magnitude. Drag to orbit.',
    },
    camera: { yaw: 0.55, pitch: 0.34, distance: 15, target: [0, 2.6, 0] },
  },
  {
    id: 'position',
    title: { zh: '位置编码', en: 'Positional encoding' },
    hint: {
      zh: '同样的词在不同位置要有不同的表示，所以再叠加一组按位置变化的波。下面细条是词向量，上面细条是位置编码。',
      en: 'The same word needs a different representation at a different position, so a position-dependent wave is added. Lower bars are the word vector, upper bars the encoding.',
    },
    camera: { yaw: 0.5, pitch: 0.3, distance: 16, target: [0, 2.4, 0] },
  },
  {
    id: 'qkv',
    title: { zh: '查询 · 键 · 值', en: 'Query, key, value' },
    hint: {
      zh: '每个位置投影出三样东西：查询（我要找什么）、键（我能提供什么）、值（我实际给出什么）。两个头各看一部分维度。',
      en: 'Each position projects three things: a query (what I look for), a key (what I offer), and a value (what I hand over). Two heads read different slices.',
    },
    camera: { yaw: 0.72, pitch: 0.36, distance: 15, target: [0, 2.2, 0] },
  },
  {
    id: 'attention',
    title: { zh: '注意力分数', en: 'Attention scores' },
    hint: {
      zh: '最后一个 “the” 作为查询，和每个位置的点积相似度决定它看向谁。粗线 = 分数高。',
      en: 'The final “the” acts as the query; its dot-product similarity with each position decides where it looks. Thicker line = higher score.',
    },
    camera: { yaw: 0.4, pitch: 0.42, distance: 14, target: [0, 2.0, 0] },
  },
  {
    id: 'softmax',
    title: { zh: '权重归一化（小游戏）', en: 'Normalize into weights (mini-game)' },
    hint: {
      zh: '把分数变成和为 1 的权重：这就是注意力分布。拖动滑杆猜一猜模型的分法，接近模型（得分 ≥ 0.85）即通关。',
      en: 'Turn scores into weights that sum to 1: that is the attention distribution. Drag the sliders to guess the model split; reaching 0.85 clears the round.',
    },
    camera: { yaw: 0.3, pitch: 0.4, distance: 14, target: [0, 2.2, 0] },
    miniGame: 'attention',
  },
  {
    id: 'context',
    title: { zh: '加权求和得到上下文', en: 'Weighted sum becomes context' },
    hint: {
      zh: '按权重把每个位置的值加权求和，拼起来就是这个 “the” 读到的上下文——它因此知道“这里该是一个家具词”。',
      en: 'Weighted-sum the values by those weights and concatenate; that is the context this “the” reads — and why it now expects a piece of furniture.',
    },
    camera: { yaw: 0.62, pitch: 0.34, distance: 13, target: [0, 3.0, 0] },
  },
  {
    id: 'ffn',
    title: { zh: '前馈网络', en: 'Feed-forward block' },
    hint: {
      zh: '上下文经过残差与归一化后进入两层前馈：8 维 → 16 个隐藏单元 → 8 维。第 0 号单元负责把“家具”维度写回残差流。',
      en: 'After residual and normalization the context enters two feed-forward layers: 8 dims → 16 hidden units → 8 dims. Unit 0 writes furniture-ness back into the residual stream.',
    },
    camera: { yaw: 0.9, pitch: 0.3, distance: 17, target: [0, 2.6, 0] },
  },
  {
    id: 'predict',
    title: { zh: '预测下一个词（小游戏）', en: 'Predict the next token (mini-game)' },
    hint: {
      zh: '最后把 8 维残差投影回词表，再 softmax 成概率。选一个你押注的词，看模型的答案。',
      en: 'Finally the 8-dim residual is projected back onto the vocabulary and softmaxed into probabilities. Bet on a token and see the model answer.',
    },
    camera: { yaw: 0.5, pitch: 0.28, distance: 15, target: [0, 3.2, 0] },
    miniGame: 'predict',
  },
  {
    id: 'summary',
    title: { zh: '整条链路', en: 'The whole path' },
    hint: {
      zh: '一次前向就是这条流水线：词嵌入 → 位置 → Q/K/V → 注意力 → 上下文 → 前馈 → 词表概率。换一段提示词再来一遍。',
      en: 'One forward pass is this pipeline: embeddings → positions → Q/K/V → attention → context → feed-forward → vocabulary probabilities. Switch the prompt and run it again.',
    },
    camera: { yaw: 0.85, pitch: 0.4, distance: 19, target: [0, 2.4, 0] },
  },
]

function tokenX(index, count) {
  return (index - (count - 1) / 2) * 2.7
}

function pushBars(ops, { x, z, vec, scale = 1.5, thickness = 0.26, baseY = 0, palette = PALETTE, highlight = -1, labelDim = false }) {
  const count = vec.length
  for (let d = 0; d < count; d++) {
    const value = Number.isFinite(vec[d]) ? vec[d] : 0
    const height = Math.max(0.02, Math.abs(value) * scale)
    const offset = (d - (count - 1) / 2) * thickness
    const positive = value >= 0
    ops.push({
      kind: 'bar',
      base: [x + offset, positive ? baseY : baseY - height, z],
      height,
      width: thickness * 0.72,
      depth: thickness * 0.72,
      color: positive ? palette.positive : palette.negative,
      opacity: d === highlight ? 1 : 0.68 + Math.min(0.3, Math.abs(value) * 0.3),
      wire: d === highlight,
      wireColor: palette.query,
      label: labelDim && d === highlight ? DIM_LABELS[d] : undefined,
      labelColor: palette.text,
    })
  }
}

function pushTokenLabels(ops, { trace, z = 0, y = -0.42, accentIndex = -1 }) {
  const n = trace.tokens.length
  for (let i = 0; i < n; i++) {
    ops.push({
      kind: 'text',
      position: [tokenX(i, n), y, z + 0.5],
      text: trace.tokens[i],
      size: 15,
      color: i === accentIndex ? PALETTE.query : PALETTE.text,
      weight: i === accentIndex ? 700 : 500,
      plate: true,
    })
  }
}

function pushFloor(ops, { count, z = 0, width = 0.9 }) {
  for (let i = 0; i < count; i++) {
    const x = tokenX(i, count)
    ops.push({
      kind: 'quad',
      points: [
        [x - width, 0.005, z - 0.9],
        [x + width, 0.005, z - 0.9],
        [x + width, 0.005, z + 0.9],
        [x - width, 0.005, z + 0.9],
      ],
      color: PALETTE.grid,
      opacity: 0.55,
      stroke: '#33405f',
      strokeWidth: 1,
    })
  }
}

function weightBars(ops, { trace, weights, z, scale = 7, baseY = 0, color, opacity = 0.85, labelPrefix = '' }) {
  const n = trace.tokens.length
  for (let i = 0; i < n; i++) {
    const w = Number.isFinite(weights[i]) ? weights[i] : 0
    ops.push({
      kind: 'bar',
      base: [tokenX(i, n), baseY, z],
      height: Math.max(0.03, w * scale),
      width: 1.15,
      depth: 1.15,
      color,
      opacity,
      label: labelPrefix + (w * 100).toFixed(0) + '%',
      labelColor: PALETTE.text,
      labelSize: 11,
    })
  }
}

function beamToKeys(ops, { trace, weights, fromIndex, z, color, maxWidth = 12, minWidth = 0.7, y = 0.55 }) {
  const n = trace.tokens.length
  const from = [tokenX(fromIndex, n), y, z]
  for (let i = 0; i < n; i++) {
    const w = Number.isFinite(weights[i]) ? weights[i] : 0
    if (w < 0.005) continue
    ops.push({
      kind: 'beam',
      from,
      to: [tokenX(i, n), y, z],
      color,
      width: minWidth + w * maxWidth,
      opacity: 0.35 + Math.min(0.6, w),
      arrow: i !== fromIndex && w > 0.2,
    })
  }
}

function buildEmbed(trace, ui) {
  const ops = []
  const n = trace.tokens.length
  const accent = ui.focusToken ?? -1
  pushFloor(ops, { count: n })
  for (let i = 0; i < n; i++) {
    pushBars(ops, { x: tokenX(i, n), z: 0, vec: trace.positions[i].x, highlight: accent === i ? ui.focusDim ?? -1 : -1, baseY: 0 })
  }
  pushTokenLabels(ops, { trace, accentIndex: accent })
  ops.push({
    kind: 'text', position: [0, 4.6, 0], text: 'x = token embedding', size: 13, color: PALETTE.textDim, plate: true,
  })
  return { ops }
}

function buildPosition(trace, ui) {
  const ops = []
  const n = trace.tokens.length
  pushFloor(ops, { count: n })
  for (let i = 0; i < n; i++) {
    pushBars(ops, { x: tokenX(i, n), z: 0.35, vec: trace.embedding[i].vec, scale: 1.2, thickness: 0.24 })
    pushBars(ops, { x: tokenX(i, n), z: -0.35, vec: trace.embedding[i].posVec, scale: 5.5, thickness: 0.24, palette: { positive: PALETTE.predict, negative: '#2f6b56' } })
  }
  pushTokenLabels(ops, { trace, accentIndex: ui.focusToken ?? -1 })
  ops.push({ kind: 'text', position: [-5.4, 2.4, 0.35], text: 'embedding', size: 12, color: PALETTE.positive, anchor: 'left', plate: true })
  ops.push({ kind: 'text', position: [-5.4, 1.2, -0.35], text: 'position', size: 12, color: PALETTE.predict, anchor: 'left', plate: true })
  return { ops }
}

function buildQkv(trace, ui) {
  const ops = []
  const n = trace.tokens.length
  pushFloor(ops, { count: n })
  const head = ui.head === 1 ? 1 : 0
  for (let i = 0; i < n; i++) {
    for (let slot = 0; slot < 3; slot++) {
      const baseY = 0
      const z = (slot - 1) * 0.9
      const color = slot === 0 ? PALETTE.query : slot === 1 ? PALETTE.attention : PALETTE.context
      const vec = slot === 0 ? trace.qkv[i].q : slot === 1 ? trace.qkv[i].k : trace.qkv[i].v
      pushBars(ops, { x: tokenX(i, n), z, vec, scale: 1.5, thickness: 0.16, baseY: baseY + 0.4, palette: { positive: color, negative: PALETTE.negative } })
    }
    ops.push({ kind: 'text', position: [tokenX(i, n), 1.5, -0.9], text: trace.tokens[i], size: 14, color: i === n - 1 ? PALETTE.query : PALETTE.text, plate: true })
  }
  ops.push({ kind: 'text', position: [-5.0, 0.9, 0.9], text: 'Q', size: 12, color: PALETTE.query, anchor: 'left' })
  ops.push({ kind: 'text', position: [-5.0, 0.9, 0], text: 'K', size: 12, color: PALETTE.attention, anchor: 'left' })
  ops.push({ kind: 'text', position: [-5.0, 0.9, -0.9], text: 'V', size: 12, color: PALETTE.context, anchor: 'left' })
  ops.push({
    kind: 'text', position: [0, 3.4, 0],
    text: `head ${head + 1} / ${trace.heads.length}`, size: 13, color: PALETTE.textDim, plate: true,
  })
  return { ops }
}

function buildAttention(trace, ui) {
  const ops = []
  const n = trace.tokens.length
  const query = n - 1
  pushFloor(ops, { count: n })
  beamToKeys(ops, { trace, weights: trace.attentionWeights[query], fromIndex: query, z: 0, color: PALETTE.attention })
  weightBars(ops, { trace, weights: trace.attentionWeights[query], z: 0.9, scale: 6.5, color: PALETTE.attention, labelPrefix: '' })
  pushTokenLabels(ops, { trace, accentIndex: query, y: -0.42 })
  ops.push({
    kind: 'text', position: [tokenX(query, n), 2.9, 0],
    text: 'query: the (last)', size: 13, color: PALETTE.query, plate: true,
  })
  return { ops }
}

function buildSoftmax(trace, ui) {
  const ops = []
  const n = trace.tokens.length
  pushFloor(ops, { count: n })
  const modelRow = trace.attentionWeights[n - 1]
  const guess = ui.weights ?? modelRow
  beamToKeys(ops, { trace, weights: guess, fromIndex: n - 1, z: 0, color: PALETTE.query, maxWidth: 10 })
  weightBars(ops, { trace, weights: guess, z: 0.9, scale: 6.5, color: PALETTE.query })
  if (ui.showModel === true) {
    weightBars(ops, { trace, weights: modelRow, z: -0.9, scale: 6.5, color: PALETTE.attention, opacity: 0.55 })
    ops.push({ kind: 'text', position: [tokenX(0, n) - 0.4, 3.3, -0.9], text: 'model weights', size: 12, color: PALETTE.attention, anchor: 'right', plate: true })
  }
  pushTokenLabels(ops, { trace, accentIndex: n - 1 })
  ops.push({ kind: 'text', position: [tokenX(0, n) - 0.4, 3.3, 0.9], text: 'your weights', size: 12, color: PALETTE.query, anchor: 'right', plate: true })
  return { ops }
}

function buildContext(trace, ui) {
  const ops = []
  const n = trace.tokens.length
  const query = n - 1
  pushFloor(ops, { count: n })
  beamToKeys(ops, { trace, weights: trace.attentionWeights[query], fromIndex: query, z: 0, color: PALETTE.attention, maxWidth: 8 })
  for (let i = 0; i < n; i++) {
    pushBars(ops, { x: tokenX(i, n), z: 0.6, vec: trace.positions[i].context, scale: 1.1, thickness: 0.18, baseY: 1.4 })
  }
  pushBars(ops, { x: tokenX(query, n), z: 0.6, vec: trace.context, scale: 1.9, thickness: 0.26, baseY: 3.4, highlight: ui.contextDim ?? -1, labelDim: true })
  pushTokenLabels(ops, { trace, accentIndex: query })
  ops.push({ kind: 'text', position: [tokenX(query, n), 5.1, 0.6], text: 'context (8 dims)', size: 13, color: PALETTE.context, plate: true })
  return { ops }
}

function buildFfn(trace, ui) {
  const ops = []
  const inputCount = trace.dim
  const hiddenCount = 16
  const outputCount = trace.dim
  const zIn = 2.4
  const zHidden = 0
  const zOut = -2.4
  const span = 6.4
  const unitLabels = ['animal', 'furniture', 'action', 'location', 'determiner', 'sitting', 'plural', 'animacy']
  const pre = trace.ffn.pre
  const hidden = trace.ffn.hidden
  const out = trace.ffn.out

  for (let i = 0; i < inputCount; i++) {
    const x = (i - (inputCount - 1) / 2) * (span / (inputCount - 1))
    ops.push({ kind: 'box', center: [x, 2.2, zIn], size: [0.45, 0.45, 0.45], color: PALETTE.context, opacity: 0.85 })
    ops.push({ kind: 'text', position: [x, 2.95, zIn], text: unitLabels[i], size: 10, color: PALETTE.textDim })
  }
  for (let i = 0; i < hiddenCount; i++) {
    const x = (i - (hiddenCount - 1) / 2) * (span / (hiddenCount - 1))
    const act = Math.abs(hidden[i])
    ops.push({
      kind: 'box', center: [x, 2.2, zHidden], size: [0.38, 0.38, 0.38],
      color: hidden[i] > 0 ? PALETTE.ffn : '#4a3f70',
      opacity: 0.35 + Math.min(0.65, act),
      label: i === 0 ? '0' : undefined, labelColor: PALETTE.text, labelSize: 10,
    })
  }
  for (let i = 0; i < outputCount; i++) {
    const x = (i - (outputCount - 1) / 2) * (span / (outputCount - 1))
    const act = Math.abs(out[i])
    ops.push({
      kind: 'box', center: [x, 2.2, zOut], size: [0.45, 0.45, 0.45],
      color: out[i] > 0 ? PALETTE.predict : '#2f5b4a',
      opacity: 0.4 + Math.min(0.6, act),
    })
    ops.push({ kind: 'text', position: [x, 1.45, zOut], text: unitLabels[i], size: 10, color: PALETTE.textDim })
  }
  /* Strongest input -> strongest hidden -> strongest output path. */
  let bestIn = 0
  for (let i = 1; i < inputCount; i++) if (Math.abs(trace.normed[i]) > Math.abs(trace.normed[bestIn]) && i !== 4) bestIn = i
  let bestHidden = 0
  for (let i = 1; i < hiddenCount; i++) if (Math.abs(hidden[i]) >= Math.abs(hidden[bestHidden])) bestHidden = i
  const xOf = (i, count) => (i - (count - 1) / 2) * (span / (count - 1))
  ops.push({
    kind: 'beam',
    from: [xOf(bestIn, inputCount), 2.2, zIn],
    to: [xOf(bestHidden, hiddenCount), 2.2, zHidden],
    color: PALETTE.ffn, width: 3.5, opacity: 0.9, arrow: true,
  })
  ops.push({
    kind: 'beam',
    from: [xOf(bestHidden, hiddenCount), 2.2, zHidden],
    to: [xOf(1, outputCount), 2.2, zOut],
    color: PALETTE.ffn, width: 3.5, opacity: 0.9, arrow: true,
  })
  ops.push({
    kind: 'text', position: [xOf(bestHidden, hiddenCount), 1.55, zHidden],
    text: `h${bestHidden}=${pre[bestHidden].toFixed(2)}`, size: 11, color: PALETTE.ffn, plate: true,
  })
  ops.push({
    kind: 'text', position: [0, 3.9, 0], text: 'feed-forward: 8 → 16 → 8', size: 13, color: PALETTE.textDim, plate: true,
  })
  return { ops }
}

function buildPredict(trace, ui) {
  const ops = []
  const n = trace.tokens.length
  const query = n - 1
  pushFloor(ops, { count: n })
  const candidates = (ui.candidates && ui.candidates.length > 0 ? ui.candidates : trace.topK.map((entry) => entry.token)).slice(0, 6)
  const revealed = ui.revealed === true
  const accent = ui.choice ?? null
  for (let i = 0; i < candidates.length; i++) {
    const token = candidates[i]
    const entry = trace.distribution.find((e) => e.token === token)
    const prob = entry === undefined ? 0 : entry.prob
    const height = revealed ? Math.max(0.12, prob * 7) : 1.6
    const x = (i - (candidates.length - 1) / 2) * 1.55
    const chosen = token === accent
    ops.push({
      kind: 'bar',
      base: [x, 0, -2.2],
      height,
      width: 1.0,
      depth: 1.0,
      color: chosen ? PALETTE.query : PALETTE.predict,
      opacity: chosen ? 1 : revealed ? 0.45 + prob * 0.5 : 0.6,
      wire: chosen,
      wireColor: PALETTE.query,
      label: token,
      labelColor: PALETTE.text,
      labelSize: 13,
    })
    if (revealed) {
      ops.push({
        kind: 'text',
        position: [x, height + 0.45, -2.2],
        text: `${(prob * 100).toFixed(1)}%`,
        size: 11,
        color: chosen ? PALETTE.query : PALETTE.textDim,
      })
    }
  }
  pushTokenLabels(ops, { trace, accentIndex: query })
  ops.push({
    kind: 'text', position: [0, 4.2, -2.2],
    text: revealed ? 'next-token probabilities' : 'bet on one of these',
    size: 13, color: PALETTE.predict, plate: true,
  })
  return { ops }
}

function buildSummary(trace) {
  const ops = []
  const n = trace.tokens.length
  pushFloor(ops, { count: n })
  for (let i = 0; i < n; i++) {
    pushBars(ops, { x: tokenX(i, n), z: 0, vec: trace.positions[i].normed, scale: 1.1, thickness: 0.2 })
  }
  beamToKeys(ops, { trace, weights: trace.attentionWeights[n - 1], fromIndex: n - 1, z: 1.6, color: PALETTE.attention, maxWidth: 6, y: 1.7 })
  pushTokenLabels(ops, { trace, accentIndex: n - 1 })
  const top = trace.topK[0]
  ops.push({
    kind: 'box', center: [0, 3.4, 2.2], size: [3.4, 1.1, 1.1], color: '#1b2a44', opacity: 0.85,
    wire: true, wireColor: PALETTE.predict,
    label: `${top.token} ${(top.prob * 100).toFixed(1)}%`, labelColor: PALETTE.text, labelSize: 16,
  })
  ops.push({ kind: 'text', position: [0, 4.5, 0], text: 'one forward pass, end to end', size: 13, color: PALETTE.textDim, plate: true })
  return { ops }
}

/**
 * Build the frame for one stage.
 * @param trace engine trace
 * @param stageIndex index into STAGES
 * @param ui { focusToken, focusDim, head, weights, choice, contextDim }
 */
export function buildScene(trace, stageIndex, ui = {}) {
  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, stageIndex))] ?? STAGES[0]
  let built
  switch (stage.id) {
    case 'embed': built = buildEmbed(trace, ui); break
    case 'position': built = buildPosition(trace, ui); break
    case 'qkv': built = buildQkv(trace, ui); break
    case 'attention': built = buildAttention(trace, ui); break
    case 'softmax': built = buildSoftmax(trace, ui); break
    case 'context': built = buildContext(trace, ui); break
    case 'ffn': built = buildFfn(trace, ui); break
    case 'predict': built = buildPredict(trace, ui); break
    case 'summary': built = buildSummary(trace); break
    default: built = buildEmbed(trace, ui); break
  }
  return { stage, camera: stage.camera, ops: built.ops }
}

/**
 * Numbers for the inspector side panel, per stage. Each block is either
 * `{ title, rows: [[label, value]] }` or `{ title, bars: [...] }` so the view
 * can render it without knowing about the model.
 */
export function inspectorModel(trace, stageIndex, ui = {}, score = null) {
  const stage = STAGES[Math.max(0, Math.min(STAGES.length - 1, stageIndex))] ?? STAGES[0]
  const n = trace.tokens.length
  const last = n - 1
  const fmt = (v, digits = 2) => (Number.isFinite(v) ? v.toFixed(digits) : '—')

  if (stage.id === 'embed' || stage.id === 'position') {
    const index = clampIndex(ui.focusToken, n, 0)
    const row = trace.positions[index]
    return {
      title: `${trace.tokens[index]} · 8 dims`,
      bars: row.x.map((value, dim) => ({ label: DIM_LABELS[dim], value, color: value >= 0 ? PALETTE.positive : PALETTE.negative })),
    }
  }
  if (stage.id === 'qkv') {
    const head = ui.head === 1 ? 1 : 0
    const index = clampIndex(ui.focusToken, n, last)
    const entry = trace.qkv[index]
    return {
      title: `${trace.tokens[index]} · head ${head + 1}`,
      bars: entry.q.map((value, dim) => ({ label: `q${dim}`, value, color: PALETTE.query })),
    }
  }
  if (stage.id === 'attention') {
    const row = trace.attentionWeights[last]
    return {
      title: `attention row for “${trace.tokens[last]}”`,
      bars: row.map((weight, i) => ({ label: trace.tokens[i], value: weight, color: PALETTE.attention })),
    }
  }
  if (stage.id === 'softmax') {
    const modelRow = trace.attentionWeights[last]
    const guess = ui.weights ?? modelRow
    return {
      title: 'your weights vs model weights',
      rows: trace.tokens.map((token, i) => [
        token,
        `${((guess[i] ?? 0) * 100).toFixed(1)}%  ·  model ${(modelRow[i] * 100).toFixed(1)}%`,
      ]),
      score,
    }
  }
  if (stage.id === 'context') {
    return {
      title: 'context vector (8 dims)',
      bars: trace.context.map((value, dim) => ({ label: DIM_LABELS[dim], value, color: PALETTE.context })),
    }
  }
  if (stage.id === 'ffn') {
    const hiddenTop = trace.ffn.hidden
      .map((value, index) => ({ index, value }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, 5)
    return {
      title: 'feed-forward',
      rows: [
        ['pre-activation max', fmt(Math.max(...trace.ffn.pre.map((v) => Math.abs(v))))],
        ['active units', `${hiddenTop.length} shown / 16`],
        ...hiddenTop.map((h) => [`h${h.index}`, fmt(h.value)]),
        ['Δ residual (furniture)', fmt(trace.ffn.out[1])],
      ],
    }
  }
  if (stage.id === 'predict') {
    return {
      title: 'probability over the vocabulary',
      bars: trace.topK.map((entry) => ({
        label: entry.token,
        value: entry.prob,
        color: entry.token === ui.choice ? PALETTE.query : PALETTE.predict,
      })),
      score,
    }
  }
  if (stage.id === 'summary') {
    return {
      title: 'pipeline',
      rows: [
        ['tokens', trace.tokens.join(' ')],
        ['dim / heads', `${trace.dim} / ${trace.heads.length}`],
        ['attention peak', `${trace.topK[0].token}`],
        ['top-1 next token', `${trace.top1} · ${(trace.distribution.find((e) => e.token === trace.top1).prob * 100).toFixed(1)}%`],
      ],
    }
  }
  return { title: '', rows: [] }
}

function clampIndex(value, length, fallback) {
  if (!Number.isInteger(value)) return fallback
  return value < 0 ? 0 : value >= length ? length - 1 : value
}
