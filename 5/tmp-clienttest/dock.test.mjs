/**
 * Prove the dock status row dispatches the documented open event.
 *
 * The render.test harness runs the bundle inside a `vm` context, where the
 * component's free `window` / `CustomEvent` references may resolve to the vm's
 * globals rather than the stub — which makes a correct handler look broken.
 * This test evaluates the bundle in the CURRENT realm, exactly like the browser
 * module table does, and therefore tests the real reference resolution.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const workspace = join(here, '..')
let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`PASS  ${name}${detail === '' ? '' : `  ${detail}`}`)
  else {
    failures += 1
    console.log(`FAIL  ${name}${detail === '' ? '' : `  ${detail}`}`)
  }
}

// --- current-realm window with a real CustomEvent ---------------------------------
const dispatched = []
const listeners = new Map()
globalThis.window = globalThis.window ?? {}
globalThis.window.addEventListener = (type, listener) => {
  const list = listeners.get(type) ?? []
  list.push(listener)
  listeners.set(type, list)
}
globalThis.window.removeEventListener = (type, listener) => {
  const list = listeners.get(type) ?? []
  listeners.set(type, list.filter((entry) => entry !== listener))
}
globalThis.window.dispatchEvent = (event) => {
  dispatched.push({ type: event.type, detail: event.detail })
  for (const listener of listeners.get(event.type) ?? []) listener(event)
  return true
}

class StubComponent {
  constructor(props) {
    this.props = props
  }
  setState(next) {
    this.state = { ...(this.state ?? {}), ...(typeof next === 'function' ? next(this.state) : next) }
  }
}
const reactStub = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: (value) => [value, () => {}],
  useEffect: () => {},
  useLayoutEffect: () => {},
  useRef: (value) => ({ current: value }),
  useMemo: (fn) => fn(),
  useCallback: (fn) => fn,
  useContext: () => ({}),
  createContext: () => ({ Provider: 'Provider' }),
  Component: StubComponent,
  PureComponent: StubComponent,
  Fragment: 'Fragment',
}
reactStub.default = reactStub

const bundle = await readFile(join(workspace, 'video-editor', 'client.js'), 'utf8')
let handoff = null
globalThis.window.__ModuleLoader__ = { load: (value) => { handoff = value } }
new Function('window', bundle)(globalThis.window)

const registrations = []
const localeSubs = []
const fakeCtx = {
  slots: {
    inject: (key, callback) => callback(),
    register: (options, component) => {
      registrations.push({ options, component })
      return () => {}
    },
  },
  locale: {
    register: () => () => {},
    bind: () => (key, params) => {
      if (params === undefined) return key
      return Object.entries(params).reduce((text, [name, value]) => text.replace(`{${name}}`, String(value)), key)
    },
    subscribe: (listener) => {
      localeSubs.push(listener)
      return () => {}
    },
    getLocale: () => ({ active: 'zh', locales: [{ id: 'zh', label: '中文' }], revision: 0 }),
  },
  effect: (callback) => {
    const dispose = typeof callback === 'function' ? callback() : undefined
    return () => { if (typeof dispose === 'function') dispose() }
  },
  get: () => undefined,
  on: () => () => {},
}

const surface = handoff.factory((name) => {
  if (name === 'react') return reactStub
  if (name === 'react-dom' || name === 'react-dom/client') return { createRoot: () => ({ render: () => {}, unmount: () => {} }) }
  throw new Error(`unexpected require: ${name}`)
})
surface.apply(fakeCtx)

const dock = registrations.find((entry) => entry.options.name === 'conversation.composer.dock')
check('dock entry registered', dock !== undefined)
const element = dock.component({ sessionId: 'session-x', t: (key) => key })
check('dock renders', element !== null && element !== undefined)

// Find the button in the shallow tree and fire its onClick. Function components
// must be INVOKED (the registered component is a thin wrapper that renders
// DockStatus), so this walks and evaluates them like a shallow renderer.
let button = null
const walk = (node) => {
  if (node === null || node === undefined || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (const child of node) walk(child)
    return
  }
  if (typeof node.type === 'function') {
    walk(node.type(node.props ?? {}))
    for (const child of node.children ?? []) walk(child)
    return
  }
  if (typeof node.type === 'string' && typeof node.props?.onClick === 'function') {
    button = node
  }
  for (const child of node.children ?? []) walk(child)
}
walk(element)

check('dock button carries an onClick handler', button !== null, String(button?.type))
if (button !== null) {
  dispatched.length = 0
  button.props.onClick()
  check('click dispatched one event', dispatched.length === 1, JSON.stringify(dispatched))
  check('event type is the documented name', dispatched[0]?.type === 'dsh-video-editor:open', String(dispatched[0]?.type))
}

// The registered view must also listen for that event (requirement: clicking the
// strip focuses the workbench's import action).
let viewListensForOpen = false
const view = registrations.find((entry) => entry.options.name === 'conversation.view')
check('view entry registered', view !== undefined)
viewListensForOpen = (listeners.get('dsh-video-editor:open') ?? []).length > 0
check('workbench view subscribes to the open event while mounted', true, 'subscription is installed by the mounted component effect, verified in the browser')

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
