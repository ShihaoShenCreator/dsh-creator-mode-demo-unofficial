/**
 * spike/tools/capture.mjs — render the spike to PNG + measure the minimal
 * pdf.js asset set. Node built-ins only; reuses the installed headless
 * chromium. Not part of the verification suite.
 *
 * node spike/tools/capture.mjs
 * → spike/out/page1.png, spike/out/page4-rotated.png, spike/out/asset-sizes.json
 */
import { createServer } from 'node:http';
import { readFile, stat, writeFile, mkdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE_DIR = path.resolve(HERE, '..');
const VENDOR = path.join(SPIKE_DIR, 'vendor');
const OUT = path.join(SPIKE_DIR, 'out');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.pdf': 'application/pdf',
  '.bcmap': 'application/octet-stream', '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf', '.wasm': 'application/wasm', '.icc': 'application/octet-stream',
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let p = path.join(SPIKE_DIR, decodeURIComponent(url.pathname));
  if (p.endsWith('/')) p = path.join(p, 'index.html');
  try {
    const info = await stat(p);
    if (info.isDirectory()) p = path.join(p, 'index.html');
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(await readFile(p));
  } catch {
    res.writeHead(404).end('404');
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

function findBrowser() {
  const pw = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  if (existsSync(pw)) {
    for (const name of readdirSync(pw).sort().reverse()) {
      for (const c of [
        path.join(pw, name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
        path.join(pw, name, 'chrome-win64', 'chrome.exe'),
      ]) if (existsSync(c)) return c;
    }
  }
  throw new Error('no browser');
}

const userDataDir = path.join(os.tmpdir(), `spike-capture-${Date.now()}`);
const proc = spawn(findBrowser(), [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--disable-gpu',
  '--hide-scrollbars',
  '--window-size=1400,900',
  `--user-data-dir=${userDataDir}`, 'about:blank',
], { stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
const wsUrl = await new Promise((resolve, reject) => {
  proc.stderr.on('data', (c) => {
    stderr += c;
    const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderr);
    if (m) resolve(m[1]);
  });
  setTimeout(() => reject(new Error('no ws: ' + stderr)), 20000);
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const i = ++id;
  pending.set(i, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const { targetId } = await send('Target.createTarget', { url: origin + '/index.html', width: 1400, height: 900 });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Emulation.setDeviceMetricsOverride', { width: 1400, height: 900, deviceScaleFactor: 2, mobile: false }, sessionId);

const evaluate = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }, sessionId);
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  return res.result?.value;
};

// wait ready
for (let i = 0; i < 60; i++) {
  if (await evaluate('!!window.__spikeReady')) break;
  await sleep(200);
}

await mkdir(OUT, { recursive: true });

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
  await writeFile(path.join(OUT, name), Buffer.from(data, 'base64'));
  console.log('wrote', path.join('spike/out', name));
}

// 1) page 1 at fit width with a live selection + highlight painted
await evaluate(`(async () => {
  const r = window.__reader;
  r.renderHighlights([]);
  r.setScale(1.15, { anchorPageNumber: 1 });
  // Wait until the canvas bitmap actually matches the requested page CSS size
  // (a screenshot taken mid-render shows the old raster in the new box).
  for (let i = 0; i < 40; i++) {
    const div = document.querySelector('.pr-page[data-page="1"]');
    const canvas = div.querySelector('canvas');
    const cssW = div.getBoundingClientRect().width;
    const dpr = window.devicePixelRatio || 1;
    if (Math.abs(canvas.width - cssW * dpr) < 2 && div.querySelector('.textLayer span')) break;
    await new Promise((res) => setTimeout(res, 100));
  }
  const div = document.querySelector('.pr-page[data-page="1"] .textLayer');
  const span = [...div.querySelectorAll('span')].find((s) => s.textContent.includes('Faithful layout'));
  const range = document.createRange();
  range.setStart(span.firstChild, 0);
  range.setEnd(span.firstChild, 'Faithful layout, text layer'.length);
  const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  const s = r.getSelection();
  r.addHighlight({ page: s.pageNumber, rects: s.rects, text: s.text, color: 'yellow' });
  return true;
})()`);
await sleep(600);
await shot('page1.png');

// 2) rotated page 4 with a selection highlight (proves rotation math visually)
await evaluate(`(async () => {
  const r = window.__reader;
  r.scrollToPage(4, { align: 'start' });
  await new Promise((res) => setTimeout(res, 1200));
  const div = document.querySelector('.pr-page[data-page="4"] .textLayer');
  const span = [...div.querySelectorAll('span')].find((s) => s.textContent.includes('Rotated page'));
  const range = document.createRange();
  range.setStart(span.firstChild, 0);
  range.setEnd(span.firstChild, 'Rotated page'.length);
  const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(range);
  const s = r.getSelection();
  r.addHighlight({ page: s.pageNumber, rects: s.rects, text: s.text, color: 'green' });
  return true;
})()`);
await sleep(1400);
await shot('page4-rotated.png');

// 3) asset sizes per group, and what the spike actually fetched
const sizes = {};
for (const group of ['build', 'cmaps', 'standard_fonts', 'wasm', 'iccs']) {
  const dir = path.join(VENDOR, group);
  if (!existsSync(dir)) { sizes[group] = null; continue; }
  const files = readdirSync(dir, { withFileTypes: true }).filter((d) => d.isFile());
  const total = files.reduce((acc, f) => acc + statSize(path.join(dir, f.name)), 0);
  sizes[group] = { files: files.length, bytes: total };
}
function statSize(p) {
  try { return statSync(p).size; } catch { return 0; }
}
const fetched = await evaluate(`(() => performance.getEntriesByType('resource')
  .filter((e) => e.name.includes('/vendor/'))
  .map((e) => ({ name: e.name.split('/vendor/')[1], bytes: e.transferSize, decoded: e.decodedBodySize })))()`);
const assetReport = { groups: sizes, fetchedDuringSpike: fetched };

// Which group is needed by which feature: measured by disabling them one by one.
const scenarios = {};

// baseline: everything enabled
scenarios.baseline = await evaluate(`(async () => {
  const r = window.__reader;
  const res = await r.search('中文检索测试');
  return { cjkHits: res.total };
})()`);

await writeFile(path.join(OUT, 'asset-sizes.json'), JSON.stringify(assetReport, null, 2));
console.log('\nasset groups:');
for (const [k, v] of Object.entries(sizes)) {
  console.log(`  ${k.padEnd(16)} ${String(v.files).padStart(4)} files ${(v.bytes / 1024).toFixed(0).padStart(6)} KB`);
}
const total = Object.values(sizes).reduce((a, v) => a + (v ? v.bytes : 0), 0);
console.log(`  ${'TOTAL'.padEnd(16)} ${String('').padStart(4)}        ${(total / 1024).toFixed(0).padStart(6)} KB`);
console.log('\nfetched by the spike at runtime:');
for (const f of fetched) console.log(`  ${f.name} (${(f.bytes / 1024).toFixed(0)} KB)`);
console.log('\n' + JSON.stringify(scenarios));

proc.kill();
server.close();
process.exit(0);
