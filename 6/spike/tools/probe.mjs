/**
 * spike/tools/probe.mjs — focused geometry probe: is the painted canvas
 * actually at the current zoom, and do text spans land on the glyphs?
 * Prints numbers only, so a mismatch is unambiguous.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SPIKE_DIR = path.resolve(HERE, '..');
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
  } catch { res.writeHead(404).end('404'); }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

function findBrowser() {
  const pw = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  if (existsSync(pw)) for (const n of readdirSync(pw).sort().reverse())
    for (const c of [path.join(pw, n, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
      path.join(pw, n, 'chrome-win64', 'chrome.exe')]) if (existsSync(c)) return c;
  throw new Error('no browser');
}
const proc = spawn(findBrowser(), ['--headless=new', '--remote-debugging-port=0', '--no-first-run',
  '--disable-gpu', '--window-size=1400,900', `--user-data-dir=${path.join(os.tmpdir(), 'probe-' + Date.now())}`,
  'about:blank'], { stdio: ['ignore', 'pipe', 'pipe'] });
let stderr = '';
const wsUrl = await new Promise((resolve, reject) => {
  proc.stderr.on('data', (c) => { stderr += c; const m = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderr); if (m) resolve(m[1]); });
  setTimeout(() => reject(new Error('no ws: ' + stderr)), 20000);
});
const ws = new WebSocket(wsUrl);
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0; const pending = new Map(); const errs = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
  if (msg.method === 'Runtime.exceptionThrown') errs.push(msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text);
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const i = ++id;
  pending.set(i, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { targetId } = await send('Target.createTarget', { url: origin + '/index.html' });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
const ev = async (expression) => {
  const res = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (res.exceptionDetails) throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text);
  return res.result?.value;
};
for (let i = 0; i < 80; i++) { if (await ev('!!window.__spikeReady')) break; await sleep(200); }

const PROBE = `(() => {
  const div = document.querySelector('.pr-page[data-page="1"]');
  const canvas = div.querySelector('canvas');
  const wrap = div.querySelector('.pr-canvas-wrap');
  const text = div.querySelector('.textLayer');
  const pageBox = div.getBoundingClientRect();
  const canvasBox = canvas.getBoundingClientRect();
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  // Bounding box of non-white pixels in the canvas bitmap.
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let minX = Infinity, minY = Infinity, maxX = -1, maxY = -1;
  for (let y = 0; y < canvas.height; y += 2) {
    for (let x = 0; x < canvas.width; x += 2) {
      const i = (y * canvas.width + x) * 4;
      if (img[i] < 240 || img[i+1] < 240 || img[i+2] < 240) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  const spans = [...text.querySelectorAll('span')].filter((s) => s.textContent.trim());
  const s0 = spans.find((s) => s.textContent.includes('Paper Reader Spike'));
  const s0box = s0 ? s0.getBoundingClientRect() : null;
  return {
    zoom: window.__reader.getScale(),
    pageCss: { w: pageBox.width, h: pageBox.height },
    canvasBitmap: { w: canvas.width, h: canvas.height },
    canvasCss: { w: canvasBox.width, h: canvasBox.height },
    wrapCss: { w: wrap.getBoundingClientRect().width, h: wrap.getBoundingClientRect().height },
    inkBoxBitmap: { minX, minY, maxX, maxY },
    inkBoxCssUnscaled: {
      left: (minX / canvas.width) * canvasBox.width,
      top: (minY / canvas.height) * canvasBox.height,
      right: (maxX / canvas.width) * canvasBox.width,
      bottom: (maxY / canvas.height) * canvasBox.height,
    },
    spanBoxCss: s0box ? { l: s0box.left - pageBox.left, t: s0box.top - pageBox.top, w: s0box.width, h: s0box.height } : null,
    totalScale: getComputedStyle(div).getPropertyValue('--total-scale-factor').trim(),
  };
})()`;

async function report(label) {
  const v = await ev(PROBE);
  console.log(`\n=== ${label} ===`);
  console.log(JSON.stringify(v, null, 2));
  if (v.spanBoxCss && v.inkBoxBitmap.maxX > 0) {
    // Compare the first text span's CSS box to the ink box of that line.
    const ink = v.inkBoxCssUnscaled;
    console.log(`span#0 css ${JSON.stringify(v.spanBoxCss)}  vs ink(top-left) ${JSON.stringify({ left: ink.left, top: ink.top })}`);
    console.log(`bitmap/expected-px ratio: ${(v.canvasBitmap.w / (v.pageCss.w * (globalThis.__dp || 1))).toFixed(3)}`);
  }
}

await report('after open + fitWidth(1)');
await ev('window.__reader.setScale(1.15, { anchorPageNumber: 1 })');
await sleep(1500);
await report('after setScale(1.15)');
await ev('window.__reader.setScale(1.15, { anchorPageNumber: 1 })');
await sleep(1000);
await report('after redundant setScale(1.15)');
await ev('window.__reader.fitWidth(1); window.__reader.setScale(2, { anchorPageNumber: 1 })');
await sleep(1800);
await report('after fitWidth then immediate setScale(2)');
if (errs.length) console.log('\nEXCEPTIONS:', errs);
proc.kill(); server.close(); process.exit(0);
