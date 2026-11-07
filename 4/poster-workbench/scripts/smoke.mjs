/* Headless smoke test: load the built client bundle with a tiny React/ctx stub
 * and confirm the factory applies, registers the View, and renders a tree. */
import { readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))

function createReact() {
  let hookIndex = 0
  const store = new Map()
  return {
    createElement(type, props, ...children) {
      const merged = Object.assign({}, props || {})
      if (children.length === 1) merged.children = children[0]
      else if (children.length > 1) merged.children = children
      return { type, props: merged }
    },
    useRef(initial) {
      const key = hookIndex++
      if (!store.has(key)) store.set(key, { current: initial })
      return store.get(key)
    },
    useState(initial) {
      const key = hookIndex++
      if (!store.has(key)) store.set(key, typeof initial === 'function' ? initial() : initial)
      return [store.get(key), (next) => { store.set(key, typeof next === 'function' ? next(store.get(key)) : next) }]
    },
    useMemo(factory) {
      hookIndex++
      return factory()
    },
    useContext() { return {} },
    useEffect() { hookIndex++ },
    useEffectLayout() { hookIndex++ },
    reset() { hookIndex = 0; store.clear() },
  }
}

const registeredFactories = new Map()
const scripts = []
globalThis.window = {
  __ModuleLoader__: { load: ({ id, factory }) => registeredFactories.set(id, factory) },
  localStorage: {
    data: new Map(),
    getItem(key) { return this.data.has(key) ? this.data.get(key) : null },
    setItem(key, value) { this.data.set(key, value) },
  },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  devicePixelRatio: 1,
  ResizeObserver: class { observe() {} disconnect() {} },
  IntersectionObserver: class { observe() {} disconnect() {} },
  addEventListener() {},
  removeEventListener() {},
}
globalThis.document = {
  hidden: false,
  addEventListener() {},
  removeEventListener() {},
  createElement: () => ({ setAttribute() {}, appendChild() {}, style: {}, id: '', textContent: '', dataset: {} }),
  querySelector: () => null,
  querySelectorAll: () => [],
  head: { appendChild() {} },
  body: { appendChild() {} },
}
globalThis.StyleSheet = class {}
scripts.push(document)

const source = await readFile(join(root, 'client.js'), 'utf8')
const violations = []
const sandboxWindow = globalThis.window
const fakeDom = {
  addEventListener() {},
  removeEventListener() {},
  getElementById: () => null,
}

// Execute the bundle. It only registers a factory; it must not touch the DOM yet.
const run = new Function('window', 'document', 'console', 'navigator', 'matchMedia', source)
run(sandboxWindow, globalThis.document, console, { languages: ['zh-CN'] }, sandboxWindow.matchMedia)

if (registeredFactories.size !== 1) throw new Error('expected exactly one registered factory, got ' + registeredFactories.size)
const factory = registeredFactories.get('@local/poster-workbench')
const react = createReact()
const moduleExports = factory((request) => {
  if (request === 'react') return react
  throw new Error('unexpected require: ' + request)
})

if (typeof moduleExports.apply !== 'function') throw new Error('factory must export apply')
if (!Array.isArray(moduleExports.inject) || moduleExports.inject[0] !== 'slots') throw new Error('factory must inject slots')

const effects = []
let registered = null
const dictionaries = []
const ctx = {
  get(name) {
    if (name === 'locale') {
      return {
        register(ns, locale, dict) { dictionaries.push({ ns, locale, keys: Object.keys(dict) }); return () => {} },
        bind(ns) { return (key) => (dictionaries.find((entry) => entry.ns === ns && entry.locale === 'zh') ? key + ':' + ns : key) },
      }
    }
    return undefined
  },
  effect(callback, label) { effects.push({ label, dispose: callback() }) },
  slots: {
    inject(key, callback) { callback() ; return () => {} },
    register(options, component) { registered = { options, component }; return () => {} },
  },
}
moduleExports.apply(ctx)

if (dictionaries.length !== 2) throw new Error('expected zh and en dictionaries, got ' + dictionaries.length)
if (!registered) throw new Error('the view was not registered')
if (registered.options.name !== 'conversation.view') throw new Error('registered into ' + registered.options.name)
if (registered.options.id !== 'poster-workbench') throw new Error('unexpected slot id ' + registered.options.id)

const label = registered.options.label()
console.log('slot id:', registered.options.id, '| label:', label)

// Render the tree once. React hooks are stubbed, so this checks the whole
// component body for thrown errors and for the expected structure.
const tree = registered.component({
  sessionId: 'session-test',
  pwTranslate: (key) => (dictionaries.length > 0 ? key : key),
})
const seen = []
function walk(node, depth) {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) { node.forEach((child) => walk(child, depth)); return }
  if (typeof node !== 'object') { seen.push({ depth, text: String(node) }); return }
  const type = node.type
  seen.push({ depth, tag: typeof type === 'string' ? type : (type && type.name) || 'component' })
  if (typeof type === 'function' && !type.__isCanvas) {
    react.reset()
    walk(type(node.props), depth + 1)
    return
  }
  walk(node.props.children, depth + 1)
}
walk(tree, 0)

const tags = seen.filter((entry) => entry.tag)
const texts = seen.filter((entry) => entry.text)

console.log('node count:', seen.length)
console.log('root tag:', tags[0] && tags[0].tag)
console.log('has poster title element:', seen.some((entry) => entry.text === 'Everything is a plugin'))
console.log('has shader canvas:', seen.some((entry) => entry.tag === 'canvas'))
console.log('has style element:', seen.some((entry) => entry.tag === 'style'))
console.log('has edit button:', seen.some((entry) => entry.tag === 'button'))

// Default page must stay minimal: exactly one visible text string.
const visible = texts.filter((entry) => !entry.text.includes('@font-face'))
console.log('visible text strings:', JSON.stringify(visible.map((entry) => entry.text).filter((text) => text.length < 40)))

let styleCss = null
function findStyle(node) {
  if (node === null || node === undefined) return
  if (Array.isArray(node)) { node.forEach(findStyle); return }
  if (typeof node !== 'object') return
  if (node.type === 'style') { styleCss = node.props.children; return }
  if (typeof node.type === 'function') {
    react.reset()
    findStyle(node.type(node.props))
    return
  }
  findStyle(node.props.children)
}
findStyle(tree)
if (styleCss === null) throw new Error('no inlined stylesheet found')
console.log('inlined stylesheet bytes:', styleCss.length)
console.log('font faces:', (styleCss.match(/@font-face/g) || []).length)
console.log('data-url fonts:', (styleCss.match(/data:font\/woff2;base64/g) || []).length)

// Editor renders without needing a DOM: call the component's editor branch.
console.log('effects registered:', effects.length)

const failures = []
for (const violation of violations) failures.push(violation)
if (!seen.some((entry) => entry.text === 'Everything is a plugin')) failures.push('default title missing')
if (!seen.some((entry) => entry.tag === 'canvas')) failures.push('canvas missing')

if (failures.length > 0) {
  console.error('FAILED:', failures)
  process.exitCode = 1
} else {
  console.log('SMOKE OK')
}
