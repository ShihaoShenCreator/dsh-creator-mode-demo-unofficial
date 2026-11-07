/**
 * Smoke test: materialize the client bundle factory under a stub module loader
 * and assert that registration is wired without touching a real DOM.
 */
import assert from 'node:assert/strict'

globalThis.window = globalThis
let captured

globalThis.window.__ModuleLoader__ = {
  load(registration) {
    captured = registration
  },
}

const React = {
  createElement: (type, props, ...children) => ({ type, props, children }),
  useState: () => [undefined, () => {}],
  useEffect: () => {},
  useRef: () => ({ current: undefined }),
  useMemo: (fn) => fn(),
  Fragment: 'fragment',
}

const requireStub = (spec) => {
  if (spec === 'react') return React
  if (spec === 'react-dom') return { createPortal: (node) => node }
  throw new Error(`unexpected require(${JSON.stringify(spec)})`)
}

await import('../.dsh-created-plugins/paper-reader/client.js')

assert.ok(captured, 'bundle registered its factory')
assert.equal(captured.id, '@local/paper-reader')

const exported = captured.factory(requireStub)
assert.equal(typeof exported.apply, 'function')
assert.deepEqual([...exported.inject].sort(), ['locale', 'sidebarRightTabs', 'slots'])

const localeRegistrations = []
const slotRegistrations = []
const tabDefinitions = []
const effects = []

const ctx = {
  effect(fn, label) {
    const disposer = fn()
    effects.push({ label, disposer })
    return () => disposer?.()
  },
  locale: {
    register(...args) {
      localeRegistrations.push({ ns: args[0], rest: args.slice(1) })
      return () => {}
    },
    bind() {
      return (key) => key
    },
  },
  sidebarRightTabs: {
    register(definition) {
      tabDefinitions.push(definition)
      return () => {}
    },
  },
  slots: {
    inject(key, callback) {
      const disposer = callback()
      return () => disposer?.()
    },
    register(options, component) {
      slotRegistrations.push({ options, component })
      return () => {}
    },
  },
}

exported.apply(ctx)

// Dictionaries cover zh + en fully, and every other built-in locale at least
// carries the prompt templates so "ask in chat" follows the interface language.
const full = localeRegistrations.filter((entry) => entry.rest.length === 1)
const partial = localeRegistrations.filter((entry) => entry.rest.length === 2)
assert.equal(full.length, 1, 'one bilingual dictionary set')
assert.deepEqual(Object.keys(full[0].rest[0]).sort(), ['en', 'zh'])
const zh = full[0].rest[0].zh
const en = full[0].rest[0].en
assert.deepEqual(Object.keys(zh).sort(), Object.keys(en).sort(), 'zh/en key parity')
for (const key of ['ask.template', 'ask.templateNoTitle']) {
  assert.equal(typeof zh[key], 'string')
  assert.equal(typeof en[key], 'string')
}
for (const key of Object.keys(zh)) {
  for (const locale of partial) {
    if (locale.rest[1][key] === undefined) continue
    assert.equal(typeof locale.rest[1][key], 'string')
  }
}
const partialLocales = partial.map((entry) => entry.rest[0]).sort()
assert.deepEqual(partialLocales, ['de', 'es', 'fr', 'ja', 'pt', 'ru'])
assert.ok(
  partial.every((entry) => typeof entry.rest[1]['ask.template'] === 'string' && typeof entry.rest[1]['ask.templateNoTitle'] === 'string'),
  'every extra locale carries both prompt templates',
)

const [definition] = tabDefinitions
assert.equal(definition.kind, 'paper-reader')
assert.equal(definition.id, '@local/paper-reader')
assert.equal(definition.priority, 'extension')
assert.equal(definition.keepMounted, true)
assert.equal(definition.guide.length, 1)
assert.equal(definition.guide[0].id, 'reader')
assert.equal(typeof definition.guide[0].title, 'function')
assert.equal(typeof definition.guide[0].description, 'function')
assert.equal(typeof definition.guide[0].icon, 'function')

const body = slotRegistrations.find((entry) => entry.options.name === 'sidebar.right.pane.tab')
const title = slotRegistrations.find((entry) => entry.options.name === 'sidebar.right.pane.tab.title')
assert.ok(body, 'body registered into sidebar.right.pane.tab')
assert.ok(title, 'title registered into sidebar.right.pane.tab.title')
assert.equal(body.options.key, '@local/paper-reader', 'body key is the tab type id')
assert.equal(title.options.key, '@local/paper-reader', 'title key is the tab type id')
assert.equal(body.options.locale, 'paperReader')
assert.equal(typeof body.component, 'function')
assert.equal(typeof title.component, 'function')

// Plugin unload path: every effect disposer must run without throwing.
for (const effect of effects) effect.disposer?.()

console.log('client bundle smoke test: PASS', {
  effects: effects.length,
  locales: localeRegistrations.length,
  slots: slotRegistrations.map((entry) => entry.options.name),
})
