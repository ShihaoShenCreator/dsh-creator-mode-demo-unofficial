/**
 * Focused proof: selecting a clip, then Delete, issues a delete op.
 *
 * This is a small purpose-built harness (not the shared deeprender harness)
 * so a failure here means the COMPONENT is wrong, not that a mock is wrong.
 * It re-renders after the selection exactly as a browser would.
 */

import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const workspace = join(here, '..')
const bundle = readFileSync(join(workspace, 'video-editor', 'client.js'), 'utf8')

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`PASS  ${name}${detail === '' ? '' : `  ${detail}`}`)
  else {
    failures += 1
    console.log(`FAIL  ${name}${detail === '' ? '' : `  ${detail}`}`)
  }
}

// ---------------------------------------------------------------- React fake
const cells = []
let hookIndex = 0
const effectQueue = []
let root = null
let nodes = []
let scheduled = false

const element = (type, props, ...children) => ({ $$typeof: 'el', type, props: props ?? {}, children })
const flatten = (tree) => {
  const out = []
  const walk = (node, parent) => {
    if (node === null || node === undefined || node === false || node === true) return
    if (Array.isArray(node)) {
      for (const child of node) walk(child, parent)
      return
    }
    if (typeof node === 'string' || typeof node === 'number') return
    if (typeof node.type === 'string') {
      out.push({ node, parent })
      for (const child of node.children ?? []) walk(child, node)
      return
    }
    // Component: invoke it inline. Function components are called; class
    // components are constructed and their render() called (once), which is how
    // the bundle's error boundary participates in the tree.
    if (typeof node.type === 'function') {
      const isClass = node.type.prototype !== undefined && node.type.prototype.render !== undefined
      if (isClass) {
        const instance = new node.type(node.props)
        instance.state = instance.state ?? {}
        walk(instance.render(), node)
        return
      }
      walk(node.type(node.props), node)
    }
  }
  walk(tree, null)
  return out
}

const runtime = {
  // Real React merges children into props.children; the bundle's error boundary
  // renders `this.props.children`, so the fake must do the same.
  createElement: (type, props, ...children) => ({
    $$typeof: 'el',
    type,
    props: { ...(props ?? {}), ...(children.length === 0 ? {} : { children: children.length === 1 ? children[0] : children }) },
    children,
  }),
  useState(initial) {
    const slot = hookIndex
    hookIndex += 1
    if (cells[slot] === undefined) cells[slot] = { value: typeof initial === 'function' ? initial() : initial }
    const set = (next) => {
      cells[slot].value = typeof next === 'function' ? next(cells[slot].value) : next
      scheduled = true
    }
    return [cells[slot].value, set]
  },
  useReducer(reducer, initial) {
    const state = runtime.useState(initial)
    return [state[0], () => {}]
  },
  useEffect(fn) {
    effectQueue.push(fn)
  },
  useLayoutEffect(fn) {
    effectQueue.push(fn)
  },
  useRef(value) {
    const slot = hookIndex
    hookIndex += 1
    if (cells[slot] === undefined) cells[slot] = { value: { current: value } }
    return cells[slot].value
  },
  useMemo(fn) {
    return fn()
  },
  useCallback(fn) {
    return fn
  },
  useContext() {
    return {}
  },
  createContext() {
    return { Provider: 'P', Consumer: 'C' }
  },
  Component: class {
    constructor(props) {
      this.props = props
    }
    setState() {}
  },
  Fragment: 'F',
}
// esbuild's __toESM interop checks `__esModule` and then re-exports the module
// under `default`; the bundle reads `import_react.default.createElement`, so
// both marks must be present on the stub exactly like a real ESM namespace.
runtime.__esModule = true
runtime.default = runtime

// ---------------------------------------------------------------- environment
const fetches = []
let stateRevision = 1
const baseState = () => ({
  sessionId: 'focus-session',
  revision: stateRevision,
  title: '焦点测试',
  width: 1280,
  height: 720,
  fps: 30,
  canUndo: false,
  canRedo: false,
  media: [
    { id: 'm1', name: 'a.mp4', duration: 12, width: 1280, height: 720, fps: 30, hasAudio: true, size: 1,
      playUrl: '/video-editor/s/focus-session/media/m1', posterUrl: '/video-editor/s/focus-session/media/m1/poster.jpg',
      frameUrl: '/video-editor/s/focus-session/media/m1/frame.jpg' },
  ],
  clips: [
    { id: 'c1', mediaId: 'm1', track: 0, in: 0, out: 3 },
    { id: 'c2', mediaId: 'm1', track: 0, in: 5, out: 8 },
  ],
  timeline: {
    main: [
      { clipId: 'c1', start: 0, end: 3, duration: 3 },
      { clipId: 'c2', start: 3, end: 6, duration: 3 },
    ],
    overlays: [],
    duration: 6,
  },
})

globalThis.window = {
  __ModuleLoader__: { load: (v) => { globalThis.__H = v } },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() { return true },
  location: { href: 'http://127.0.0.1/' },
  setTimeout,
  clearTimeout,
}
globalThis.fetch = async (url, init) => {
  fetches.push({ url: String(url), init: init ?? {} })
  const body = init?.body !== undefined ? JSON.parse(init.body) : {}
  const next = baseState()
  if (String(url).endsWith('/op')) {
    stateRevision += 1
    next.revision = stateRevision
    if (body.op?.type === 'delete') next.clips = next.clips.filter((clip) => !(body.op.clipIds ?? []).includes(clip.id))
  }
  return {
    ok: true,
    status: 200,
    async json() { return { ok: true, state: next } },
    async text() { return '' },
  }
}

new Function('window', bundle)(globalThis.window)
const surface = globalThis.__H.factory((name) => {
  if (name === 'react') {
    // esbuild's __toESM interop reads `__esModule` and re-exports the stub under
    // `default`; both marks are required for `require('react').default.xxx`.
    runtime.__esModule = true
    runtime.default = runtime
    return runtime
  }
  if (name === 'react-dom' || name === 'react-dom/client') {
    return { createRoot: () => ({ render() {}, unmount() {} }) }
  }
  throw new Error(`unexpected require: ${name}`)
})

const registrations = []
const fakeCtx = {
  slots: { inject: (k, cb) => cb(), register: (o, c) => { registrations.push({ o, c }); return () => {} } },
  locale: {
    register: () => () => {},
    bind: () => (key, params) => (params === undefined ? key
      : Object.entries(params).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), key)),
    subscribe: () => () => {},
    getLocale: () => ({ active: 'zh', locales: [{ id: 'zh', label: '中文' }], revision: 0 }),
  },
  effect: (cb) => { const d = typeof cb === 'function' ? cb() : undefined; return () => { if (typeof d === 'function') d() } },
  get: () => undefined,
  on: () => () => {},
}
surface.apply(fakeCtx)

const view = registrations.find((entry) => entry.o.name === 'conversation.view')
check('view entry registered', view !== undefined)

// ---------------------------------------------------------------- mount
const viewElementProps = { t: (key) => key, sessionId: 'focus-session' }

function renderPass() {
  hookIndex = 0
  nodes = flatten(view.c(viewElementProps))
}

function runEffectsOnce() {
  const queue = effectQueue.splice(0, effectQueue.length)
  for (const fn of queue) {
    try {
      fn()
    } catch {
      /* a throwing effect must not abort the harness */
    }
  }
}

root = view.c(viewElementProps)
for (let pass = 0; pass < 6; pass += 1) {
  renderPass()
  runEffectsOnce()
  await Promise.resolve()
  await Promise.resolve()
  if (!scheduled) break
  scheduled = false
}

// ---------------------------------------------------------------- interaction
const byClass = (cls) => nodes.filter((entry) => String(entry.node.props.className ?? '').includes(cls)).map((e) => e.node)
const byTag = (tag) => nodes.filter((entry) => entry.node.type === tag).map((e) => e.node)

const clips = byClass('ve-clip')
check('clips rendered', clips.length >= 2, String(clips.length))

// Click the first clip (browser: mousedown then a re-render with new state).
clips[0].props.onMouseDown({ button: 0, stopPropagation() {}, clientX: 0 })
await Promise.resolve()
check('selection scheduled a re-render', scheduled === true)

scheduled = false
for (let pass = 0; pass < 4; pass += 1) {
  renderPass()
  runEffectsOnce()
  await Promise.resolve()
  await Promise.resolve()
  if (!scheduled) break
  scheduled = false
}

const selectedClips = byClass('ve-clip-selected')
check('clip shows selected state after re-render', selectedClips.length === 1, String(selectedClips.length))

// Now press Delete on the timeline root.
const timeline = byClass('ve-timeline')[0]
check('timeline root present', timeline !== undefined)
const fetchesBefore = fetches.length
timeline.props.onKeyDown({
  key: 'Delete', target: { tagName: 'DIV' }, preventDefault() {}, ctrlKey: false, metaKey: false, shiftKey: false,
})
await Promise.resolve()
await Promise.resolve()
const opCall = fetches.slice(fetchesBefore).find((call) => call.url.endsWith('/op'))
check('Delete issued a /op request', opCall !== undefined)
if (opCall !== undefined) {
  const body = JSON.parse(opCall.init.body)
  check('op is delete with one clip id', body.op?.type === 'delete' && Array.isArray(body.op?.clipIds) && body.op.clipIds.length === 1,
    JSON.stringify(body.op))
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
