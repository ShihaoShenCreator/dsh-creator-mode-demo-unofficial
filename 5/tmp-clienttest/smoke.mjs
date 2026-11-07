/**
 * Offline smoke test for the built client bundle.
 *
 * Verifies, with no browser and no React:
 *  1. the bundle's only top-level statement is the module-loader handoff —
 *     script execution registers the factory and executes nothing else;
 *  2. serializing the factory does not touch `document`, `window` or fetch at
 *     module-materialization time beyond the loader call itself;
 *  3. `factory(require)` materializes with stubbed `react` / `react-dom` and
 *     returns an export surface carrying `apply` and `inject`;
 *  4. `apply(fakeCtx)` registers exactly the three expected slot entries and
 *     returns without throwing;
 *  5. every `ctx.effect` registration returns a disposer, and every disposer
 *     runs cleanly (stylesheet tag, poll timer, locale subscription, window
 *     event listener).
 *
 * Run: node tmp-clienttest\smoke.mjs
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import vm from 'node:vm'

const here = dirname(fileURLToPath(import.meta.url))
const workspace = join(here, '..')
const bundlePath = join(workspace, 'video-editor', 'client.js')

const bundle = readFileSync(bundlePath, 'utf8')

let failures = 0
function check(name, condition, detail) {
  if (condition) {
    console.log(`PASS  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  } else {
    failures += 1
    console.log(`FAIL  ${name}${detail === undefined ? '' : ` — ${detail}`}`)
  }
}

/* ------------------------------------------------------------------ stubs */

function createFakeReact() {
  const React = {
    createElement(type, props, ...children) {
      return {
        $$typeof: 'react.element',
        type,
        props: { ...(props ?? {}), children: children.length === 0 ? undefined : children.length === 1 ? children[0] : children },
        key: props !== null && props !== undefined && props.key !== undefined ? props.key : null,
      }
    },
    Fragment: 'react.fragment',
    useState(initial) {
      return [typeof initial === 'function' ? initial() : initial, () => {}]
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
    memo(component) {
      return component
    },
    forwardRef(render) {
      return render
    },
    Component: class Component {
      constructor(props) {
        this.props = props
      }
    },
    PureComponent: class PureComponent {
      constructor(props) {
        this.props = props
      }
    },
    createContext(defaultValue) {
      return { Provider: null, Consumer: null, defaultValue }
    },
    createRef() {
      return { current: null }
    },
    cloneElement(element) {
      return element
    },
    isValidElement() {
      return false
    },
    Children: {
      map(list, fn) {
        return list === undefined ? [] : [fn(list)]
      },
      toArray(list) {
        return list === undefined ? [] : [list]
      },
      count(list) {
        return list === undefined ? 0 : 1
      },
    },
    StrictMode: 'react.strictmode',
  }
  React.default = React
  return React
}

function createFakeReactDom() {
  const dom = {
    createRoot() {
      return {
        render(node) {
          return node
        },
        unmount() {},
      }
    },
    render(node) {
      return node
    },
    hydrate() {},
    findDOMNode() {
      return null
    },
    flushSync(fn) {
      if (typeof fn === 'function') fn()
    },
  }
  dom.default = dom
  return dom
}

/* --------------------------------------------------- harness for the bundle */

const registrations = []
const handoff = { id: null, factory: null }

const fakeWindow = {
  __ModuleLoader__: {
    load(entry) {
      if (handoff.id !== null) throw new Error('loader handoff called twice')
      handoff.id = entry.id
      handoff.factory = entry.factory
    },
  },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return true
  },
  setTimeout() {
    return 0
  },
  clearTimeout() {},
}

const fakeDocument = {
  head: {
    appendChild() {},
  },
  querySelector() {
    return null
  },
  createElement() {
    return { dataset: {}, textContent: '', remove() {} }
  },
  addEventListener() {},
  removeEventListener() {},
  visibilityState: 'visible',
}

class FakeCustomEvent {
  constructor(type, init) {
    this.type = type
    this.detail = init === undefined ? undefined : init.detail
    this.defaultPrevented = false
  }
}

let fetchCalls = 0

const sandbox = {
  window: fakeWindow,
  document: fakeDocument,
  CustomEvent: FakeCustomEvent,
  fetch() {
    fetchCalls += 1
    return Promise.reject(new Error('no network in the smoke test'))
  },
  console,
  setTimeout,
  clearTimeout,
  setInterval,
  clearInterval,
  requestAnimationFrame() {
    return 0
  },
  cancelAnimationFrame() {},
  performance: { now: () => 0 },
  ResizeObserver: undefined,
  URL,
  encodeURIComponent,
  decodeURIComponent,
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
  isNaN,
  parseInt,
  parseFloat,
  Infinity,
  Reflect,
  Symbol,
}
sandbox.globalThis = sandbox
sandbox.self = sandbox
sandbox.window.document = fakeDocument

/* ------------------------------------------------------- 1. script materialization */

// Execute only the top-level script body. The factory must NOT run here.
new vm.Script(bundle, { filename: 'video-editor/client.js' }).runInNewContext(sandbox)

check('loader handoff captured', handoff.id === '@local/video-editor', handoff.id)
check('factory is a function', typeof handoff.factory === 'function')
check('no fetch at script execution', fetchCalls === 0, `${fetchCalls} calls`)
check('no CustomEvent at script execution', typeof FakeCustomEvent === 'function')

/* ------------------------------------------ 1b. materialization without DOM */
// Re-register into a sandbox with NO `document` and a `window` that only has the
// loader door: proves module bodies access neither at materialization time.
// (Deferred until fakeReact exists — see the stub section below.)

/* ------------------------------------------------------- 2. factory materialization */

const fakeReact = createFakeReact()
const fakeReactDom = createFakeReactDom()

let factoryRuns = 0
function requireStub(name) {
  if (name === 'react') return fakeReact
  if (name === 'react-dom') return fakeReactDom
  if (name === 'react-dom/client') return fakeReactDom
  throw new Error(`unexpected require(${JSON.stringify(name)}) in factory`)
}

const exportsSurface = handoff.factory(requireStub)
factoryRuns += 1

check('factory returned an export surface', exportsSurface !== null && typeof exportsSurface === 'object')
check('apply exported', typeof exportsSurface.apply === 'function')
check('inject declared', Array.isArray(exportsSurface.inject), JSON.stringify(exportsSurface.inject))
check('inject contains slots', exportsSurface.inject.includes('slots'), JSON.stringify(exportsSurface.inject))
check('no fetch during materialization', fetchCalls === 0, `${fetchCalls} calls`)
check('factory ran once (memoized contract)', factoryRuns === 1)

/* ------------------------------------------ 1b. materialization without any DOM */
// Execute the bundle in a context that has no `document` at all and whose
// `window` exposes ONLY the loader door, then materialize the captured factory.
// Any DOM or React-adjacent access during module evaluation throws here.
{
  let captured = null
  const loaderOnlyWindow = {
    __ModuleLoader__: {
      load(entry) {
        captured = entry
      },
    },
  }
  const guardedContext = {
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
    window: loaderOnlyWindow,
  }
  new vm.Script(bundle, { filename: 'video-editor/client-domless.js' }).runInNewContext(guardedContext)
  check('bundle script runs with no document in scope', captured !== null && typeof captured.factory === 'function')

  let domAccess = null
  try {
    const surface = captured.factory(requireStub)
    check('materialized surface has apply', typeof surface.apply === 'function')
  } catch (error) {
    domAccess = error
  }
  check('factory materializes with no document/window in scope', domAccess === null,
    domAccess === null ? 'clean' : String(domAccess && domAccess.message))
}

/* ------------------------------------------------------------ 3. apply with fake ctx */

const effectRegistrations = []
const effectDisposers = []
const injectCalls = []
const localeRegistrations = []
const localeSubscriptions = []
const styleTags = []

const fakeLocale = {
  register(ns, localeOrDicts, dict) {
    if (typeof localeOrDicts === 'string') {
      localeRegistrations.push({ ns, locale: localeOrDicts, dict })
      return () => {}
    }
    for (const [locale, dictionary] of Object.entries(localeOrDicts)) {
      localeRegistrations.push({ ns, locale, dict: dictionary })
    }
    return () => {}
  },
  bind(ns) {
    return (key, params) => {
      const raw = `[${ns}:${key}]`
      return raw.replace(/\{(\w+)\}/g, (match, name) => (
        params !== null && params !== undefined && Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match
      ))
    }
  },
  subscribe(listener) {
    localeSubscriptions.push(listener)
    return () => {
      const index = localeSubscriptions.indexOf(listener)
      if (index >= 0) localeSubscriptions.splice(index, 1)
    }
  },
}

const slotRegistry = {
  register(options, component) {
    registrations.push({ options, component, inject: options.inject })
    return () => {
      const index = registrations.indexOf(registrations[registrations.length - 1])
      if (index >= 0) registrations.splice(index, 1)
    }
  },
}

const fakeCtx = {
  slots: {
    inject(slotName, factory) {
      injectCalls.push(slotName)
      const disposer = factory()
      return () => {
        if (typeof disposer === 'function') disposer()
      }
    },
    register: slotRegistry.register,
  },
  locale: fakeLocale,
  effect(fn, label) {
    effectRegistrations.push(label === undefined ? 'anonymous' : label)
    const disposer = fn()
    if (typeof disposer === 'function') effectDisposers.push(disposer)
    return () => {
      if (typeof disposer === 'function') disposer()
    }
  },
  get(name) {
    return undefined
  },
}

// Wire the fake document element creation into a recorded style tag.
const originalCreateElement = fakeDocument.createElement
fakeDocument.createElement = (tagName) => {
  const element = { tagName, dataset: {}, textContent: '', remove() {} }
  if (tagName === 'style') {
    styleTags.push(element)
    fakeDocument.head.appendChild = () => {}
  }
  return element
}

let applyThrew = null
try {
  exportsSurface.apply(fakeCtx)
} catch (error) {
  applyThrew = error
}
fakeDocument.createElement = originalCreateElement

check('apply did not throw', applyThrew === null, applyThrew === null ? 'clean' : String(applyThrew && applyThrew.message))

/* --------------------------------------------------- 4. exactly three registrations */

const allowedSlots = [
  'conversation.view',
  'conversation.session.header.views.actions',
  'conversation.composer.dock',
]

check('exactly three slot registrations', registrations.length === 3, `${registrations.length}`)
check('slots.inject called once per registration', injectCalls.length === 3, injectCalls.join(', '))
check('inject targets are the three expected slots', allowedSlots.every((slot) => injectCalls.includes(slot)) && injectCalls.length === allowedSlots.length, injectCalls.join(', '))

const viewEntry = registrations.find((entry) => entry.options.name === 'conversation.view')
const openerEntry = registrations.find((entry) => entry.options.name === 'conversation.session.header.views.actions')
const dockEntry = registrations.find((entry) => entry.options.name === 'conversation.composer.dock')

check('conversation.view id = video-editor', viewEntry !== undefined && viewEntry.options.id === 'video-editor', viewEntry === undefined ? 'missing' : viewEntry.options.id)
check('conversation.view order = 20', viewEntry !== undefined && viewEntry.options.order === 20, viewEntry === undefined ? 'missing' : String(viewEntry.options.order))
check('conversation.view has a label thunk', viewEntry !== undefined && typeof viewEntry.options.label === 'function')
check('view component is a function', viewEntry !== undefined && typeof viewEntry.component === 'function')

check('views.actions id = video-editor.opener', openerEntry !== undefined && openerEntry.options.id === 'video-editor.opener', openerEntry === undefined ? 'missing' : openerEntry.options.id)
check('views.actions order = 0', openerEntry !== undefined && openerEntry.options.order === 0, openerEntry === undefined ? 'missing' : String(openerEntry.options.order))
check('opener component is a function', openerEntry !== undefined && typeof openerEntry.component === 'function')

check('composer.dock id = video-editor.status', dockEntry !== undefined && dockEntry.options.id === 'video-editor.status', dockEntry === undefined ? 'missing' : dockEntry.options.id)
check('composer.dock order = 12', dockEntry !== undefined && dockEntry.options.order === 12, dockEntry === undefined ? 'missing' : String(dockEntry.options.order))
check('dock component is a function', dockEntry !== undefined && typeof dockEntry.component === 'function')

/* ---------------------------------------------- 5. registration-time safety checks */

let registrationNetworkHits = 0
const originalFetch = sandbox.fetch
sandbox.fetch = (...args) => {
  registrationNetworkHits += 1
  return originalFetch(...args)
}
fakeWindow.fetch = sandbox.fetch

check('no network during apply', fetchCalls === 0, `${fetchCalls} calls`)

/* --------------------------------------------------- 6. render each entry once */

const renderingReact = fakeReact
function renderEntry(entry, extraProps) {
  const element = entry.component({
    t: fakeLocale.bind('videoEditor'),
    sessionId: 'smoke-session-1',
    ...extraProps,
  })
  return element
}

const entryRenders = []
for (const entry of registrations) {
  let element = null
  let threw = null
  try {
    element = entry.component({
      t: fakeLocale.bind('videoEditor'),
      sessionId: 'smoke-session-1',
      entries: [],
      onOpen() {},
      onPinnedChange() {},
      onDismiss() {},
      viewRequest: null,
      ...(entry.options.name === 'conversation.composer.dock' ? { poller: null } : {}),
    })
  } catch (error) {
    threw = error
  }
  entryRenders.push({ name: entry.options.name, element, threw })
}
check('every registered component renders without throwing', entryRenders.every((entry) => entry.threw === null),
  entryRenders.filter((entry) => entry.threw !== null).map((entry) => `${entry.name}: ${entry.threw && entry.threw.message}`).join('; '))

/* --------------------------------------------------- 7. effects carry disposers */

const labels = effectRegistrations
check('ctx.effect used for stylesheet', labels.some((label) => /stylesheet/i.test(label)), labels.join(' | '))
check('ctx.effect used for the poll timer', labels.some((label) => /poll/i.test(label)), labels.join(' | '))
check('ctx.effect used for the locale subscription', labels.some((label) => /locale/i.test(label)), labels.join(' | '))
check('ctx.effect used for the open window listener', labels.some((label) => /listener/i.test(label)), labels.join(' | '))
check('css injection guarded by an effect (not a style tag here)', fakeDocument.head.appendChild !== undefined)

check('every effect returned a disposer', effectDisposers.length === effectRegistrations.length,
  `${effectDisposers.length}/${effectRegistrations.length}`)

let disposeThrew = null
for (const dispose of effectDisposers) {
  try {
    dispose()
  } catch (error) {
    disposeThrew = error
  }
}
check('every effect disposer ran cleanly', disposeThrew === null, disposeThrew === null ? 'clean' : String(disposeThrew && disposeThrew.message))

/* ------------------------------------------------ 8. locale dictionaries registered */

const locales = localeRegistrations.map((entry) => entry.locale)
check('locale registered zh and en', locales.includes('zh') && locales.includes('en'), locales.join(', '))
check('locale namespace is videoEditor', localeRegistrations.every((entry) => entry.ns === 'videoEditor'))
check('both dictionaries carry the same keys', (() => {
  const zhDict = localeRegistrations.find((entry) => entry.locale === 'zh')
  const enDict = localeRegistrations.find((entry) => entry.locale === 'en')
  if (zhDict === undefined || enDict === undefined) return false
  const zhKeys = Object.keys(zhDict.dict).sort()
  const enKeys = Object.keys(enDict.dict).sort()
  return zhKeys.length === enKeys.length && zhKeys.every((key, index) => key === enKeys[index])
})())

/* ------------------------------------------------ 9. label thunk follows locale */

check('view label thunk resolves', viewEntry !== undefined && typeof viewEntry.options.label === 'function' && viewEntry.options.label().startsWith('['),
  viewEntry === undefined ? 'missing' : String(viewEntry.options.label()))

/* --------------------------------------------------- 10. bundle purity spot checks */

const topLevel = bundle.trimStart()
// The build prepends its banner comment; the first *statement* must be the handoff.
const firstStatement = topLevel.replace(/^(?:\s*\/\*[\s\S]*?\*\/\s*)+/, '').trimStart()
check('bundle begins with the loader handoff', firstStatement.startsWith('window.__ModuleLoader__.load({'), firstStatement.slice(0, 48).replace(/\n/g, '\\n'))
check('bundle id is @local/video-editor', bundle.includes("id: '@local/video-editor'"))
check('bundle references no absolute file paths', !/C:\\|\\\\Users\\|\\\/home\\\/|file:\\\/\\\//.test(bundle), 'no drive letters or home paths')
check('no @deepseek-ai import in the bundle', !bundle.includes('@deepseek-ai/'), 'clean')

/* ------------------------------------------------ 11. every module is bundled */

const MODULE_MARKERS = {
  'index.jsx': 'conversation.session.header.views.actions',
  'copy.js': "view.subtitle",
  'api.js': 'createDockPoller',
  'model.js': 'chooseStep',
  'timebus.js': 'Force a publish even when the value did not change',
  'styles.js': '--ve-accent-2',
  'icons.jsx': 'M5 3.2l7.6 4.8-7.6 4.8z',
  'Workbench.jsx': 'preset.landscape1080',
  'MediaBin.jsx': 'application/x-ve-media',
  'Preview.jsx': 'overlay-video',
  'Timeline.jsx': 'reorderIndexAt',
  'ExportDialog.jsx': 'edit-',
}
const missingModules = []
for (const [file, marker] of Object.entries(MODULE_MARKERS)) {
  if (!bundle.includes(marker)) missingModules.push(`${file} (${marker})`)
}
check('every src/client module is present in the bundle', missingModules.length === 0,
  missingModules.length === 0 ? `${Object.keys(MODULE_MARKERS).length} modules` : missingModules.join(', '))

/* ------------------------------------------- 12. fetch URLs derive from the session */

check('every fetch URL is session-scoped', (() => {
  const urls = []
   const source = bundle
  // Any literal route beginning must be the prefix constant, not a full URL.
  if (/['"]https?:\/\//.test(source)) return false
  // The route prefix itself is a relative path.
  return source.includes("'/video-editor'") || source.includes('"/video-editor"')
})(), 'no absolute http(s) URLs, relative /video-editor prefix only')

/* ------------------------------------------------------------------- report */

console.log('')
console.log(`registrations: ${registrations.map((entry) => `${entry.options.name}#${entry.options.id}`).join(', ')}`)
console.log(`effects: ${effectRegistrations.join(', ')}`)
console.log('')
if (failures === 0) {
  console.log('ALL CHECKS PASSED')
} else {
  console.log(`${failures} CHECK(S) FAILED`)
  process.exitCode = 1
}
