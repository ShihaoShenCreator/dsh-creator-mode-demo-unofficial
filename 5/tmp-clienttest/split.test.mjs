/**
 * Focused proof: the timeline split button issues a `split` op.
 *
 * Purpose-built harness (same shape as focus.test.mjs) so a failure means the
 * COMPONENT is wrong rather than a shared mock being incomplete.
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

const cells = []
let hookIndex = 0
const effectQueue = []
let scheduled = false
let nodes = []

const flatten = (tree) => {
  const out = []
  const walk = (node) => {
    if (node === null || node === undefined || node === false || node === true) return
    if (Array.isArray(node)) { for (const child of node) walk(child); return }
    if (typeof node === 'string' || typeof node === 'number') return
    if (typeof node.type === 'string') {
      out.push(node)
      for (const child of node.children ?? []) walk(child)
      walk(node.props?.children)
      return
    }
    if (typeof node.type === 'function') {
      const isClass = node.type.prototype !== undefined && typeof node.type.prototype.render === 'function'
      if (isClass) {
        const instance = new node.type(node.props)
        instance.state = instance.state ?? {}
        walk(instance.render())
        return
      }
      walk(node.type(node.props))
    }
  }
  walk(tree)
  return out
}

const runtime = {
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
    return [cells[slot].value, (next) => {
      cells[slot].value = typeof next === 'function' ? next(cells[slot].value) : next
      scheduled = true
    }]
  },
  useReducer(reducer, initial) {
    const state = runtime.useState(initial)
    return [state[0], () => {}]
  },
  useEffect(fn) { effectQueue.push(fn) },
  useLayoutEffect(fn) { effectQueue.push(fn) },
  useRef(value) {
    const slot = hookIndex
    hookIndex += 1
    if (cells[slot] === undefined) cells[slot] = { value: { current: value } }
    return cells[slot].value
  },
  useMemo(fn) { return fn() },
  useCallback(fn) { return fn },
  useContext() { return {} },
  createContext() { return { Provider: 'P', Consumer: 'C' } },
  Component: class { constructor(props) { this.props = props } setState() {} },
  Fragment: 'F',
}
runtime.__esModule = true
runtime.default = runtime

const fetches = []
let stateRevision = 1
const baseState = () => ({
  sessionId: 'split-session',
  revision: stateRevision,
  title: '切分测试',
  width: 1280,
  height: 720,
  fps: 30,
  canUndo: false,
  canRedo: false,
  media: [{ id: 'm1', name: 'a.mp4', duration: 12, width: 1280, height: 720, fps: 30, hasAudio: true, size: 1,
    playUrl: '/video-editor/s/split-session/media/m1', posterUrl: '/video-editor/s/split-session/media/m1/poster.jpg',
    frameUrl: '/video-editor/s/split-session/media/m1/frame.jpg' }],
  clips: [{ id: 'c1', mediaId: 'm1', track: 0, in: 0, out: 6 }],
  timeline: { main: [{ clipId: 'c1', start: 0, end: 6, duration: 6 }], overlays: [], duration: 6 },
})

globalThis.window = {
  __ModuleLoader__: { load: (v) => { globalThis.__H = v } },
  addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true },
  location: { href: 'http://127.0.0.1/' }, setTimeout, clearTimeout,
}
globalThis.fetch = async (url, init) => {
  fetches.push({ url: String(url), init: init ?? {} })
  const next = baseState()
  if (String(url).endsWith('/op')) {
    stateRevision += 1
    next.revision = stateRevision
  }
  return { ok: true, status: 200, async json() { return { ok: true, state: next } }, async text() { return '' } }
}

new Function('window', bundle)(globalThis.window)
const surface = globalThis.__H.factory((name) => {
  if (name === 'react') return runtime
  if (name === 'react-dom' || name === 'react-dom/client') return { createRoot: () => ({ render() {}, unmount() {} }) }
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
const props = { t: (key) => key, sessionId: 'split-session' }

async function render() {
  for (let pass = 0; pass < 6; pass += 1) {
    hookIndex = 0
    nodes = flatten(view.c(props))
    const queue = effectQueue.splice(0, effectQueue.length)
    for (const fn of queue) {
      try { fn() } catch { /* ignore */ }
    }
    await Promise.resolve()
    await Promise.resolve()
    if (!scheduled) break
    scheduled = false
  }
}

await render()

const byClass = (cls) => nodes.filter((node) => String(node.props?.className ?? '').includes(cls))
const buttons = () => nodes.filter((node) => node.type === 'button')

const splitButton = buttons().find((node) => String(node.props.title ?? '').startsWith('timeline.splitAtPlayhead'))
check('split button found', splitButton !== undefined, String(buttons().map((b) => b.props.title).filter(Boolean).join(' | ')))

if (splitButton !== undefined) {
  // The button is disabled until a clip is selected (splitting needs a target).
  check('split button disabled before selection', splitButton.props.disabled === true, String(splitButton.props.disabled))

  // Select a clip first (the button splits the clip at the playhead, which needs a target).
  const clips = byClass('ve-clip')
  if (clips.length > 0) {
    clips[0].props.onMouseDown({ button: 0, stopPropagation() {}, clientX: 0 })
    await Promise.resolve()
    scheduled = false
    await render()
  }

  const fresh = buttons().find((node) => String(node.props.title ?? '').startsWith('timeline.splitAtPlayhead'))
  check('split button present after selection', fresh !== undefined)
  if (fresh !== undefined) check('split button enabled after selection', fresh.props.disabled !== true, String(fresh.props.disabled))

  const before = fetches.length
  if (fresh !== undefined) fresh.props.onClick({})
  await Promise.resolve()
  await Promise.resolve()
  const opCall = fetches.slice(before).find((call) => call.url.endsWith('/op'))
  check('split issued a /op request', opCall !== undefined, `fetches: ${fetches.slice(before).map((c) => c.url).join(',')}`)
  if (opCall !== undefined) {
    const body = JSON.parse(opCall.init.body)
    check('op is a split with clipId and at', body.op?.type === 'split' && typeof body.op?.clipId === 'string' && Number.isFinite(body.op?.at),
      JSON.stringify(body.op))
  }
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
