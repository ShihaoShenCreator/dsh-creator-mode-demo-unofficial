// Check the skin palettes: shape validity and WCAG text contrast.
import fs from 'node:fs';

const src = fs.readFileSync(new URL('../client.js', import.meta.url), 'utf8');
const start = src.indexOf('const SKINS = [');
const end = src.indexOf('const SKIN_IDS =');
if (start < 0 || end < 0) throw new Error('skin block markers not found');

const parsed = new globalThis.Function(
  `function pair(light, dark) { return { light, dark }; }
   ${src.slice(start, end)}
   return SKINS;`,
)();

function rgb(value) {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value);
  if (m === null) return null;
  let hex = m[1];
  if (hex.length === 3) hex = hex.split('').map((c) => c + c).join('');
  return [0, 2, 4].map((i) => Number.parseInt(hex.slice(i, i + 2), 16));
}

function luminance([r, g, b]) {
  const channel = (c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

const TEXT_TOKENS = [
  ['--dsw-alias-label-primary', 7],
  ['--dsw-alias-label-secondary', 4.5],
  ['--dsw-alias-label-tertiary', 3],
  ['--dsw-alias-label-caption', 3],
];

/** Non-text pairs that still have to be distinguishable. */
const SURFACE_TOKENS = [
  ['--dsw-alias-brand-primary', 3],
  ['--dsw-alias-link', 3],
  ['--dsw-alias-border-l3', 1.4],
];

/** Text drawn on a filled control rather than on the base surface. */
const ON_FILL_TOKENS = [
  ['--dsw-alias-brand-primary', '--dsw-alias-brand-text', 3],
  ['--dsw-alias-button-primary-fill', '--dsw-alias-brand-text', 3],
];

let failures = 0;
for (const skin of parsed) {
  if (skin.tokens === null) {
    console.log(`${skin.id}: no tokens (host palette)`);
    continue;
  }
  const names = Object.keys(skin.tokens);
  console.log(`\n${skin.id}: ${names.length} tokens`);
  for (const scheme of ['light', 'dark']) {
    const base = skin.tokens['--dsw-alias-bg-base'];
    if (base === undefined) {
      console.log(`  ${scheme}: MISSING --dsw-alias-bg-base`);
      failures += 1;
      continue;
    }
    for (const [token, minimum] of TEXT_TOKENS) {
      const entry = skin.tokens[token];
      if (entry === undefined) {
        console.log(`  ${scheme}: ${token} not overridden (inherits host)`);
        continue;
      }
      const fg = rgb(entry[scheme]);
      const bg = rgb(base[scheme]);
      if (fg === null || bg === null) {
        console.log(`  ${scheme}: ${token} cannot be measured (${entry[scheme]} on ${base[scheme]})`);
        failures += 1;
        continue;
      }
      const ratio = contrast(fg, bg);
      const ok = ratio >= minimum;
      if (!ok) failures += 1;
      console.log(
        `  ${scheme.padEnd(5)} ${token.replace('--dsw-alias-', '').padEnd(19)} ${entry[scheme].padEnd(9)} on ${base[scheme].padEnd(9)} ${ratio.toFixed(2)} : 1  (>= ${minimum}) ${ok ? 'ok' : 'LOW'}`,
      );
    }
    for (const [token, minimum] of SURFACE_TOKENS) {
      const entry = skin.tokens[token];
      if (entry === undefined) continue;
      const fg = rgb(entry[scheme]);
      const bg = rgb(base[scheme]);
      if (fg === null || bg === null) {
        failures += 1;
        console.log(`  ${scheme}: ${token} cannot be measured`);
        continue;
      }
      const ratio = contrast(fg, bg);
      const ok = ratio >= minimum;
      if (!ok) failures += 1;
      console.log(
        `  ${scheme.padEnd(5)} ${token.replace('--dsw-alias-', '').padEnd(19)} ${entry[scheme].padEnd(9)} vs base ${ratio.toFixed(2)} : 1  (>= ${minimum}) ${ok ? 'ok' : 'LOW'}`,
      );
    }
    for (const [fillToken, inkToken, minimum] of ON_FILL_TOKENS) {
      const fill = skin.tokens[fillToken];
      const ink = skin.tokens[inkToken];
      if (fill === undefined || ink === undefined) continue;
      const fg = rgb(ink[scheme]);
      const bg = rgb(fill[scheme]);
      if (fg === null || bg === null) {
        failures += 1;
        console.log(`  ${scheme}: ${inkToken} on ${fillToken} cannot be measured`);
        continue;
      }
      const ratio = contrast(fg, bg);
      const ok = ratio >= minimum;
      if (!ok) failures += 1;
      console.log(
        `  ${scheme.padEnd(5)} ${inkToken.replace('--dsw-alias-', '').padEnd(19)} on ${fill[scheme].padEnd(9)} ${ratio.toFixed(2)} : 1  (>= ${minimum}) ${ok ? 'ok' : 'LOW'}`,
      );
    }
  }
  for (const [name, entry] of Object.entries(skin.tokens)) {
    if (typeof entry !== 'object' || entry === null || typeof entry.light !== 'string' || typeof entry.dark !== 'string') {
      console.log(`  BAD SHAPE ${name}`);
      failures += 1;
    }
  }
}

console.log(`\nfailures: ${failures}`);
process.exitCode = failures === 0 ? 0 : 1;
