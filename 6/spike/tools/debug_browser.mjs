/**
 * Ad-hoc diagnostic (not part of the verification suite):
 * shows what the browser really loaded, all console output (incl. warnings),
 * and whether pdf.js ran a real module worker or fell back to a fake worker.
 *
 * node spike/tools/debug_browser.mjs
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
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.icc': 'application/octet-stream',
};

const served = [];
const server = createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let p = path.join(SPIKE_DIR, decodeURIComponent(url.pathname));
  if (p.endsWith('/')) p = path.join(p, 'index.html');
  try {
    const info = await stat(p);
    if (info.isDirectory()) p = path.join(p, 'index.html');
    const body = await readFile(p);
    served.push({ path: url.pathname, size: body.length, type: MIME[path.extname(p)] || '?' });
    res.writeHead(200, { 'Content-Type': MIME[path.extname(p)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(body);
  } catch (err) {
    served.push({ path: url.pathname, status: 404 });
    res.writeHead(404).end(String(err.message));
  }
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const origin = `http://127.0.0.1:${server.address().port}`;

function findBrowser() {
  const pw = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'ms-playwright');
  if (existsSync(pw)) {
    for (const name of readdirSync(pw).sort().reverse()) {
      const candidates = [
        path.join(pw, name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
        path.join(pw, name, 'chrome-win64', 'chrome.exe'),
      ];
      for (const c of candidates) if (existsSync(c)) return c;
    }
  }
  throw new Error('no browser');
}

const userDataDir = path.join(os.tmpdir(), `spike-debug-${Date.now()}`);
const proc = spawn(findBrowser(), [
  '--headless=new', '--remote-debugging-port=0', '--no-first-run', '--disable-gpu',
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
const logs = [];
const targets = [];
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
  if (msg.method === 'Runtime.consoleAPICalled') {
    logs.push(`${msg.params.type}: ` + (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' '));
  }
  if (msg.method === 'Runtime.exceptionThrown') {
    logs.push('EXCEPTION: ' + (msg.params.exceptionDetails?.exception?.description || msg.params.exceptionDetails?.text));
  }
  if (msg.method === 'Target.targetCreated') targets.push(msg.params.targetInfo);
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const i = ++id;
  pending.set(i, (msg) => (msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)));
  ws.send(JSON.stringify({ id: i, method, params, ...(sessionId ? { sessionId } : {}) }));
});

const { targetId } = await send('Target.createTarget', { url: `${origin}/index.html` });
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
await send('Page.enable', {}, sessionId);
await send('Runtime.enable', {}, sessionId);
await send('Target.setDiscoverTargets', { discover: true }, sessionId).catch(() => {});
await new Promise((r) => setTimeout(r, 4000));
const evalResult = await send('Runtime.evaluate', {
  expression: `(async () => {
    const lib = await import('./vendor/build/pdf.min.mjs');
    return {
      workerSrc: lib.GlobalWorkerOptions.workerSrc,
      errors: window.__spikeErrors,
      ready: window.__spikeReady,
      state: window.__reader ? window.__reader.getDebugState() : null,
      fonts: [...document.fonts].map(f => f.family + ':' + f.status),
    };
  })()`,
  awaitPromise: true, returnByValue: true,
}, sessionId);
console.log('--- evaluate ---');
console.log(JSON.stringify(evalResult.result?.value, null, 2));
console.log('--- console output ---');
for (const line of logs) console.log(line);
console.log('--- served by the local static server ---');
for (const s of served) console.log(`${s.status || 200} ${s.path} (${s.size || 0} bytes, ${s.type || ''})`);
console.log('--- worker-ish targets ---');
for (const t of targets) console.log(`${t.type} ${t.url}`);
proc.kill();
server.close();
process.exit(0);
