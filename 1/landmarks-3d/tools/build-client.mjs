/**
 * Bundle the Client half into the single-file `client.js` that Harness loads
 * through `window.__ModuleLoader__.load`.
 *
 * React comes from the browser module table (`require('react')`), so it is
 * marked external; every other `src/` module is inlined. The wrapper keeps the
 * factory free of side effects: registrations happen inside `apply`.
 *
 *   node tools/build-client.mjs
 */
import { build } from 'esbuild';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
const PANEL_KEY = 'landmarks3d';
const SIDEBAR_ORDER = 20;

const entrySource = `
import { createLandmarkUi, makeTranslate, makeServices } from './src/client/ui.js';
import { LOCALE_NAMESPACES } from './src/client/locale-data.js';

const PANEL_KEY = ${JSON.stringify(PANEL_KEY)};

window.__ModuleLoader__.load({
  id: ${JSON.stringify(pkg.name)},
  factory(require) {
    const React = require('react');
    const ui = createLandmarkUi(React);

    return {
      inject: ['slots'],
      apply(ctx) {
        const services = makeServices(ctx);
        // Dictionaries: one effect per locale. The locale service is optional,
        // so the page still renders (with English fallbacks) without it.
        const locale = ctx.get('locale');
        if (locale && typeof locale.register === 'function') {
          for (const language of Object.keys(LOCALE_NAMESPACES)) {
            ctx.effect(() =>
              locale.register('landmarks3d', language, LOCALE_NAMESPACES[language]),
            );
          }
        }

        // The main panel renders whatever the sidebar entry selects. The
        // services face is bound to this plugin's fibre, so locale and theme
        // reads stay valid for the panel's lifetime.
        ctx.slots.inject('main', () =>
          ctx.slots.register(
            { name: 'main', key: PANEL_KEY },
            (props) => React.createElement(ui.MainPanel, { ...props, services }),
          ),
        );
        // Sidebar entry: icon plus a label thunk, re-read on every projection
        // so a locale change renames the row without re-registering.
        ctx.slots.inject('sidebar.panellist', () =>
          ctx.slots.register(
            {
              name: 'sidebar.panellist',
              id: PANEL_KEY,
              order: ${SIDEBAR_ORDER},
              label: () => makeTranslate(services.get('locale'))('panel.title', 'Landmark studio'),
            },
            ui.SidebarIcon,
          ),
        );
      },
    };
  },
});
`;

const result = await build({
  stdin: { contents: entrySource, resolveDir: root, sourcefile: 'entry.js', loader: 'js' },
  bundle: true,
  write: false,
  format: 'esm',
  target: 'es2022',
  platform: 'browser',
  external: ['react'],
  legalComments: 'none',
  logLevel: 'warning',
});

if (result.errors && result.errors.length) {
  for (const err of result.errors) console.error(err);
  process.exit(1);
}
const out = result.outputFiles && result.outputFiles[0];
if (!out) {
  console.error('esbuild produced no output file');
  process.exit(1);
}
const text = out.text ?? out.contents?.toString('utf8') ?? '';
await writeFile(resolve(root, 'client.js'), text, 'utf8');
console.log(`wrote client.js (${(text.length / 1024).toFixed(1)} KiB)`);
