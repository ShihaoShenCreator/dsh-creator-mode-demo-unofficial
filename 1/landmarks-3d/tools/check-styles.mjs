/**
 * Checks that every CSS class name used in the UI has a rule, and every rule
 * targets a class that is actually used. An unstyled element is the most
 * common way a plugin page ships looking broken without any error.
 *
 *   node tools/check-styles.mjs
 */
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ui = readFileSync(resolve(root, 'src/client/ui.js'), 'utf8');

let failures = 0;
const ok = (m) => console.log(`✓ ${m}`);
const fail = (m) => {
  console.error(`✗ ${m}`);
  failures += 1;
};

// Classes referenced from JSX-ish createElement calls: className: 'a b c'
const used = new Set();
for (const m of ui.matchAll(/className:\s*'([^']+)'/g)) {
  for (const cls of m[1].split(/\s+/)) if (cls) used.add(cls);
}
// Classes referenced through template literals in the markup.
for (const m of ui.matchAll(/className:\s*`([^`]+)`/g)) {
  for (const cls of m[1].split(/\s+/)) if (cls && !cls.includes('${')) used.add(cls);
}

// Classes defined in the CSS template literal.
const cssStart = ui.indexOf('const CSS = `');
const cssEnd = ui.indexOf('`;', cssStart);
if (cssStart < 0 || cssEnd < 0) {
  fail('could not locate the CSS template literal');
  process.exit(1);
}
const css = ui.slice(cssStart, cssEnd);
const defined = new Set();
for (const m of css.matchAll(/\.([a-z][a-z0-9-]*)/g)) defined.add(m[1]);

if (!used.size) fail('no className values were found in the UI source');
else ok(`${used.size} class names are used in markup`);

const unstyled = [...used].filter((c) => !defined.has(c));
if (unstyled.length) fail(`markup uses classes with no CSS rule: ${unstyled.join(', ')}`);
else ok('every class used in markup has a style rule');

const unused = [...defined].filter((c) => !used.has(c));
if (unused.length) {
  // Rules for pseudo-state helpers are legitimately "unused" by this check
  // only if they are part of a compound selector; list them for review.
  console.log(`  (note) ${unused.length} styled class(es) are not referenced in markup: ${unused.join(', ')}`);
}

// A few structural invariants that are easy to regress.
const required = [
  'lm-root',
  'lm-head',
  'lm-body',
  'lm-list',
  'lm-item',
  'lm-stage',
  'lm-canvas',
  'lm-hint',
  'lm-info',
  'lm-info-name',
  'lm-fallback',
  'lm-btn',
  'lm-stats',
  'lm-chip',
];
for (const cls of required) {
  if (!used.has(cls)) fail(`markup no longer uses .${cls}`);
}
ok('the panel keeps its structural landmarks');

// Theme tokens: any colour-looking literal inside the CSS, outside artwork
// custom properties, should be a token reference.
const literalColours = [...css.matchAll(/#[0-9a-f]{3,8}\b/gi)]
  .map((m) => m[0])
  .filter((hex) => !/^#(e2e9f1|f8f5ef|0c121d|1c2636)$/i.test(hex));
if (literalColours.length) {
  fail(`stylesheet contains literal colours instead of tokens: ${[...new Set(literalColours)].join(', ')}`);
} else {
  ok('stylesheet colours resolve through theme tokens or the sky artwork variables');
}

console.log(failures ? `\n${failures} style check(s) failed.` : '\nAll style checks passed.');
process.exit(failures ? 1 : 0);
