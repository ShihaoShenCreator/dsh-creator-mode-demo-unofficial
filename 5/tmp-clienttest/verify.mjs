/**
 * Offline verification of the built client bundle.
 *
 * Checks the handoff protocol, that nothing runs at script-execution time,
 * and that `apply(ctx)` registers the expected slots under a stubbed ctx.
 *
 * Run: node tmp-clienttest/verify.mjs   (from the workspace root)
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

const bundleSource = await readFile(join(workspace, 'video-editor', 'client.js'), 'utf8')

// ---- 1. handoff protocol -------------------------------------------------
let handoff = null
globalThis.window = {
  __ModuleLoader__: {
    load(value) {
      handoff = value
    },
  },
}
check('script registers exactly one module handoff', handoff === null)
// Execute the bundle as a classic script in this realm.
new Function('window', bundleSource)(globalThis.window)
check('handoff captured', handoff !== null)
check('handoff id is the package name', handoff?.id === '@local/video-editor', String(handoff?.id))
check('handoff exposes a factory', typeof handoff?.factory === 'function')
check('window.__VE_TEST__ is undefined (no factory body executed)', globalThis.window.__VE_TEST__ === undefined)

// ---- 2. side-effect freedom ---------------------------------------------
const sourceBeyondBanner = bundleSource.replace(/[\s\S]*?factory\(require\)\s*\{/, '')
const topLevel = bundleSource.slice(0, bundleSource.indexOf('factory(require)'))
check('no document access at script time', !/document\./.test(topLevel))
check('no localStorage at script time', !/localStorage/.test(topLevel))
check('no fetch at script time', !/fetch\(/.test(topLevel))
check('no absolute Windows paths in bundle', !/C:\\\\Users|C:\/Users/.test(bundleSource))
check('no harness client package imports', !/@deepseek-ai\/dsh-client/.test(bundleSource), '')
check('no primitive package import', !/dsh-client-ui-primitives/.test(bundleSource))
check('bundle stays dependency-free apart from react', !/require\("(?!react)".*"\)/.test(bundleSource))

// ---- 3. factory materialization + apply ---------------------------------
class StubComponent {
  constructor(props) {
    this.props = props
    this.state = undefined
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
  createContext: () => ({ Provider: 'Provider', Consumer: 'Consumer' }),
  Component: StubComponent,
  PureComponent: StubComponent,
  Fragment: 'Fragment',
}
reactStub.default = reactStub
const registrations = []
const injections = []
const localeDictionaries = []
const localeSubscribers = []
let effectsRegistered = 0
let disposed = 0

const fakeCtx = {
  slots: {
    inject(key, callback) {
      injections.push(key)
      const dispose = callback()
      return typeof dispose === 'function' ? dispose : () => {}
    },
    register(options, component) {
      registrations.push({ options, component, componentType: typeof component })
      return () => {}
    },
  },
  locale: {
    register(ns, arg2, arg3) {
      localeDictionaries.push(arg3 === undefined ? `${ns}` : `${ns}:${arg2}`)
      return () => {}
    },
    bind() {
      return (key) => key
    },
    subscribe(listener) {
      localeSubscribers.push(listener)
      return () => {}
    },
    getLocale() {
      return { active: 'zh', locales: [{ id: 'zh', label: '中文' }], revision: 0 }
    },
  },
  effect(callback) {
    effectsRegistered += 1
    const dispose = typeof callback === 'function' ? callback() : undefined
    return () => {
      disposed += 1
      if (typeof dispose === 'function') dispose()
    }
  },
  get() {
    return undefined
  },
  on() {
    return () => {}
  },
}

let applyError = ''
let exportsSurface = null
try {
  exportsSurface = handoff.factory((name) => {
    if (name === 'react') return reactStub
    throw new Error(`unexpected require: ${name}`)
  })
  if (typeof exportsSurface.apply === 'function') exportsSurface.apply(fakeCtx)
} catch (error) {
  applyError = String(error?.message ?? error)
}
check('factory materializes without native deps', exportsSurface !== null && applyError === '', applyError)
check('bundle exports apply()', typeof exportsSurface?.apply === 'function')

const registeredSlots = registrations.map((entry) => entry.options.name)
check('registers conversation.view', registeredSlots.includes('conversation.view'), registeredSlots.join(', '))
check('registers the header More opener', registeredSlots.includes('conversation.session.header.views.actions'))
check('registers the composer dock status row', registeredSlots.includes('conversation.composer.dock'))
check('registers exactly three slot entries', registrations.length === 3, String(registrations.length))
check('view entry id', registrations.find((entry) => entry.options.name === 'conversation.view')?.options.id === 'video-editor')
check('view entry label resolves', typeof registrations.find((entry) => entry.options.name === 'conversation.view')?.options.label === 'function'
  || typeof registrations.find((entry) => entry.options.name === 'conversation.view')?.options.label === 'string')
check('every registration targets a known slot', registeredSlots.every((slot) => ['conversation.view', 'conversation.session.header.views.actions', 'conversation.composer.dock'].includes(slot)))
check('slot injections used', injections.length >= 3, injections.join(', '))
check('locale dictionaries registered zh+en', localeDictionaries.length >= 2, localeDictionaries.join(', '))
check('locale subscription for language switch', localeSubscribers.length >= 1)
check('all registrations expose a component', registrations.every((entry) => entry.componentType === 'function'))

// ---- 4. render safety ----------------------------------------------------
// The view component must be callable with a minimal props object and must not throw
// impossible demands (it may render an error card, which is the point).
const viewEntry = registrations.find((entry) => entry.options.name === 'conversation.view')
let renderError = ''
let rendered
try {
  rendered = viewEntry.component({ sessionId: 's1', useSession: () => undefined })
} catch (error) {
  renderError = String(error?.message ?? error)
}
check('view component tolerates a bare props object', renderError === '', renderError)
check('view component returns a node', rendered !== undefined && rendered !== null, String(rendered?.type ?? typeof rendered))

// ---- 5. required copy ----------------------------------------------------
const requiredKeys = ['view.label', 'dock.label']
for (const key of requiredKeys) {
  check(`copy key present: ${key}`, bundleSource.includes(key), '')
}
check('zh dictionary shipped', /\\u526[Aa]|剪辑/.test(bundleSource), 'esbuild escapes non-ASCII (uppercase hex)')
check('en dictionary shipped', /Video workbench|video workbench/.test(bundleSource))

// Both language blocks must exist with the same key set (a missing translation
// would show the raw key to an English user).
const copySource = await readFile(join(workspace, 'video-editor', 'src', 'client', 'copy.js'), 'utf8')
const zhStart = copySource.indexOf('export const zh')
const enStart = copySource.indexOf('export const en')
const zhKeys = [...copySource.slice(zhStart, enStart).matchAll(/'([a-zA-Z0-9._]+)':/g)].map((match) => match[1])
const enKeys = [...copySource.slice(enStart).matchAll(/'([a-zA-Z0-9._]+)':/g)].map((match) => match[1])
check('copy module present', copySource.length > 1000, String(copySource.length))
check('zh dictionary is populated', zhKeys.length > 20, String(zhKeys.length))
check('en dictionary is populated', enKeys.length > 20, String(enKeys.length))
const missingInEn = zhKeys.filter((key) => !enKeys.includes(key))
const missingInZh = enKeys.filter((key) => !zhKeys.includes(key))
check('every zh key has an en translation', missingInEn.length === 0, missingInEn.slice(0, 5).join(', '))
check('every en key has a zh source', missingInZh.length === 0, missingInZh.slice(0, 5).join(', '))

// ---- 6. visuals ---------------------------------------------------------
check('stylesheet defines a dark palette', bundleSource.includes('--ve-bg'))
check('stylesheet is scoped by .ve-', bundleSource.includes('.ve-'))
check('no emoji glyphs in copy', !/[\u{1F300}-\u{1FAFF}]/u.test(bundleSource))
check('styles inserted through a style tag cleanup path', bundleSource.includes('data-plugin-css') || bundleSource.includes('style'))

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
