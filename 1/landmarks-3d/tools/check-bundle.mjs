/**
 * Static checks for the shipped artifacts: the bundle manifest, the loader
 * wrapper in `client.js`, exported display resources, and locale parity.
 *
 *   node tools/check-bundle.mjs
 */
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
let failures = 0;

function fail(message) {
  console.error(`✗ ${message}`);
  failures += 1;
}
function ok(message) {
  console.log(`✓ ${message}`);
}

const pkg = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));

// ------------------------------------------------------------- manifest
if (!pkg.name || !pkg.version) fail('package.json needs name and version');
if (pkg.type !== 'module') fail('package.json must declare "type": "module"');
if (!pkg.private) fail('a local bundle should be private: true');

const patchPath = pkg.dsh?.bundle?.patch;
if (!patchPath) fail('package.json is missing dsh.bundle.patch');
else if (!existsSync(resolve(root, patchPath))) fail(`bundle patch ${patchPath} does not exist`);
else {
  const patch = readFileSync(resolve(root, patchPath), 'utf8');
  if (!patch.includes(pkg.name)) fail('the bundle patch never names the package');
  if (!/- insert:/.test(patch)) fail('the bundle patch has no insert list');
  ok('bundle manifest declares a patch that inserts this package');
}

const client = pkg.dsh?.client;
if (!client) fail('package.json is missing dsh.client (the page would not load)');
else {
  if (client.platform !== 'web') fail('dsh.client.platform must be "web"');
  ok(`dsh.client declares platform ${client.platform}`);
}

// ------------------------------------------------------------- exports
const exports_ = pkg.exports ?? {};
const needed = ['.', './client', './icon'];
for (const key of needed) {
  if (!exports_[key]) fail(`package.json exports is missing "${key}"`);
}
if (!exports_['./locale/*.json']) fail('package.json does not export ./locale/*.json');
for (const key of needed) {
  if (exports_[key] && !existsSync(resolve(root, exports_[key]))) {
    fail(`exported path ${exports_[key]} does not exist`);
  }
}
ok('all declared exports resolve to real files');

// `files` must cover everything the runtime reads; a linked directory ignores
// it, but a packed install does not.
const files = pkg.files ?? [];
for (const entry of ['index.js', 'client.js', 'cordis.patch.yml', 'icon.svg']) {
  if (!files.includes(entry)) fail(`files[] is missing ${entry}`);
}
if (!files.some((f) => f.includes('locale'))) fail('files[] is missing the locale directory');
ok('files[] covers the runtime artifacts');

// ------------------------------------------------------------- client.js
const clientSource = readFileSync(resolve(root, 'client.js'), 'utf8');
if (!clientSource.includes('__ModuleLoader__.load')) fail('client.js does not call window.__ModuleLoader__.load');
if (!clientSource.includes(JSON.stringify(pkg.name))) fail('the loader id does not match the package name');
if (!/factory\s*\(\s*require/.test(clientSource)) fail('client.js has no factory(require) signature');
if (clientSource.includes('@deepseek-ai/dsh-client-ui-primitives')) {
  fail('client.js imports a Harness Client package, which the plugin rules forbid');
}
const declared = clientSource.match(/__ModuleLoader__\.load\(\{\s*id: "([^"]+)"/);
if (declared && declared[1] !== pkg.name) fail(`loader id ${declared[1]} != package name ${pkg.name}`);
ok('client.js is a single loader wrapper with the right id and no forbidden imports');

// The factory must be side-effect free until `apply` runs. Only the code
// between the factory opening and `apply(ctx` is considered; model modules
// further down may legitimately mention DOM types in comments.
const factoryStart = clientSource.indexOf('factory(');
const applyStart = clientSource.indexOf('apply(ctx');
if (factoryStart >= 0 && applyStart > factoryStart) {
  const between = clientSource.slice(factoryStart, applyStart);
  if (/window\.addEventListener|document\.body\.append|document\.createElement/.test(between)) {
    fail('the factory touches the DOM before apply() runs');
  } else {
    ok('the factory has no DOM side effects before apply()');
  }
} else {
  fail('client.js has no factory(...) body leading to apply(ctx');
}

// ------------------------------------------------------------- locale
const en = JSON.parse(readFileSync(resolve(root, 'locale/en.json'), 'utf8'));
const zh = JSON.parse(readFileSync(resolve(root, 'locale/zh.json'), 'utf8'));
for (const [label, dict] of [
  ['en', en],
  ['zh', zh],
]) {
  if (!dict.meta?.title) fail(`locale/${label}.json has no meta.title`);
  if (!dict.meta?.description) fail(`locale/${label}.json has no meta.description`);
}
const enTitle = en.meta.title;
const zhTitle = zh.meta.title;
ok(`display metadata: en "${enTitle}" / zh "${zhTitle}"`);

// Every UI key the client asks for must exist in both dictionaries of the
// bundled locale data. `t(key, fallback)` calls pass a literal fallback, so a
// missing key would silently ship English copy into a Chinese UI.
const localeData = readFileSync(resolve(root, 'src/client/locale-data.js'), 'utf8');
const requested = new Set();
for (const m of localeData.matchAll(/'((?:panel|eiffel|wall|forbidden-city|taj-mahal)\.[a-z0-9-]+(?:\.[a-z0-9-]+)?)'/g)) {
  requested.add(m[1]);
}
const langBlocks = {};
for (const lang of ['en', 'zh']) {
  const start = localeData.indexOf(`${lang}: {`);
  if (start < 0) {
    fail(`locale-data.js has no "${lang}" dictionary`);
    continue;
  }
  langBlocks[lang] = localeData.slice(start, localeData.indexOf('\n  },', start));
}
const missing = [];
for (const key of requested) {
  for (const lang of Object.keys(langBlocks)) {
    if (!langBlocks[lang].includes(`'${key}':`)) missing.push(`${lang}:${key}`);
  }
}
if (missing.length) fail(`UI keys missing from a dictionary: ${missing.join(', ')}`);
else ok(`${requested.size} UI dictionary keys exist in ${Object.keys(langBlocks).length} languages`);

// Display metadata keys requested by the panel title thunk must exist too.
for (const key of ['panel.title', 'panel.subtitle', 'panel.hint', 'panel.rotate', 'panel.reset']) {
  for (const lang of Object.keys(langBlocks)) {
    if (!langBlocks[lang].includes(`'${key}':`)) fail(`${lang} dictionary lacks ${key}`);
  }
}
ok('core panel copy is present in every language');

// ------------------------------------------------------------- icon
const iconPath = resolve(root, 'icon.svg');
if (!existsSync(iconPath)) fail('icon.svg is missing');
else {
  const icon = readFileSync(iconPath, 'utf8');
  if (!/^<svg[\s>]/i.test(icon.trim())) fail('icon.svg does not start with an <svg> element');
  if (!/viewBox=/.test(icon)) fail('icon.svg has no viewBox');
  const bytes = Buffer.byteLength(icon, 'utf8');
  if (bytes > 256 * 1024) fail(`icon.svg is ${bytes} bytes, over the 256 KiB limit`);
  ok(`icon.svg is a valid SVG of ${bytes} bytes`);
}

// ------------------------------------------------------------- host half
const host = readFileSync(resolve(root, 'index.js'), 'utf8');
if (!/export function apply/.test(host)) fail('index.js does not export apply()');
ok('index.js exports the expected Host half');

const modelFiles = [
  'src/models/eiffel.js',
  'src/models/great-wall.js',
  'src/models/forbidden-city.js',
  'src/models/taj-mahal.js',
];
for (const file of modelFiles) {
  if (!existsSync(resolve(root, file))) fail(`model ${file} is missing`);
}
ok(`all ${modelFiles.length} landmark models are present`);

console.log(failures ? `\n${failures} bundle check(s) failed.` : '\nAll bundle checks passed.');
process.exit(failures ? 1 : 0);
