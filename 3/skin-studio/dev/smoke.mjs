// Smoke test the client module without a browser: boots the factory against a
// stub module loader and a stub Cordis context, then drives the page's real
// click handlers and checks the token layer each skin stacks.
import fs from 'node:fs';
import vm from 'node:vm';

const file = new URL('../client.js', import.meta.url);

let loaded = null;
const React = {
  createElement(type, props, ...children) {
    const merged = { ...(props ?? {}) };
    if (children.length === 1) merged.children = children[0];
    else if (children.length > 1) merged.children = children;
    return { type, props: merged };
  },
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
};
const requireStub = (name) => {
  if (name === 'react') return React;
  if (name === 'react/jsx-runtime') return React;
  throw new Error(`unexpected require: ${name}`);
};

const sandbox = { window: { __ModuleLoader__: { load(entry) { loaded = entry; } } }, console };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: 'client.js' });
if (loaded === null) throw new Error('the client module never called __ModuleLoader__.load');
const plugin = loaded.factory(requireStub);
if (typeof plugin.apply !== 'function') throw new Error('factory did not return an apply function');

const registrations = [];
const effects = [];
let layer = null;
let themeSnapshot = { preference: 'system', active: { colorScheme: 'light', tokens: {} }, themes: [], revision: 1 };
const zhKeys = new Set();
const enKeys = new Set();

const ctx = {
  effect(callback, label) {
    effects.push({ label, dispose: callback() });
    return () => {};
  },
  on(name, listener) {
    if (name === 'theme/change') ctx.__themeListener = listener;
    return () => {};
  },
  get() {
    return undefined;
  },
  locale: {
    register(ns, dicts) {
      if (dicts.zh !== undefined) for (const key of Object.keys(dicts.zh)) zhKeys.add(key);
      if (dicts.en !== undefined) for (const key of Object.keys(dicts.en)) enKeys.add(key);
      return () => {};
    },
    bind() {
      return (key) => {
        if (!zhKeys.has(key)) throw new Error(`missing dictionary key: ${key}`);
        return key;
      };
    },
  },
  theme: {
    getTheme() {
      return themeSnapshot;
    },
    overrideTokens(source, tokens) {
      if (tokens === undefined || tokens === null) throw new TypeError('overrideTokens needs tokens');
      layer = { source, tokens };
      return () => {
        layer = null;
      };
    },
  },
  slots: {
    inject(key, callback) {
      callback();
      return () => {};
    },
    register(options, component) {
      registrations.push({ options, component });
      return () => {};
    },
  },
};

plugin.apply(ctx);

const sidebar = registrations.find((r) => r.options.name === 'sidebar.panellist');
const main = registrations.find((r) => r.options.name === 'main');
if (sidebar === undefined) throw new Error('no sidebar.panellist registration');
if (main === undefined) throw new Error('no main registration');
if (sidebar.options.id !== main.options.key) throw new Error('sidebar id does not address the main panel key');
if (main.options.locale !== 'skinStudio') throw new Error('page is not bound to the plugin dictionary');

// The default skin stacks no layer and is the state the page starts from.
if (layer !== null) throw new Error('the default skin should not stack a token layer');
if (themeSnapshot.active.colorScheme !== 'light') throw new Error('unexpected fixture scheme');

if (zhKeys.size !== enKeys.size) throw new Error(`locale key counts differ: zh ${zhKeys.size}, en ${enKeys.size}`);
for (const key of enKeys) if (!zhKeys.has(key)) throw new Error(`en key not in zh: ${key}`);

/** Walk a component tree looking for the card whose aria-label starts with a readable skin name. */
function findCard(tree, key) {
  let found = null;
  walk(tree);
  return found;
  function walk(node) {
    if (node === null || node === undefined || found !== null) return;
    if (typeof node === 'string') return;
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (typeof node.type === 'string' && node.type === 'button' && String(node.props['aria-label'] ?? '').startsWith(key)) {
      found = node;
      return;
    }
    const children = node.props?.children;
    if (children !== undefined) for (const child of [children].flat()) walk(child);
    return;
  }
}

function clickCard(key) {
  const card = findCard(main.component({ t: (keyName) => keyName }), key);
  if (card === null) throw new Error(`no card found for ${key}`);
  card.props.onClick();
}

for (const id of ['pixel', 'aurora', 'paper', 'neon']) {
  const past = layer;
  clickCard(`skin.${id}.name`);
  if (layer === null) throw new Error(`${id}: no token layer stacked`);
  if (layer === past) throw new Error(`${id}: previous layer was not replaced`);
  if (layer.source !== '@local/dsh-skin-studio') throw new Error(`${id}: unexpected source ${layer.source}`);
  for (const [name, value] of Object.entries(layer.tokens)) {
    if (typeof value !== 'object' || value === null || typeof value.light !== 'string' || typeof value.dark !== 'string') {
      throw new Error(`${id}: token ${name} is not a { light, dark } pair`);
    }
  }
  const tree = main.component({ t: (keyName) => keyName });
  assertWellFormed(tree, `${id} page`);
  const selected = findCard(tree, `skin.${id}.name`);
  if (selected.props['aria-pressed'] !== true) throw new Error(`${id}: selected card does not report aria-pressed`);
  const other = findCard(tree, 'skin.original.name');
  if (other.props['aria-pressed'] !== false) throw new Error(`${id}: another card reports itself selected`);
}

clickCard('skin.original.name');
if (layer !== null) throw new Error('original should remove the token layer');

clickCard('skin.pixel.name');
themeSnapshot = { ...themeSnapshot, active: { colorScheme: 'dark', tokens: {} } };
ctx.__themeListener(themeSnapshot);
assertWellFormed(main.component({ t: (keyName) => keyName }), 'page after theme change');
clickCard('skin.original.name');
if (layer !== null) throw new Error('original should remove the layer after a theme change');

assertWellFormed(sidebar.component({ size: 16, active: false }), 'sidebar icon');
assertWellFormed(sidebar.component({ size: 24, active: true }), 'sidebar icon selected');

console.log('smoke ok: registrations', registrations.map((r) => r.options.name).join(', '));
console.log('effects', effects.map((e) => e.label).join(' | '));
console.log('locale keys', zhKeys.size, '(zh/en aligned)');

for (const effect of effects) effect.dispose();
if (layer !== null) throw new Error('disposal left a token layer installed');
console.log('disposal ok');

function assertWellFormed(node, label) {
  walk(node);
  function walk(value) {
    if (value === null || value === undefined || typeof value === 'string' || typeof value === 'number') return;
    if (Array.isArray(value)) {
      for (const child of value) walk(child);
      return;
    }
    if (typeof value !== 'object') throw new Error(`${label}: unexpected node ${typeof value}`);
    if (typeof value.type !== 'string' && typeof value.type !== 'function') throw new Error(`${label}: node without a type`);
    const children = value.props?.children;
    if (children !== undefined) for (const child of [children].flat()) walk(child);
  }
}
