/**
 * Renders the panel component through React's server renderer and inspects the
 * markup. This catches what a syntax check cannot: a component that throws on
 * mount, a translation key that falls through to its key, and a canvas that
 * never receives its interaction handlers.
 *
 * Effects do not run during server rendering, so WebGL is never touched here;
 * the renderer itself is covered by `tools/smoke.mjs` against a recorded fake
 * context.
 *
 *   node tools/render-check.mjs
 */
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { createLandmarkUi } = await import(pathToFileURL(resolve(root, 'src/client/ui.js')).href);
const { LOCALE_NAMESPACES } = await import(pathToFileURL(resolve(root, 'src/client/locale-data.js')).href);

let failures = 0;
const ok = (m) => console.log(`✓ ${m}`);
const fail = (m) => {
  console.error(`✗ ${m}`);
  failures += 1;
};

function makeServices(lang) {
  const dict = LOCALE_NAMESPACES[lang] ?? LOCALE_NAMESPACES.en;
  return {
    get(name) {
      if (name === 'locale') {
        return {
          bind: (ns) => (key) => (ns === 'landmarks3d' && dict[key]) || key,
          getSnapshot: () => ({ active: lang, locales: [], revision: 1 }),
          subscribe: () => () => {},
        };
      }
      if (name === 'theme') {
        return {
          getTheme: () => ({
            preference: 'light',
            active: { id: 'light', colorScheme: 'light', tokens: {} },
          }),
        };
      }
      return undefined;
    },
    subscribe: () => () => {},
  };
}

const ui = createLandmarkUi(React);

for (const lang of ['en', 'zh']) {
  const services = makeServices(lang);
  let html;
  try {
    html = renderToStaticMarkup(
      React.createElement(ui.MainPanel, { services }),
    );
  } catch (err) {
    fail(`${lang}: MainPanel threw while rendering — ${err && err.message}`);
    if (err && err.stack) console.error(err.stack.split('\n').slice(0, 6).join('\n'));
    continue;
  }

  // The four landmarks must all be present in the switcher.
  for (const id of ['eiffel.name', 'wall.name', 'forbidden-city.name', 'taj-mahal.name']) {
    const label = LOCALE_NAMESPACES[lang][id];
    if (!html.includes(label)) fail(`${lang}: the switcher is missing "${label}"`);
  }
  ok(`${lang}: all four landmark entries rendered`);

  // A `key` leaking into output means the dictionary lookup missed.
  const leakedKeys = [...html.matchAll(/>([a-z-]+\.[a-z-]+(?:\.[a-z-]+)?)</g)]
    .map((m) => m[1])
    .filter((v) => /^(panel|eiffel|wall|forbidden-city|taj-mahal)\./.test(v));
  if (leakedKeys.length) fail(`${lang}: untranslated keys visible in markup: ${leakedKeys.join(', ')}`);
  else ok(`${lang}: no untranslated keys in the rendered copy`);

  if (!html.includes('lm-canvas')) fail(`${lang}: the WebGL canvas is absent`);
  else ok(`${lang}: canvas mounted`);
  if (!html.includes('lm-item')) fail(`${lang}: the landmark switcher did not render`);
  if (!html.includes('lm-btn')) fail(`${lang}: the control row did not render`);
  if (!html.includes('aria-pressed')) fail(`${lang}: the auto-rotate control lost its pressed state`);
  else ok(`${lang}: controls carry accessible state`);

  // The panel must stream its own stylesheet, not leak colours as inline
  // literals on every element; the sky gradient is a CSS variable pair.
  if (!html.includes('--lm-sky-top')) fail(`${lang}: the stage palette variables are missing`);
  else ok(`${lang}: theme-driven sky variables are set`);

  // Colour policy: host chrome must use theme tokens. The only permitted
  // literal colours are the stage's sky custom properties, which are artwork
  // (the plugin rules allow artwork its own palette) and are re-derived from
  // the active theme. Anything else is a token bypass.
  const offenders = [];
  for (const m of html.matchAll(/style="([^"]*)"/gi)) {
    const decl = m[1];
    if (!/#[0-9a-f]{3,6}/i.test(decl)) continue;
    const customProps = [...decl.matchAll(/--[a-z-]+:[^;]*#[0-9a-f]{3,6}/gi)].map((c) => c[0]);
    const remaining = decl.replace(/--[a-z-]+:[^;]*(?:;|$)/gi, '');
    if (!/--lm-sky-[a-z]+:/i.test(customProps.join(''))) offenders.push(decl);
    if (/#[0-9a-f]{3,6}/i.test(remaining)) offenders.push(remaining);
  }
  if (offenders.length) fail(`${lang}: ${offenders.length} inline colour(s) bypass the theme tokens: ${offenders[0]}`);
  else ok(`${lang}: all non-artwork colour comes from theme tokens`);
}

// The sidebar icon is a separate registration and must render standalone.
try {
  const iconHtml = renderToStaticMarkup(React.createElement(ui.SidebarIcon, { size: 16, active: false }));
  if (!/<svg/.test(iconHtml)) fail('SidebarIcon rendered no svg');
  else if (!/width="16"/.test(iconHtml)) fail('SidebarIcon ignored its requested size');
  else ok('SidebarIcon renders an svg at the requested size');
} catch (err) {
  fail(`SidebarIcon threw — ${err && err.message}`);
}

console.log(failures ? `\n${failures} render check(s) failed.` : '\nAll render checks passed.');
process.exit(failures ? 1 : 0);
