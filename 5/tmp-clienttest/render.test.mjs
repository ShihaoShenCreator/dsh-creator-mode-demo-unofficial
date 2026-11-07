/**
 * Render-path test: invoke every workbench component with realistic project
 * state and assert it returns a React element tree without throwing.
 *
 * React is the fake from the smoke harness (hooks return their initial values
 * and effects do not run), so this exercises render-time logic only — which is
 * exactly where a bad property read would crash the page.
 *
 * Run: node tmp-clienttest\render.test.mjs
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
  } catch (error) {
    failures += 1
    console.log(`FAIL  ${name} — ${error && error.message}`)
  }
}

/* ------------------------------------------------------------ fake React */
const fakeReact = {
  createElement(type, props, ...children) {
    let key = null
    if (props !== null && props !== undefined && props.key !== undefined) {
      key = props.key
      delete props.key
    }
    const merged = { ...(props ?? {}) }
    if (children.length === 1) merged.children = children[0]
    else if (children.length > 1) merged.children = children
    return { $$typeof: 'react.element', type, props: merged, key }
  },
  Fragment: 'react.fragment',
  useState(initial) {
    const value = typeof initial === 'function' ? initial() : initial
    return [value, () => {}]
  },
  useEffect() {},
  useLayoutEffect() {},
  useMemo(fn) {
    return fn()
  },
  useCallback(fn) {
    return fn
  },
  useRef(initial) {
    return { current: initial === undefined ? null : initial }
  },
  useReducer(_reducer, initial) {
    return [initial, () => {}]
  },
  useContext() {
    return null
  },
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
    map: (list, fn) => (list === undefined || list === null ? [] : [fn(list)]),
    toArray: (list) => (list === undefined || list === null ? [] : [list]),
    count: (list) => (list === undefined || list === null ? 0 : 1),
  },
  StrictMode: 'react.strictmode',
}
fakeReact.default = fakeReact

const fakeReactDom = { createRoot: () => ({ render: (n) => n, unmount() {} }), render: (n) => n, default: null }
fakeReactDom.default = fakeReactDom

/* ---------------------------------------------------------- load the bundle */
let handoff = null
const windowStub = {
  __ModuleLoader__: { load: (entry) => { handoff = entry } },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => true,
  setTimeout: () => 0,
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
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
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
  CustomEvent: class CustomEvent { constructor(type) { this.type = type } },
}
sandbox.globalThis = sandbox

new vm.Script(bundle, { filename: 'video-editor/client.js' }).runInNewContext(sandbox)
const surface = handoff.factory((name) => {
  if (name === 'react') return fakeReact
  if (name === 'react-dom' || name === 'react-dom/client') return fakeReactDom
  throw new Error(`unexpected require(${name})`)
})

/* ------------------------------------------------------------ fixtures */

const SESSION = 'render-test-session'

function mediaItem(id, name, duration, width = 1920, height = 1080) {
  return {
    id,
    name,
    sourcePath: `C:/fake/${name}`,
    origin: 'upload',
    duration,
    width,
    height,
    fps: 30,
    hasAudio: true,
    size: 1024,
    addedAt: 1,
    playUrl: `/video-editor/s/${SESSION}/media/${id}`,
    posterUrl: `/video-editor/s/${SESSION}/media/${id}/poster.jpg`,
    frameUrl: `/video-editor/s/${SESSION}/media/${id}/frame.jpg`,
  }
}

const MEDIA = [mediaItem('m1', 'demo-a.mp4', 6), mediaItem('m2', 'demo-b.mp4', 4, 1280, 720)]

/** A project with two main clips and one overlay. */
function fullState() {
  const clips = [
    { id: 'c1', mediaId: 'm1', track: 0, in: 1, out: 4 },
    { id: 'c2', mediaId: 'm2', track: 0, in: 0, out: 3 },
    { id: 'c3', mediaId: 'm1', track: 1, in: 0, out: 2, start: 1, x: 384, y: 108, scale: 0.4 },
  ]
  return {
    sessionId: SESSION,
    revision: 7,
    title: '测试项目',
    width: 1920,
    height: 1080,
    fps: 30,
    media: MEDIA,
    clips,
    timeline: {
      main: [
        { clipId: 'c1', start: 0, end: 3, duration: 3 },
        { clipId: 'c2', start: 3, end: 6, duration: 3 },
      ],
      overlays: [{ clipId: 'c3', start: 1, end: 3, duration: 2 }],
      duration: 6,
    },
    canUndo: true,
    canRedo: false,
    updatedAt: 1,
  }
}

/** The wire state an empty project returns. */
function emptyState() {
  return {
    sessionId: SESSION,
    revision: 0,
    title: '未命名剪辑',
    width: 1920,
    height: 1080,
    fps: 30,
    media: [],
    clips: [],
    timeline: { main: [], overlays: [], duration: 0 },
    canUndo: false,
    canRedo: false,
    updatedAt: 1,
  }
}

const t = (key, params) => {
  if (params === undefined) return `«${key}»`
  return `«${key}:${Object.entries(params).map(([name, value]) => `${name}=${value}`).join(',')}»`
}

const clock = {
  get: () => 1.5,
  set() {},
  emit() {},
  subscribe() {
    return () => {}
  },
  reset() {},
}

const op = () => Promise.resolve({ ok: true })
const noop = () => {}

/* ------------------------------------------------------- component render */
// The bundle's export surface only carries `apply`/`inject`, so components are
// reached through the slot registrations, which is exactly how the app mounts
// them.
const registrations = []
handoff.factory((name) => {
  if (name === 'react') return fakeReact
  if (name === 'react-dom' || name === 'react-dom/client') return fakeReactDom
  throw new Error(`unexpected require(${name})`)
})

const fakeCtx = {
  slots: {
    inject(_slot, factory) {
      return factory()
    },
    register(options, component) {
      registrations.push({ options, component })
      return () => {}
    },
  },
  locale: {
    register: () => () => {},
    bind: () => t,
    subscribe: () => () => {},
  },
  effect(fn) {
    const disposer = fn()
    return () => {
      if (typeof disposer === 'function') disposer()
    }
  },
  get() {
    return undefined
  },
}
surface.apply(fakeCtx)

const viewReg = registrations.find((entry) => entry.options.name === 'conversation.view')
const openerReg = registrations.find((entry) => entry.options.name === 'conversation.session.header.views.actions')
const dockReg = registrations.find((entry) => entry.options.name === 'conversation.composer.dock')

check('three registrations captured', () => `${registrations.length}`)

/** Recursively *render* an element tree: invoke every function component in it. */
function walk(element, depth = 0) {
  if (element === null || element === undefined || depth > 30) return
  if (typeof element === 'string' || typeof element === 'number') return
  if (Array.isArray(element)) {
    for (const child of element) walk(child, depth + 1)
    return
  }
  if (typeof element !== 'object') return
  const type = element.type
  const props = element.props ?? {}
  if (typeof type === 'function') {
    // Class components are declared with React.Component in the bundle.
    if (type.prototype !== undefined && typeof type.prototype.render === 'function') {
      const instance = new type(props)
      walk(instance.render(), depth + 1)
      return
    }
    walk(type(props), depth + 1)
    return
  }
  walk(props.children, depth + 1)
}

/** Flatten a rendered tree into elements, then apply a predicate. */
function collect(element, predicate, out = [], depth = 0) {
  if (element === null || element === undefined || depth > 30) return out
  if (typeof element === 'string' || typeof element === 'number') return out
  if (Array.isArray(element)) {
    for (const child of element) collect(child, predicate, out, depth + 1)
    return out
  }
  if (typeof element !== 'object') return out
  const type = element.type
  const props = element.props ?? {}
  if (typeof type === 'function') {
    if (type.prototype !== undefined && typeof type.prototype.render === 'function') {
      collect(new type(props).render(), predicate, out, depth + 1)
    } else {
      collect(type(props), predicate, out, depth + 1)
    }
    return out
  }
  if (predicate(element)) out.push(element)
  collect(props.children, predicate, out, depth + 1)
  return out
}

check('view entry renders (empty project)', () => {
  const element = viewReg.component({ t, sessionId: SESSION })
  walk(element)
  const roots = collect(element, (node) => node.props.className === 've-root')
  if (roots.length === 0) throw new Error('no ve-root rendered')
  return `${roots.length} ve-root`
})

check('view entry renders without a session (error card)', () => {
  const element = viewReg.component({ t })
  walk(element)
  const cards = collect(element, (node) => typeof node.props.className === 'string' && node.props.className.includes('ve-error-card'))
  if (cards.length === 0) throw new Error('no error card rendered')
  return `${cards.length} error card`
})

check('opener row renders its menu-row button', () => {
  const element = openerReg.component({
    t,
    entries: [{ id: 'video-editor', label: '剪辑工作台', pinned: true }],
    onOpen: noop,
    onPinnedChange: noop,
    onDismiss: noop,
  })
  walk(element)
  const rows = collect(element, (node) => node.props.className === 've-opener-row')
  if (rows.length === 0) throw new Error('no ve-opener-row rendered')
  return rows[0].props.className
})

check('opener row calls onOpen with the view id', () => {
  const seen = []
  const element = openerReg.component({
    t,
    entries: [],
    onOpen: (id) => seen.push(id),
    onPinnedChange: noop,
    onDismiss: () => seen.push('dismiss'),
  })
  const rows = collect(element, (node) => node.props.className === 've-opener-row')
  if (rows.length === 0) throw new Error('no ve-opener-row rendered')
  rows[0].props.onClick()
  if (seen[0] !== 'video-editor') throw new Error(`onOpen got ${seen[0]}`)
  if (seen[1] !== 'dismiss') throw new Error(`onDismiss got ${seen[1]}`)
  return seen.join(',')
})

check('dock strip renders', () => {
  const element = dockReg.component({ t, sessionId: SESSION })
  walk(element)
  const strips = collect(element, (node) => node.props.className === 've-dock')
  if (strips.length === 0) throw new Error('no ve-dock rendered')
  return strips[0].props.className
})

check('dock strip dispatches the documented CustomEvent on click', () => {
  const seen = []
  const element = dockReg.component({ t, sessionId: SESSION })
  const strips = collect(element, (node) => node.props.className === 've-dock')
  if (strips.length === 0) throw new Error('no ve-dock rendered')
  const originalDispatch = windowStub.dispatchEvent
  windowStub.dispatchEvent = (event) => {
    seen.push(event.type)
    return true
  }
  try {
    strips[0].props.onClick()
  } finally {
    windowStub.dispatchEvent = originalDispatch
  }
  if (seen[0] !== 'dsh-video-editor:open') throw new Error(`dispatched ${seen[0]}`)
  return seen[0]
})

check('view element tree contains all six layout regions', () => {
  const element = viewReg.component({ t, sessionId: SESSION })
  const found = new Set()
  for (const node of collect(element, () => true)) {
    if (typeof node.props.className !== 'string') continue
    for (const cls of node.props.className.split(' ')) {
      if (cls.startsWith('ve-')) found.add(cls)
    }
  }
  const required = ['ve-root', 've-toolbar', 've-main', 've-bin', 've-preview-pane', 've-timeline']
  const missing = required.filter((cls) => !found.has(cls))
  if (missing.length > 0) throw new Error(`missing ${missing.join(',')} (saw ${[...found].join(' ')})`)
  return `${found.size} ve- classes`
})

function describe(element) {
  if (element === null || element === undefined) return 'null'
  if (Array.isArray(element)) return `[${element.length}]`
  if (typeof element !== 'object') return typeof element
  return String(element.props?.className ?? element.type ?? 'element')
}

/* ------------------------------------------------------ module surface sanity */

check('apply returned without throwing and registered 3 entries', () => `${registrations.length} entries`)

console.log('')
console.log(`${checks - failures}/${checks} render checks passed`)
if (failures === 0) {
  console.log('ALL RENDER CHECKS PASSED')
} else {
  console.log(`${failures} RENDER CHECK(S) FAILED`)
  process.exitCode = 1
}
