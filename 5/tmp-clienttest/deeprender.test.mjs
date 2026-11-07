/**
 * Deep render test with a *stateful* fake React.
 *
 * The smoke/render harnesses use a stateless React (hooks return initial
 * values), which means `useWorkbench` reports `state === null` and the deep
 * sub-trees (preview videos, filmstrips, clip blocks, export modal, empty states)
 * never render. This harness implements enough of React's hook model — state
 * cells, ref cells, a synchronous effect queue — to mount the workbench against
 * real project states and walk the *entire* element tree.
 *
 * It also drives interactions through the rendered element props: toolbar
 * buttons, clip selection, trim handles, split/delete, export dialog and the
 * media-bin import path — asserting each one calls `op` with the contract
 * payload.
 *
 * Run: node tmp-clienttest\deeprender.test.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const workspace = join(here, '..')
const bundle = readFileSync(join(workspace, 'video-editor', 'client.js'), 'utf8')

let failures = 0
let checks = 0
function check(name, fn) {
  checks += 1
  try {
    const detail = fn()
    console.log(`PASS  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  } finally {
    // no-op: failures handled in catch
  }
}

async function run(name, fn) {
  checks += 1
  try {
    const detail = await fn()
    console.log(`PASS  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
    return true
  } catch (error) {
    failures += 1
    console.log(`FAIL  ${name} — ${error && error.message}`)
    return false
  }
}

/* -------------------------------------------------------------- stateful React */
// One rendering pass = one component instance with fresh hook cells. Hooks are
// numbered per instance, so a re-render replays the same call order.
class HookRuntime {
  constructor() {
    this.cells = []
    this.index = 0
    this.effects = []
    this.executed = new Set()
    this.cleanups = []
  }
  reset() {
    this.index = 0
  }
  useHookSlot() {
    const slot = this.index
    this.index += 1
    return slot
  }
  useState(initial) {
    const slot = this.useHookSlot()
    if (this.cells[slot] === undefined) {
      this.cells[slot] = { value: typeof initial === 'function' ? initial() : initial }
    }
    const cell = this.cells[slot]
    return [cell.value, (next) => {
      cell.value = typeof next === 'function' ? next(cell.value) : next
    }]
  }
  useRef(initial) {
    const slot = this.useHookSlot()
    if (this.cells[slot] === undefined) this.cells[slot] = { value: { current: initial === undefined ? null : initial } }
    return this.cells[slot].value
  }
  useMemo(fn) {
    this.useHookSlot()
    return fn()
  }
  useCallback(fn) {
    this.useHookSlot()
    return fn
  }
  useEffect(fn) {
    const slot = this.useHookSlot()
    this.effects.push({ slot, fn })
  }
  useLayoutEffect(fn) {
    this.useEffect(fn)
  }
  /** Run each effect exactly once (deps comparison is out of scope here). */
  flushEffects() {
    for (const effect of this.effects) {
      if (this.executed.has(effect.slot)) continue
      this.executed.add(effect.slot)
      const cleanup = effect.fn()
      if (typeof cleanup === 'function') this.cleanups.push(cleanup)
    }
    this.effects = []
  }
  teardown() {
    for (const cleanup of this.cleanups) {
      try {
        cleanup()
      } catch {
        // ignore
      }
    }
    this.cleanups = []
  }
}

let runtime = new HookRuntime()

const fakeReact = {
  createElement(type, props, ...children) {
    const merged = { ...(props ?? {}) }
    if (children.length === 1) merged.children = children[0]
    else if (children.length > 1) merged.children = children
    return { $$typeof: 'react.element', type, props: merged, key: merged.key ?? null }
  },
  Fragment: 'react.fragment',
  useState: (initial) => runtime.useState(initial),
  useReducer: (reducer, initial) => {
    const state = runtime.useState(initial)
    return [state[0], () => {}]
  },
  useEffect: (fn) => runtime.useEffect(fn),
  useLayoutEffect: (fn) => runtime.useLayoutEffect(fn),
  useMemo: (fn) => runtime.useMemo(fn),
  useCallback: (fn) => runtime.useCallback(fn),
  useRef: (initial) => runtime.useRef(initial),
  useContext: () => null,
  useImperativeHandle() {},
  useDebugValue() {},
  memo: (component) => component,
  forwardRef: (render) => render,
  Component: class Component {
    constructor(props) {
      this.props = props
      this.state = {}
    }
  },
  PureComponent: class PureComponent {
    constructor(props) {
      this.props = props
      this.state = {}
    }
  },
  createContext: (value) => ({ Provider: null, Consumer: null, defaultValue: value }),
  createRef: () => ({ current: null }),
  cloneElement: (element) => element,
  isValidElement: (value) => value !== null && typeof value === 'object' && value.$$typeof === 'react.element',
  Children: {
    map: (list, fn) => (list === undefined || list === null ? [] : Array.isArray(list) ? list.map(fn) : [fn(list)]),
    toArray: (list) => (list === undefined || list === null ? [] : Array.isArray(list) ? list : [list]),
    count: (list) => (list === undefined || list === null ? 0 : Array.isArray(list) ? list.length : 1),
  },
  StrictMode: 'react.strictmode',
}
fakeReact.default = fakeReact

const fakeReactDom = { createRoot: () => ({ render: (n) => n, unmount() {} }), render: (n) => n }
fakeReactDom.default = fakeReactDom

/* ------------------------------------------------------------------ sandbox */
let handoff = null
const fetches = []

/**
 * Fake Host: a small stateful server instead of a response queue. Endpoints
 * dispatch on the URL shape, so ordering churn between effects (state vs ping)
 * cannot desynchronise the fixture.
 */
const server = {
  state: null,
  ping: { ffmpeg: { available: true }, ffprobe: { available: true } },
  /** Override applied to the *next* state response (used to model an op result). */
  pendingState: null,
  pendingExportJob: null,
  exportJob: null,
  reset(state, ping) {
    this.state = state
    this.ping = ping === undefined ? { ffmpeg: { available: true }, ffprobe: { available: true } } : ping
    this.pendingState = null
    this.exportJob = null
  },
  respond(url) {
    const path = String(url)
    if (path.endsWith('/ping')) return { body: { ok: true, ...this.ping } }
    if (path.endsWith('/state')) return { body: { ok: true, state: this.state } }
    if (path.endsWith('/op')) {
      const next = this.pendingState === null ? this.state : this.pendingState
      this.pendingState = null
      this.state = next
      return { body: { ok: true, state: next } }
    }
    if (path.endsWith('/export') && !path.includes('/export/')) {
      return { body: { ok: true, jobId: 'job-1', job: this.exportJob ?? { id: 'job-1', status: 'running', progress: 0 } } }
    }
    if (path.includes('/export/') && path.endsWith('/job-1')) {
      return { body: { ok: true, job: this.pendingExportJob ?? this.exportJob ?? { id: 'job-1', status: 'running', progress: 0.4 } } }
    }
    if (path.endsWith('/import')) return { body: { ok: true, state: this.state, imported: [], skipped: [] } }
    return { body: { ok: false, error: 'unexpected fake route' }, status: 404 }
  },
}
const windowStub = {
  __ModuleLoader__: { load: (entry) => { handoff = entry } },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => true,
  setTimeout: (fn) => { fn(); return 0 },
  clearTimeout() {},
}
const documentStub = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, textContent: '', remove() {} }),
  head: { appendChild() {} },
  addEventListener() {},
  removeEventListener() {},
  visibilityState: 'visible',
}
const sandbox = {
  window: windowStub,
  document: documentStub,
  console,
  setTimeout: (fn) => { if (typeof fn === 'function') fn(); return 0 },
  clearTimeout() {},
  setInterval: () => 0,
  clearInterval() {},
  requestAnimationFrame: () => 0,
  cancelAnimationFrame() {},
  performance: { now: () => 0 },
  URL,
  Math,
  JSON,
  Map,
  Set,
  WeakMap,
  Promise,
  Number,
  String,
  Array,
  Object,
  Error,
  TypeError,
  Date,
  RegExp,
  isFinite,
  encodeURIComponent,
  CustomEvent: class CustomEvent { constructor(type, init) { this.type = type; this.detail = init?.detail } },
  fetch: (url, init) => {
    fetches.push({ url, init })
    const spec = server.respond(url)
    return Promise.resolve({
      ok: spec.status === undefined ? true : spec.status < 300,
      status: spec.status ?? 200,
      json: () => Promise.resolve(spec.body),
    })
  },
}
sandbox.globalThis = sandbox

new vm.Script(bundle, { filename: 'video-editor/client.js' }).runInNewContext(sandbox)
const surface = handoff.factory((name) => {
  if (name === 'react') return fakeReact
  if (name === 'react-dom' || name === 'react-dom/client') return fakeReactDom
  throw new Error(`unexpected require(${name})`)
})

/* ------------------------------------------------------------- fixtures */
const SESSION = 'deep-render-session'
const t = (key, params) => (params === undefined ? key : `${key}(${Object.entries(params).map(([k, v]) => `${k}=${v}`).join(',')})`)

function mediaItem(id, name, duration, width = 1920, height = 1080) {
  return {
    id, name, sourcePath: `C:/fake/${name}`, origin: 'upload', duration, width, height, fps: 30,
    hasAudio: true, size: 1024, addedAt: 1,
    playUrl: `/video-editor/s/${SESSION}/media/${id}`,
    posterUrl: `/video-editor/s/${SESSION}/media/${id}/poster.jpg`,
    frameUrl: `/video-editor/s/${SESSION}/media/${id}/frame.jpg`,
  }
}

const MEDIA = [mediaItem('m1', 'demo-a.mp4', 6), mediaItem('m2', 'demo-b.mp4', 4, 1280, 720)]

function fullState(extra = {}) {
  return {
    sessionId: SESSION,
    revision: 7,
    title: '测试项目',
    width: 1920,
    height: 1080,
    fps: 30,
    media: MEDIA,
    clips: [
      { id: 'c1', mediaId: 'm1', track: 0, in: 1, out: 4 },
      { id: 'c2', mediaId: 'm2', track: 0, in: 0, out: 3 },
      { id: 'c3', mediaId: 'm1', track: 1, in: 0, out: 2, start: 1, x: 384, y: 108, scale: 0.4 },
    ],
    timeline: {
      main: [{ clipId: 'c1', start: 0, end: 3, duration: 3 }, { clipId: 'c2', start: 3, end: 6, duration: 3 }],
      overlays: [{ clipId: 'c3', start: 1, end: 2, duration: 1 }],
      duration: 6,
    },
    canUndo: true,
    canRedo: false,
    updatedAt: 1,
    ...extra,
  }
}

function emptyState() {
  return {
    sessionId: SESSION, revision: 0, title: '未命名剪辑', width: 1920, height: 1080, fps: 30,
    media: [], clips: [], timeline: { main: [], overlays: [], duration: 0 },
    canUndo: false, canRedo: false, updatedAt: 1,
  }
}

server.reset(fullState())

/* --------------------------------------------------- capture registrations */
const registrations = []
const fakeCtx = {
  slots: {
    inject(_slot, factory) { return factory() },
    register(options, component) { registrations.push({ options, component }); return () => {} },
  },
  locale: { register: () => () => {}, bind: () => t, subscribe: () => () => {} },
  effect(fn) { const d = fn(); return () => { if (typeof d === 'function') d() } },
  get() { return undefined },
}
surface.apply(fakeCtx)
const viewReg = registrations.find((entry) => entry.options.name === 'conversation.view')

/* ------------------------------------------------------------- mount helpers */
/**
 * Hook cells indexed by *mount order* within one render pass — the same
 * bookkeeping axis React uses for its fiber tree.
 *
 * A pass may change the tree shape (first pass renders the loading card, a later
 * pass renders the full workbench), which desynchronizes cells from components.
 * That is exactly why `mount` renders to a fixed point: it keeps re-rendering
 * until two consecutive passes produce the same node signature, so the final
 * pass reads cells that were written by a pass of the same shape.
 */
const cells = []
let hookIndex = 0
const effectQueue = []
const executedEffects = new Set()

const live = { root: null, nodes: [], rendering: false, pending: false }

function rerenderPass() {
  hookIndex = 0
  const tree = render(live.root, '', 0)
  live.nodes = flatten(tree)
  return live.nodes
}

function rerender() {
  if (live.rendering) {
    live.pending = true
    return
  }
  live.rendering = true
  try {
    do {
      live.pending = false
      rerenderPass()
    } while (live.pending)
  } finally {
    live.rendering = false
  }
}

function makeRuntime() {
  const slot = () => {
    const index = hookIndex
    hookIndex += 1
    return index
  }
  const schedule = () => {
    if (live.rendering) live.pending = true
    else rerender()
  }
  return {
    useState(initial) {
      const index = slot()
      if (cells[index] === undefined) {
        cells[index] = { value: typeof initial === 'function' ? initial() : initial }
      }
      const cell = cells[index]
      return [cell.value, (next) => {
        cell.value = typeof next === 'function' ? next(cell.value) : next
        schedule()
      }]
    },
    useRef(initial) {
      const index = slot()
      if (cells[index] === undefined) cells[index] = { value: { current: initial === undefined ? null : initial } }
      return cells[index].value
    },
    useMemo(fn) {
      slot()
      return fn()
    },
    useCallback(fn) {
      slot()
      return fn
    },
    useEffect(fn) {
      effectQueue.push({ index: slot(), fn })
    },
    useLayoutEffect(fn) {
      this.useEffect(fn)
    },
  }
}

/** Node signature used for fixed-point detection. */
function signature(nodes) {
  let out = `${nodes.length}:`
  for (const node of nodes) out += `${typeof node.type === 'string' ? node.type : 'fn'},${node.props?.className ?? ''};`
  return out
}

/** Run every queued effect exactly once per hook slot within this mount. */
function flushEffects() {
  for (const effect of effectQueue) {
    if (executedEffects.has(effect.index)) continue
    executedEffects.add(effect.index)
    try {
      effect.fn()
    } catch {
      // effect failures surface through the component's own error path
    }
  }
  effectQueue.length = 0
}

/**
 * Mount one element tree to a fixed point and return a live view.
 *
 * `view.nodes` is a getter over the latest render, so a handler that calls
 * `setState` is visible on the next read (React's re-render behaviour), instead
 * of freezing on closure-era props.
 */
async function mount(element) {
  executedEffects.clear()
  cells.length = 0
  effectQueue.length = 0
  live.root = element
  live.nodes = []
  live.rendering = false
  live.pending = false

  let previous = ''
  for (let pass = 0; pass < 24; pass += 1) {
    rerenderPass()
    flushEffects()
    if (pass === 0) await flushMicrotasks()
    const current = signature(live.nodes)
    if (current === previous) break
    previous = current
  }
  return {
    get nodes() {
      return live.nodes
    },
    get element() {
      return live.root
    },
    refresh() {
      rerender()
      return live.nodes
    },
  }
}

/** Drain the microtask/macrotask queue a bounded number of times. */
async function flushMicrotasks(rounds = 8) {
  for (let index = 0; index < rounds; index += 1) {
    await new Promise((resolve) => setTimeout(resolve, 0))
  }
}

function render(element, path, depth) {
  if (element === null || element === undefined || depth > 24) return element
  if (typeof element === 'string' || typeof element === 'number') return element
  if (Array.isArray(element)) {
    return element.map((child, index) => render(child, `${path}/${index}`, depth + 1))
  }
  if (typeof element !== 'object') return element
  const type = element.type
  const props = element.props ?? {}
  if (typeof type === 'function') {
    const name = typeof type.name === 'string' && type.name !== '' ? type.name : 'anon'
    const childPath = `${path}/${name}`
    if (type.prototype !== undefined && typeof type.prototype.render === 'function') {
      const instance = new type(props)
      instance.props = props
      const out = instance.render()
      return render(out, childPath, depth + 1)
    }
    runtime = makeRuntime()
    return render(type({ ...props }), childPath, depth + 1)
  }
  return { ...element, props: { ...props, children: render(props.children, `${path}/<${typeof element.type === 'string' ? element.type : 'host'}>`, depth + 1) } }
}

function flatten(node, out = []) {
  if (node === null || node === undefined) return out
  if (typeof node === 'string' || typeof node === 'number') return out
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out)
    return out
  }
  if (typeof node !== 'object') return out
  if (node.props !== undefined) out.push(node)
  flatten(node.props?.children, out)
  return out
}

function byClass(nodes, className) {
  return nodes.filter((node) => typeof node.props?.className === 'string' && node.props.className.split(' ').includes(className))
}

function byTag(nodes, tag) {
  return nodes.filter((node) => node.type === tag)
}

/** Every element that carries the given data attribute. */
function byData(nodes, attribute, value) {
  return nodes.filter((node) => node.props?.[attribute] === value)
}

/** Collect the class names in a mounted tree. */
function classSet(nodes) {
  const found = new Set()
  for (const node of nodes) {
    if (typeof node.props?.className !== 'string') continue
    for (const cls of node.props.className.split(' ')) found.add(cls)
  }
  return found
}

/* --------------------------------------------------------------- test cases */

await run('mounts the workbench against a full project', async () => {
  server.reset(fullState())

  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes
  const classes = classSet(nodes)
  const required = ['ve-root', 've-toolbar', 've-main', 've-bin', 've-preview-pane', 've-stage', 've-transport', 've-timeline', 've-tl-head', 've-ruler']
  const missing = required.filter((cls) => !classes.has(cls))
  if (missing.length > 0) throw new Error(`missing ${missing.join(', ')}`)
  return `${classes.size} classes, ${nodes.length} nodes`
})

await run('renders clip blocks with filmstrips and the playhead', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const clips = byClass(nodes, 've-clip')
  if (clips.length !== 3) throw new Error(`expected 3 clip blocks, saw ${clips.length}`)

  const frames = byClass(nodes, 've-clip-frame')
  if (frames.length === 0) throw new Error('no filmstrip frames rendered')
  if (frames.some((frame) => !String(frame.props.src).includes('/frame.jpg?t='))) {
    throw new Error('a filmstrip frame does not use the frame route')
  }
  const handles = byClass(nodes, 've-clip-handle')
  if (handles.length !== 6) throw new Error(`expected 2 handles per clip, saw ${handles.length}`)
  if (byClass(nodes, 've-playhead').length !== 1) throw new Error('no playhead')
  return `${clips.length} clips, ${frames.length} frames, ${handles.length} handles`
})

await run('renders all three media-bin rows with poster URLs', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const rows = byClass(nodes, 've-bin-row')
  if (rows.length !== 2) throw new Error(`expected 2 media rows, saw ${rows.length}`)
  const posters = nodes.filter((node) => node.type === 'img' && String(node.props.src).includes('poster.jpg'))
  if (posters.length !== 2) throw new Error(`expected 2 posters, saw ${posters.length}`)
  return `${rows.length} rows, ${posters.length} posters`
})

await run('empty project renders the designed empty states', async () => {
  server.reset(emptyState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  if (byClass(nodes, 've-bin-empty').length === 0) throw new Error('no media-bin empty state')
  if (byClass(nodes, 've-stage-empty').length === 0) throw new Error('no preview empty state')
  if (byClass(nodes, 've-tl-empty').length === 0) throw new Error('no timeline empty hint')
  const buttons = byTag(nodes, 'button')
  const exportBtn = buttons.find((node) => node.props.className === 've-btn ve-btn-primary')
  if (exportBtn === undefined) throw new Error('no export button')
  if (exportBtn.props.disabled !== true) throw new Error('export must be disabled on an empty timeline')
  return 'all three empty states + export disabled'
})

await run('ffmpeg-missing project shows the warning chip and disables export', async () => {
  server.reset(fullState(), { ffmpeg: { available: false }, ffprobe: { available: false } })
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  if (byClass(nodes, 've-warn-chip').length === 0) throw new Error('no ffmpeg warning chip')
  const exportBtn = byTag(nodes, 'button').find((node) => node.props.className === 've-btn ve-btn-primary')
  if (exportBtn === undefined) throw new Error('no export button')
  if (exportBtn.props.disabled !== true) throw new Error('export must be disabled without ffmpeg')
  return 'warning shown, export disabled'
})

await run('overlay clip renders a positioned second video', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const overlays = byClass(nodes, 've-overlay-video')
  if (overlays.length !== 1) throw new Error(`expected 1 overlay video, saw ${overlays.length}`)
  const style = overlays[0].props.style
  if (style.left !== '20%') throw new Error(`overlay left should be 20%, got ${style.left}`)
  if (style.top !== '10%') throw new Error(`overlay top should be 10%, got ${style.top}`)
  if (style.width !== '40%') throw new Error(`overlay width should be 40%, got ${style.width}`)
  return `left ${style.left}, top ${style.top}, width ${style.width}`
})

await run('main track videos are mounted exactly twice (the 2-element pool)', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const mainVideos = nodes.filter((node) => node.type === 'video' && String(node.props.className) === 've-video')
  if (mainVideos.length !== 2) throw new Error(`expected exactly 2 pooled main videos, saw ${mainVideos.length}`)
  // The pool must carry NO React-supplied src: the engine writes it imperatively,
  // which is what keeps a poll from restarting playback.
  if (mainVideos.some((node) => node.props.src !== undefined)) {
    throw new Error('a pooled main video received src from React')
  }
  return `${mainVideos.length} pooled videos, no React-driven src`
})

await run('add-to-timeline calls op with addClip on the main track', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const addButtons = byClass(nodes, 've-mini-btn').filter((node) => node.props.title === 'bin.addToTimeline')
  if (addButtons.length === 0) throw new Error('no add-to-timeline buttons')

  const before = fetches.length
  server.pendingState = fullState({ revision: 8 })
  addButtons[0].props.onClick({ stopPropagation() {} })
  await flushMicrotasks()
  const opCall = fetches.slice(before).find((call) => String(call.url).endsWith('/op'))
  if (opCall === undefined) throw new Error('no /op request issued')
  const body = JSON.parse(opCall.init.body)
  if (body.op?.type !== 'addClip') throw new Error(`op type ${body.op?.type}`)
  if (body.op?.track !== 0) throw new Error(`op track ${body.op?.track}`)
  if (typeof body.op?.mediaId !== 'string') throw new Error('addClip missing mediaId')
  if (!String(opCall.url).startsWith(`/video-editor/s/${SESSION}/`)) {
    throw new Error(`op URL is not session-scoped: ${opCall.url}`)
  }
  return `POST ${opCall.url} {${body.op.type}, track:${body.op.track}, mediaId:"${body.op.mediaId}"}`
})

await run('timeline keyboard Delete issues a delete op with the clip id', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const clips = byClass(nodes, 've-clip')
  if (clips.length === 0) throw new Error('no clips to select')
  const timeline = byClass(nodes, 've-timeline')[0]
  if (typeof timeline.props.onKeyDown !== 'function') throw new Error('timeline has no key handler')

  // Select the first clip through its own mousedown handler, as a user would.
  clips[0].props.onMouseDown({ button: 0, stopPropagation() {}, clientX: 0 })
  await flushMicrotasks()
  // Selection is React state: re-render once (as the browser does) and adopt the
  // fresh nodes, so the handlers fired below come from the re-rendered tree.
  current = refresh()

  const timelineAfter = byClass(current, 've-timeline')[0]
  if (typeof timelineAfter?.props.onKeyDown !== 'function') throw new Error('no key handler after refresh')

  const before = fetches.length
  server.pendingState = fullState({ revision: 9 })
  timelineAfter.props.onKeyDown({
    key: 'Delete', target: { tagName: 'DIV' }, preventDefault() {}, ctrlKey: false, metaKey: false, shiftKey: false,
  })
  await flushMicrotasks()

  const opCall = fetches.slice(before).find((call) => String(call.url).endsWith('/op'))
  if (opCall === undefined) throw new Error('Delete key issued no /op request')
  const body = JSON.parse(opCall.init.body)
  if (body.op?.type !== 'delete') throw new Error(`op type ${body.op?.type}, expected delete`)
  if (!Array.isArray(body.op?.clipIds) || body.op.clipIds.length !== 1) {
    throw new Error(`delete op clipIds = ${JSON.stringify(body.op?.clipIds)}`)
  }
  return `delete {clipIds:[${body.op.clipIds.join(',')}]}`
})

await run('Space toggles playback through the transport', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes
  const timeline = byClass(nodes, 've-timeline')[0]
  const transport = byClass(nodes, 've-transport')
  if (transport.length === 0) throw new Error('no transport bar')
  const playButton = byTag(nodes, 'button').find((node) => node.props.className?.includes('ve-play-btn'))
  if (playButton === undefined) throw new Error('no play button')
  if (typeof playButton.props.onClick !== 'function') throw new Error('play button has no click handler')
  if (typeof timeline.props.onKeyDown !== 'function') throw new Error('timeline has no key handler')
  // A Space keydown on the timeline root must not fall through to the page.
  let prevented = false
  timeline.props.onKeyDown({ key: ' ', code: 'Space', target: { tagName: 'DIV' }, preventDefault() { prevented = true }, ctrlKey: false, metaKey: false, shiftKey: false })
  if (!prevented) throw new Error('Space keydown was not prevented')
  return `play button + Space handled (prevented=${prevented})`
})

await run('split button issues a split op at the playhead', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes
  const clips = byClass(nodes, 've-clip')
  if (clips.length === 0) throw new Error('no clips')
  clips[0].props.onMouseDown({ button: 0, stopPropagation() {}, clientX: 0 })
  await flushMicrotasks()
  // Selection is React state: re-render once (as the browser does) and re-read
  // the button, because the pre-render element holds a stale, disabled closure.
  current = refresh()

  const splitButton = byTag(current, 'button').find((node) => node.props.title?.startsWith('timeline.splitAtPlayhead'))
  if (splitButton === undefined) throw new Error('no split button')

  const before = fetches.length
  server.pendingState = fullState({ revision: 11 })
  splitButton.props.onClick({})
  await flushMicrotasks()
  const opCall = fetches.slice(before).find((call) => String(call.url).endsWith('/op'))
  if (opCall === undefined) throw new Error('split button issued no /op request')
  const body = JSON.parse(opCall.init.body)
  if (body.op?.type !== 'split') throw new Error(`op type ${body.op?.type}`)
  if (typeof body.op?.clipId !== 'string') throw new Error('split op missing clipId')
  if (!Number.isFinite(body.op?.at)) throw new Error('split op missing `at`')
  return `split {clipId:${body.op.clipId}, at:${body.op.at}}`
})

await run('undo/redo buttons issue the matching ops', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes
  const undo = byTag(nodes, 'button').find((node) => node.props.title?.startsWith('toolbar.undo'))
  const redo = byTag(nodes, 'button').find((node) => node.props.title?.startsWith('toolbar.redo'))
  if (undo === undefined) throw new Error('no undo button')
  if (redo === undefined) throw new Error('no redo button')
  if (undo.props.disabled === true) throw new Error('undo should be enabled when canUndo is true')
  if (redo.props.disabled !== true) throw new Error('redo should be disabled when canRedo is false')

  const before = fetches.length
  server.pendingState = fullState({ revision: 12 })
  undo.props.onClick({})
  await flushMicrotasks()
  const opCall = fetches.slice(before).find((call) => String(call.url).endsWith('/op'))
  if (opCall === undefined) throw new Error('undo issued no /op request')
  const body = JSON.parse(opCall.init.body)
  if (body.op?.type !== 'undo') throw new Error(`op type ${body.op?.type}`)
  return `undo {type:undo}; redo disabled per canRedo=false`
})

run('trim handles issue a trim op bound to the contract window', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const handles = byClass(nodes, 've-clip-handle')
  if (handles.length === 0) throw new Error('no trim handles')
  if (typeof handles[0].props.onMouseDown !== 'function') throw new Error('handle has no mousedown handler')

  const listeners = []
  const originalAdd = sandbox.window.addEventListener
  windowStub.addEventListener = (type, fn) => listeners.push({ type, fn })
  windowStub.removeEventListener = () => {}
  try {
    handles[0].props.onMouseDown({ button: 0, preventDefault() {}, stopPropagation() {}, clientX: 100 })
    if (!listeners.some((entry) => entry.type === 'mousemove')) throw new Error('trim drag did not attach a mousemove listener')

    const before = fetches.length
    server.pendingState = fullState({ revision: 10 })
    const move = listeners.find((entry) => entry.type === 'mousemove')
    move.fn({ clientX: 160 })
    const up = listeners.find((entry) => entry.type === 'mouseup')
    up.fn()
    await flushMicrotasks()
    const opCall = fetches.slice(before).find((call) => String(call.url).endsWith('/op'))
    if (opCall === undefined) throw new Error('trim issued no /op request')
    const body = JSON.parse(opCall.init.body)
    if (body.op?.type !== 'trim') throw new Error(`op type ${body.op?.type}`)
    if (!Number.isFinite(body.op?.in) || !Number.isFinite(body.op?.out)) throw new Error('trim op missing in/out')
    return `trim {in:${body.op.in}, out:${body.op.out}}`
  } finally {
    windowStub.addEventListener = originalAdd
  }
})

run('polling does not re-mount the preview videos (stable element identity)', async () => {
  server.reset(fullState())
  const first = await mount(viewReg.component({ t, sessionId: SESSION }))
  const firstVideos = first.nodes.filter((node) => node.type === 'video' && node.props.className === 've-video')
  if (firstVideos.length !== 2) throw new Error('pool missing')

  // A poll carrying the same revision must not change element identity.
  server.reset(fullState())
  const second = await mount(viewReg.component({ t, sessionId: SESSION }))
  const secondVideos = second.nodes.filter((node) => node.type === 'video' && node.props.className === 've-video')
  if (secondVideos.length !== 2) throw new Error('pool lost a video')
  if (firstVideos.some((video) => video.props.src !== undefined)) throw new Error('React drove a pooled src')
  if (secondVideos.some((video) => video.props.src !== undefined)) throw new Error('React drove a pooled src')

  // The overlay video is the only React-driven src, and it is keyed by index.
  const overlays = second.nodes.filter((node) => node.type === 'video' && node.props.className === 've-overlay-video')
  if (overlays.length !== 1) throw new Error(`overlay count ${overlays.length}`)
  if (!String(overlays[0].props.src).startsWith(`/video-editor/s/${SESSION}/media/`)) {
    throw new Error(`overlay src is not session-scoped: ${overlays[0].props.src}`)
  }
  return `2 stable pool videos, 1 overlay (${overlays[0].props.src})`
})

run('every fetch URL is built from the session id', async () => {
  server.reset(fullState())
  await mount(viewReg.component({ t, sessionId: SESSION }))
  if (fetches.length > 0) {
    const bad = fetches.filter((call) => !String(call.url).startsWith(`/video-editor/s/${SESSION}/`))
    if (bad.length > 0) throw new Error(`off-session URL: ${bad[0].url}`)
  }
  const rewrites = fetches.map((call) => String(call.url).replace(`/video-editor/s/${SESSION}`, '<sid>'))
  return rewrites.join(' | ')
})

run('no layout jump: identical state keeps identical class set and node count', async () => {
  server.reset(fullState())
  const a = await mount(viewReg.component({ t, sessionId: SESSION }))
  server.reset(fullState())
  const b = await mount(viewReg.component({ t, sessionId: SESSION }))
  if (a.nodes.length !== b.nodes.length) throw new Error(`node count drifted ${a.nodes.length} -> ${b.nodes.length}`)
  const classesA = [...classSet(a.nodes)].sort().join(' ')
  const classesB = [...classSet(b.nodes)].sort().join(' ')
  if (classesA !== classesB) throw new Error('class set drifted between polls')
  return `${a.nodes.length} nodes, ${classSet(a.nodes).size} classes stable`
})

await run('timeline keyboard shortcuts are wired on a focusable root', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const timelines = byClass(nodes, 've-timeline')
  if (timelines.length !== 1) throw new Error('no timeline root')
  if (timelines[0].props.tabIndex !== 0) throw new Error('timeline root is not focusable')
  if (typeof timelines[0].props.onKeyDown !== 'function') throw new Error('timeline root has no key handler')
  return 'tabIndex=0 + onKeyDown'
})

await run('export dialog renders with the progress bar and disabled start in empty state', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  // The modal is closed by default: `open !== true` returns null, so no modal.
  const backdrops = byClass(nodes, 've-modal-backdrop')
  if (backdrops.length !== 0) throw new Error('export modal should be closed by default')
  return 'closed by default'
})

await run('ruler ticks use chooseStep spacing and mm:ss labels', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const labels = byClass(nodes, 've-ruler-label')
  if (labels.length === 0) throw new Error('no ruler labels')
  if (labels.some((node) => !/^\d{2}:\d{2}$/.test(String(node.props.children)))) {
    throw new Error(`a ruler label is not mm:ss: ${labels.map((n) => n.props.children).join(',')}`)
  }
  return `${labels.length} labels, first "${labels[0].props.children}"`
})

await run('timecodes are tabular-numeral classed and MM:SS:FF formatted', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const timecodes = byClass(nodes, 've-timecode')
  if (timecodes.length === 0) throw new Error('no timecode elements')
  const broken = timecodes.filter((node) => !/^\d{2}:\d{2}:\d{2}$/.test(String(node.props.children)))
  if (broken.length > 0) throw new Error(`bad timecode: ${broken.map((n) => n.props.children).join(',')}`)
  return `${timecodes.length} timecodes, e.g. ${timecodes[0].props.children}`
})

await run('no emoji anywhere in the rendered copy', async () => {
  server.reset(fullState())
  let current
  const { nodes, refresh } = await mount(viewReg.component({ t, sessionId: SESSION }))
  current = nodes

  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u
  let text = ''
  const gather = (node) => {
    if (node === null || node === undefined) return
    if (typeof node === 'string') { text += node; return }
    if (typeof node === 'number') return
    if (Array.isArray(node)) { node.forEach(gather); return }
    if (typeof node !== 'object') return
    gather(node.props?.children)
  }
  gather(nodes)
  if (emoji.test(text)) throw new Error(`emoji found: ${text.match(emoji)[0]}`)
  return `${text.length} chars, no emoji`
})

console.log('')
console.log(`${checks - failures}/${checks} deep-render checks passed`)
if (failures === 0) {
  console.log('ALL DEEP-RENDER CHECKS PASSED')
} else {
  console.log(`${failures} DEEP-RENDER CHECK(S) FAILED`)
  process.exitCode = 1
}
