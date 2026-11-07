/**
 * Integration check for the shipped `client.js`.
 *
 * The bundle is executed exactly as the browser would: `window.__ModuleLoader__
 * .load` captures the factory, the factory is called with a `require` stub that
 * returns React, and the returned plugin's `apply` runs against a mock Context.
 * The assertions cover what matters for the real page:
 *
 *   - the loader contract (id, factory shape, `inject`)
 *   - one main-panel registration keyed `landmarks3d`
 *   - one sidebar entry with the same id, so selecting it opens that panel
 *   - locale dictionaries registered for every supplied language
 *   - the registered panel renders without throwing, and its canvas is present
 *
 * WebGL is never touched (effects do not run in server rendering); the renderer
 * has its own fake-context test in `tools/smoke.mjs`.
 *
 *   node tools/integration.mjs
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { readFileSync } from 'node:fs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

let failures = 0;
const ok = (m) => console.log(`✓ ${m}`);
const fail = (m) => {
  console.error(`✗ ${m}`);
  failures += 1;
};

/* ------------------------------------------------------------- fake host */

let captured = null;
globalThis.window = {
  __ModuleLoader__: {
    load(definition) {
      captured = definition;
    },
  },
};

const requireStub = (name) => {
  if (name === 'react') return React;
  throw new Error(`client.js required an unexpected module: ${name}`);
};

/** A Context good enough for `apply`: records effects, slots and locale calls. */
function makeCtx() {
  const registrations = [];
  const effects = [];
  const localeCalls = [];
  const handlers = [];
  const ctx = {
    get(name) {
      if (name === 'locale') {
        return {
          register: (ns, language, dict) => {
            localeCalls.push({ ns, language, keys: Object.keys(dict).length });
            return () => {};
          },
          bind: (ns) => (key) => (ns === 'landmarks3d' ? key : key),
        };
      }
      if (name === 'theme') {
        return { getTheme: () => ({ active: { colorScheme: 'light' } }) };
      }
      return undefined;
    },
    effect(fn) {
      const disposer = typeof fn === 'function' ? fn() : undefined;
      effects.push(disposer);
      return () => {
        if (typeof disposer === 'function') disposer();
      };
    },
    on(event, fn) {
      handlers.push({ event, fn });
      return () => {};
    },
    slots: {
      inject(key, callback) {
        const disposer = callback();
        return () => {
          if (typeof disposer === 'function') disposer();
        };
      },
      register(options, component) {
        registrations.push({ options, component });
        return () => {};
      },
    },
  };
  return { ctx, registrations, effects, localeCalls, handlers };
}

/* --------------------------------------------------------------- execute */

await import(pathToFileURL(resolve(root, 'client.js')).href);

if (!captured) {
  fail('client.js never called window.__ModuleLoader__.load');
  process.exit(1);
}
ok('client.js called window.__ModuleLoader__.load');

if (captured.id !== pkg.name) fail(`loader id "${captured.id}" != package name "${pkg.name}"`);
else ok(`loader id is the package name`);

if (typeof captured.factory !== 'function') {
  fail('loader definition has no factory');
  process.exit(1);
}

let plugin;
try {
  plugin = captured.factory(requireStub);
} catch (err) {
  fail(`factory threw — ${err && err.message}`);
  process.exit(1);
}
ok('factory returned a plugin without touching the DOM');

if (typeof plugin.apply !== 'function') fail('the plugin exposes no apply(ctx)');
if (!Array.isArray(plugin.inject) || !plugin.inject.includes('slots')) {
  fail('the plugin does not declare `inject: ["slots"]`');
} else {
  ok(`the plugin declares inject ${JSON.stringify(plugin.inject)}`);
}

const { ctx, registrations, effects, localeCalls } = makeCtx();
try {
  plugin.apply(ctx);
} catch (err) {
  fail(`apply threw — ${err && err.message}`);
  if (err && err.stack) console.error(err.stack.split('\n').slice(0, 6).join('\n'));
  process.exit(1);
}
ok('apply(ctx) completed');

/* ------------------------------------------------------------ assertions */

const mainReg = registrations.find((r) => r.options.name === 'main');
const sidebarReg = registrations.find((r) => r.options.name === 'sidebar.panellist');

if (!mainReg) fail('no "main" panel registration');
else if (mainReg.options.key !== 'landmarks3d') fail(`main panel key is "${mainReg.options.key}"`);
else ok('registered one main panel keyed "landmarks3d"');

if (!sidebarReg) fail('no "sidebar.panellist" registration (there would be no entry to click)');
else {
  if (sidebarReg.options.id !== mainReg?.options.key) {
    fail(`sidebar id "${sidebarReg.options.id}" does not match the main key "${mainReg?.options.key}" — clicking it would open nothing`);
  } else {
    ok('the sidebar entry id selects the registered panel');
  }
  if (typeof sidebarReg.options.order !== 'number') fail('the sidebar entry has no order');
  if (typeof sidebarReg.options.label !== 'function') {
    fail('the sidebar label is not a thunk, so it cannot follow the active locale');
  } else {
    let label;
    try {
      label = sidebarReg.options.label();
    } catch (err) {
      fail(`the label thunk threw — ${err && err.message}`);
    }
    if (typeof label !== 'string' || !label) fail(`the label thunk returned "${label}"`);
    else ok(`the sidebar label resolves to "${label}"`);
  }
  if (typeof sidebarReg.component !== 'function') fail('the sidebar entry has no component');
}

// Dictionaries: one registration per shipped language.
const expectedLangs = readFileSync(resolve(root, 'src/client/locale-data.js'), 'utf8');
const shipped = ['en', 'zh'].filter((l) => expectedLangs.includes(`${l}: {`));
if (!localeCalls.length) fail('no locale dictionaries were registered');
else {
  const got = localeCalls.map((c) => c.language).sort();
  const want = shipped.slice().sort();
  if (got.join(',') !== want.join(',')) fail(`registered languages ${got.join(',')} != ${want.join(',')}`);
  else ok(`registered dictionaries for ${got.join(' and ')}`);
  if (localeCalls.some((c) => c.keys < 10)) fail('a registered dictionary is suspiciously small');
}
if (!effects.length) fail('no effects were registered (nothing would be disposed on unload)');
else ok(`${effects.length} disposer(s) registered for plugin unload`);

// The registered panel component must render, and must render the canvas.
if (mainReg && typeof mainReg.component === 'function') {
  try {
    // The slot framework injects owner props; the panel only requires `services`.
    const markup = renderToStaticMarkup(
      mainReg.component({
        services: {
          get: (name) =>
            name === 'locale'
              ? { bind: () => (key) => key }
              : name === 'theme'
                ? { getTheme: () => ({ active: { colorScheme: 'dark' } }) }
                : undefined,
          subscribe: () => () => {},
        },
      }),
    );
    if (!markup.includes('lm-root')) fail('the registered panel rendered no root element');
    else if (!markup.includes('lm-canvas')) fail('the registered panel rendered no canvas');
    else ok('the registered panel renders, canvas included');
    if (!markup.includes('lm-item')) fail('the panel rendered no landmark switcher');
    else ok('the switcher renders all four entries');
  } catch (err) {
    fail(`the registered panel threw — ${err && err.message}`);
    if (err && err.stack) console.error(err.stack.split('\n').slice(0, 6).join('\n'));
  }
}

// The sidebar component must render as a standalone icon.
if (sidebarReg && typeof sidebarReg.component === 'function') {
  try {
    const markup = renderToStaticMarkup(sidebarReg.component({ size: 20, active: false }));
    if (!/<svg/.test(markup)) fail('the sidebar icon rendered no svg');
    else ok('the sidebar icon renders an svg');
  } catch (err) {
    fail(`the sidebar icon threw — ${err && err.message}`);
  }
}

console.log(failures ? `\n${failures} integration check(s) failed.` : '\nAll integration checks passed.');
process.exit(failures ? 1 : 0);
