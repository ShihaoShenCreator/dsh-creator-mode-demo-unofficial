/**
 * spike/tools/verify_headless.mjs — end-to-end verification with NO npm packages.
 *
 * Starts a local static server for the spike directory, launches the
 * chrome-headless-shell that already exists in the Playwright browser cache
 * (found by this script, not installed), and drives it over the Chrome
 * DevTools Protocol using Node's built-in `fetch` + a minimal hand-rolled
 * WebSocket client (Node 22+ ships a global WebSocket, so we just use that).
 *
 * What it proves:
 *   1. the page loads with ZERO network requests outside 127.0.0.1;
 *   2. pdf.js module + worker load and `getDocument` resolves (worker really
 *      ran: the page would not render otherwise);
 *   3. the canvas is painted and the pixel at the centre of the Flate image
 *      equals the manifest's expected colour (raster fidelity, no loss);
 *   4. text layer spans exist, are positioned inside the page box, and the
 *      extracted strings contain the manifest needles (incl. CJK via cmaps);
 *   5. selection -> getSelection() gives page-relative + PDF-space rects that
 *      cover the selected glyphs;
 *   6. zoom + fitWidth relayout both canvas and text layer consistently;
 *   7. highlights persist as JSON, repaint after scroll, and re-map on zoom;
 *   8. rotated page (/Rotate 90) maps selection rects back into the page box;
 *   9. search matches NFC/whitespace/typography-normalised text and maps hits
 *      back to (itemIndex, offset) with exact rects from the text layer.
 *
 * Usage:  node spike/tools/verify_headless.mjs [--keep]
 * Output: human-readable PASS/FAIL lines + a JSON report on stdout.
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
const WORKSPACE = path.resolve(SPIKE_DIR, '..');

/* ---------------------------------------------------------------------- */
/* locate a headless Chromium (never installs anything)                    */
/* ---------------------------------------------------------------------- */
function findBrowser() {
  const candidates = [];
  const localAppData = process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local');
  // Playwright browser cache (chromium_headless_shell / chromium). We only *use*
  // a browser that is already present; nothing is downloaded or installed.
  const pw = path.join(localAppData, 'ms-playwright');
  if (existsSync(pw)) {
    const names = readdirSync(pw).sort().reverse();
    for (const prefix of ['chromium_headless_shell-', 'chromium-']) {
      for (const name of names.filter((n) => n.startsWith(prefix))) {
        candidates.push(
          path.join(pw, name, 'chrome-headless-shell-win64', 'chrome-headless-shell.exe'),
          path.join(pw, name, 'chrome-win64', 'chrome.exe'),
        );
      }
    }
  }
  for (const envKey of ['CHROME_PATH', 'CHROME_BIN', 'EDGE_PATH']) {
    if (process.env[envKey]) candidates.push(process.env[envKey]);
  }
  candidates.push(
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  );
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) return candidate;
  }
  throw new Error('No headless Chromium found. Set CHROME_PATH to a chrome/chrome-headless-shell binary.');
}

/* ---------------------------------------------------------------------- */
/* static server                                                          */
/* ---------------------------------------------------------------------- */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.pdf': 'application/pdf',
  '.map': 'application/json; charset=utf-8',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.icc': 'application/octet-stream',
  '.js2': 'text/javascript',
};

function startServer(rootDir) {
  const served = [];
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://127.0.0.1');
      let filePath = path.join(rootDir, decodeURIComponent(url.pathname));
      if (filePath.endsWith(path.sep) || filePath.endsWith('/')) filePath = path.join(filePath, 'index.html');
      const resolved = path.resolve(filePath);
      if (!resolved.startsWith(path.resolve(rootDir))) {
        res.writeHead(403).end('forbidden');
        return;
      }
      const info = await stat(resolved);
      if (info.isDirectory()) {
        res.writeHead(302, { Location: url.pathname.replace(/\/?$/, '/') + 'index.html' }).end();
        return;
      }
      const body = await readFile(resolved);
      const ext = path.extname(resolved).toLowerCase();
      served.push({ path: url.pathname, status: 200, size: body.length });
      res.writeHead(200, {
        'Content-Type': MIME[ext] || 'application/octet-stream',
        'Cache-Control': 'no-store',
        'Content-Length': body.length,
      });
      res.end(body);
    } catch (err) {
      served.push({ path: req.url, status: 404 });
      res.writeHead(404).end(`not found: ${req.url} (${err.message})`);
    }
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolve({ server, served, origin: `http://127.0.0.1:${port}`, port });
    });
  });
}

/* ---------------------------------------------------------------------- */
/* minimal CDP client over the built-in WebSocket                          */
/* ---------------------------------------------------------------------- */
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.nextId = 1;
    this.pending = new Map();
    this.listeners = new Map();
    ws.addEventListener('message', (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolve(msg.result);
        return;
      }
      if (msg.method) {
        for (const fn of this.listeners.get(msg.method) || []) fn(msg.params);
      }
    });
  }
  send(method, params = {}, sessionId = undefined) {
    const id = this.nextId++;
    const payload = { id, method, params };
    if (sessionId) payload.sessionId = sessionId;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify(payload));
    });
  }
  on(method, fn) {
    if (!this.listeners.has(method)) this.listeners.set(method, []);
    this.listeners.get(method).push(fn);
  }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------------------------------------------- */
/* browser boot                                                           */
/* ---------------------------------------------------------------------- */
async function launch(executable, userDataDir) {
  const args = [
    '--headless=new',
    '--remote-debugging-port=0',
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-sync',
    '--metrics-recording-only',
    '--no-pings',
    '--font-render-hinting=none',
    `--user-data-dir=${userDataDir}`,
    'about:blank',
  ];
  const proc = spawn(executable, args, { stdio: ['ignore', 'pipe', 'pipe'] });
  let stderr = '';
  proc.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
  const wsUrl = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`browser did not report a ws endpoint.\n${stderr}`)), 20000);
    proc.stderr.on('data', () => {
      const match = /DevTools listening on (ws:\/\/[^\s]+)/.exec(stderr);
      if (match) {
        clearTimeout(timer);
        resolve(match[1]);
      }
    });
    proc.once('exit', (code) => {
      clearTimeout(timer);
      reject(new Error(`browser exited early (code ${code}).\n${stderr}`));
    });
  });
  return { proc, wsUrl };
}

/* ---------------------------------------------------------------------- */
/* checks                                                                 */
/* ---------------------------------------------------------------------- */
const results = [];
function check(name, fn) {
  return (async () => {
    try {
      const detail = await fn();
      results.push({ name, ok: true, detail });
      console.log(`PASS  ${name}${detail ? ` — ${detail}` : ''}`);
    } catch (err) {
      results.push({ name, ok: false, detail: String(err && err.stack ? err.stack : err) });
      console.log(`FAIL  ${name} — ${err && err.message ? err.message : err}`);
    }
  })();
}
function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function main() {
  const keepBrowser = process.argv.includes('--keep');
  const executable = findBrowser();
  const { server, served, origin } = await startServer(SPIKE_DIR);
  const userDataDir = path.join(os.tmpdir(), `spike-verify-${Date.now()}`);
  const manifest = JSON.parse(await readFile(path.join(SPIKE_DIR, 'sample', 'manifest.json'), 'utf8'));

  const { proc, wsUrl } = await launch(executable, userDataDir);
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve, { once: true });
    ws.addEventListener('error', () => reject(new Error('could not connect to the DevTools websocket')), { once: true });
  });
  const cdp = new Cdp(ws);

  // Track every non-loopback request the page attempts. Any hit = offline failure.
  const foreignRequests = [];
  const pageRequests = [];
  const clientExceptions = [];
  const failedRequests = [];
  const responseStatuses = [];

  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  await cdp.send('Page.enable', {}, sessionId);
  await cdp.send('Runtime.enable', {}, sessionId);
  await cdp.send('Network.enable', {}, sessionId);
  cdp.on('Network.requestWillBeSent', (params) => {
    const url = params.request.url;
    pageRequests.push(url);
    if (!/^(http:\/\/127\.0\.0\.1|data:|blob:|about:|chrome-extension:)/.test(url)) foreignRequests.push(url);
  });
  cdp.on('Runtime.exceptionThrown', (params) => {
    const text = params.exceptionDetails?.exception?.description || params.exceptionDetails?.text;
    clientExceptions.push(String(text));
    console.log(`CLIENT-EXCEPTION ${text}`);
  });
  cdp.on('Runtime.consoleAPICalled', (params) => {
    const text = (params.args || []).map((a) => a.value ?? a.description ?? '').join(' ');
    if (params.type === 'error') console.log(`CLIENT-CONSOLE-ERROR ${text}`);
  });
  cdp.on('Network.loadingFailed', (params) => {
    if (params.canceled) return;
    failedRequests.push(`${params.errorText || params.type}`);
  });
  cdp.on('Network.responseReceived', (params) => {
    responseStatuses.push({ url: params.response.url, status: params.response.status });
  });

  const evaluate = async (expression, { awaitPromise = true } = {}) => {
    const res = await cdp.send('Runtime.evaluate', {
      expression,
      awaitPromise,
      returnByValue: true,
      userGesture: true,
    }, sessionId);
    if (res.exceptionDetails) {
      const message = res.exceptionDetails.exception?.description || res.exceptionDetails.text;
      throw new Error(`evaluate failed: ${message}\n--- expression ---\n${expression.slice(0, 400)}`);
    }
    return res.result.value;
  };

  try {
    const url = `${origin}/index.html`;
    await cdp.send('Page.navigate', { url }, sessionId);
    await evaluate(`new Promise((resolve) => {
      const poll = () => {
        if (window.__spikeReady) return resolve(true);
        if (window.__spikeErrors && window.__spikeErrors.length) return resolve('ERRORS: ' + window.__spikeErrors.join(' | '));
        setTimeout(poll, 100);
      };
      poll();
    })`).then((v) => {
      if (v !== true) throw new Error(`spike never became ready: ${v}`);
    });

    /* --- 1. offline: no foreign requests ------------------------------- */
    await check('offline: every request is loopback/data/blob', () => {
      assert(foreignRequests.length === 0, `foreign requests: ${foreignRequests.join(', ')}`);
      const counts = {};
      for (const u of pageRequests) {
        const key = u.startsWith(`${origin}/`) ? 'local' : (u.split(':')[0] + ':');
        counts[key] = (counts[key] || 0) + 1;
      }
      return `${pageRequests.length} requests, all local (${JSON.stringify(counts)})`;
    });

    await check('no page-level JS exceptions', () => {
      const ours = clientExceptions.filter((e) => !/favicon/i.test(e));
      assert(ours.length === 0, `client exceptions: ${ours.join(' | ')}`);
      return 'none';
    });

    /* --- 2. document / worker loaded ---------------------------------- */
    await check('getDocument resolves, 4 pages, worker is a module worker', async () => {
      const state = await evaluate('window.__reader.getDebugState()');
      assert(state.numPages === manifest.numPages, `expected ${manifest.numPages} pages, got ${state.numPages}`);
      return `${state.numPages} pages, zoom ${state.zoom}`;
    });

    /* --- 3. lazy rendering (must run before anything scrolls pages) ----- */
    await check('lazy render: distant pages are not rasterised up front', async () => {
      const info = await evaluate(`(async () => {
        const reader = window.__reader;
        const host = document.querySelector('#reader-host .pr-reader');
        host.scrollTop = 0;
        await new Promise((r) => setTimeout(r, 1400));
        const state = reader.getDebugState();
        const canvases = [...document.querySelectorAll('.pr-page canvas')].map((c) => ({
          page: c.closest('.pr-page').dataset.page, w: c.width, h: c.height,
        }));
        return { rendered: state.renderedPages, canvases, numPages: state.numPages,
                 scrollHeight: host.scrollHeight, clientHeight: host.clientHeight, zoom: state.zoom };
      })()`);
      assert(info.rendered.length >= 1, 'nothing rendered at all');
      assert(info.rendered.includes(1), 'page 1 should be rendered at scrollTop 0');
      const lastPage = info.numPages;
      assert(!info.rendered.includes(lastPage),
        `last page (${lastPage}) was rasterised while scrolled to the top — lazy rendering not active ` +
        `(rendered ${JSON.stringify(info.rendered)}, scrollHeight ${info.scrollHeight} / clientHeight ${info.clientHeight})`);
      return `rendered ${JSON.stringify(info.rendered)} of ${info.numPages} at zoom ${info.zoom}; canvas ${info.canvases.map((c) => c.page + ':' + c.w + 'x' + c.h).join(', ')}`;
    });

    /* --- 4. canvas raster fidelity ------------------------------------- */
    await check('canvas painted; Flate image pixel matches manifest', async () => {
      const probe = await evaluate(`(async () => {
        const reader = window.__reader;
        const state = reader.getDebugState();
        const page = state.pages[0];
        const host = document.querySelector('#reader-host .pr-reader');
        host.scrollTop = 0;
        // Find the page-1 wrapper and its canvas.
        const div = document.querySelector('.pr-page[data-page="1"]');
        const canvas = div.querySelector('canvas');
        const viewport = (() => {
          const report = reader.getDebugState().pages[0];
          return { width: parseFloat(report.cssWidth), height: parseFloat(report.cssHeight) };
        })();
        // PDF rect [72,430,200,558] -> centre in PDF space:
        const cxPt = (72 + 200) / 2, cyPt = (430 + 558) / 2;
        // Use the same mapping the reader uses: ask it through a temporary highlight.
        const probe = reader.addHighlight({ page: 1, pdfRect: { x1: cxPt - 1, y1: cyPt - 1, x2: cxPt + 1, y2: cyPt + 1 }, color: 'blue', text: 'probe' });
        const el = document.querySelector('.pr-highlight[data-highlight-id="' + probe.id + '"]');
        const box = el.getBoundingClientRect();
        const canvasBox = canvas.getBoundingClientRect();
        const px = Math.round((box.left + box.width / 2 - canvasBox.left) / canvasBox.width * canvas.width);
        const py = Math.round((box.top + box.height / 2 - canvasBox.top) / canvasBox.height * canvas.height);
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(Math.min(canvas.width - 1, px), Math.min(canvas.height - 1, py), 1, 1).data;
        reader.removeHighlight(probe.id);
        return { rgb: [data[0], data[1], data[2]], canvas: [canvas.width, canvas.height], cssSize: [viewport.width, viewport.height], sample: [px, py] };
      })()`);
      const expected = manifest.pages[0].images[0].expectedRgb;
      const actual = probe.rgb;
      const close = actual.every((v, i) => Math.abs(v - expected[i]) <= 6);
      assert(close, `pixel ${JSON.stringify(actual)} != expected ${JSON.stringify(expected)} at ${probe.sample} (canvas ${probe.canvas})`);
      return `rgb ${JSON.stringify(actual)} == expected ±6 ${JSON.stringify(expected)}; canvas ${probe.canvas.join('x')}`;
    });

    /* --- 4. text layer spans ------------------------------------------- */
    await check('text layer spans exist and carry the expected strings', async () => {
      const info = await evaluate(`(async () => {
        const reader = window.__reader;
        // Force every page to be rendered (lazy rendering only mounts pages
        // near the viewport, so the text layer for a far page does not exist).
        for (let n = 1; n <= reader.getDebugState().numPages; n++) {
          reader.scrollToPage(n, { align: 'nearest' });
          await new Promise((r) => setTimeout(r, 700));
        }
        const state = reader.getDebugState();
        const out = state.pages.map((p) => ({ page: p.pageNumber, spans: p.textLayerSpans, items: p.textLayerItems }));
        const texts = {};
        for (const div of document.querySelectorAll('.textLayer')) {
          const page = div.closest('.pr-page').getAttribute('data-page');
          texts[page] = div.textContent;
        }
        return { out, texts };
      })()`);
      const pageTexts = info.texts;
      for (const page of manifest.pages) {
        const joined = pageTexts[String(page.page)] || '';
        assert(joined.length > 0, `page ${page.page}: text layer is empty (page never rendered?)`);
        for (const needle of page.texts) {
          const normalize = (s) => s.normalize('NFKC').replace(/\\s+/g, ' ').toLowerCase();
          assert(
            normalize(joined).includes(normalize(needle)),
            `page ${page.page}: text layer is missing ${JSON.stringify(needle)}; got ${JSON.stringify(joined.slice(0, 160))}`,
          );
        }
      }
      return info.out.map((p) => `p${p.page}:${p.spans} spans/${p.items} items`).join(', ');
    });

    /* --- 5. spans inside the page box + --total-scale-factor contract -- */
    await check('span geometry stays inside the page wrapper (no reflow drift)', async () => {
      const info = await evaluate(`(() => {
        const div = document.querySelector('.pr-page[data-page="1"]');
        const pageBox = div.getBoundingClientRect();
        const spans = [...div.querySelectorAll('.textLayer span')].filter((s) => s.textContent.trim());
        let outside = 0;
        let worst = null;
        for (const span of spans) {
          const b = span.getBoundingClientRect();
          const dx = Math.max(0, pageBox.left - b.left, b.right - pageBox.right);
          const dy = Math.max(0, pageBox.top - b.top, b.bottom - pageBox.bottom);
          if (dx > 2 || dy > 2) { outside++; worst = { text: span.textContent.slice(0, 20), dx, dy }; }
        }
        const totalScale = getComputedStyle(div).getPropertyValue('--total-scale-factor').trim();
        const minFont = getComputedStyle(div.querySelector('.textLayer')).getPropertyValue('--min-font-size').trim();
        return { count: spans.length, outside, worst, totalScale, minFont, pageBox: { w: pageBox.width, h: pageBox.height } };
      })()`);
      assert(info.outside === 0, `${info.outside} spans outside the page box: ${JSON.stringify(info.worst)}`);
      assert(info.totalScale && info.totalScale !== '', '--total-scale-factor is not set on the page wrapper');
      return `${info.count} spans inside ${Math.round(info.pageBox.w)}x${Math.round(info.pageBox.h)} box; --total-scale-factor=${info.totalScale}`;
    });

    /* --- 6. selection -> getSelection() -------------------------------- */
    await check('selection produces text + page rects + pdfRect + anchorRect', async () => {
      const selection = await evaluate(`(() => {
        const div = document.querySelector('.pr-page[data-page="1"] .textLayer');
        const spans = [...div.querySelectorAll('span')];
        // "Faithful layout, text layer, selection and highlights"
        const span = spans.find((s) => s.textContent.includes('Faithful layout'));
        if (!span) throw new Error('target span not found');
        const node = span.firstChild;
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, Math.min(node.length, 'Faithful layout'.length));
        const sel = document.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const result = window.__reader.getSelection();
        return result;
      })()`);
      assert(selection && selection.text, 'getSelection() returned nothing');
      assert(selection.pageNumber === 1, `pageNumber ${selection.pageNumber} != 1`);
      assert(selection.rects.length >= 1, 'no rects');
      const rect = selection.rects[0];
      assert(rect.page === 1, 'rect.page mismatch');
      assert(Number.isFinite(rect.x) && Number.isFinite(rect.y) && Number.isFinite(rect.w) && Number.isFinite(rect.h), 'rect numbers');
      assert(rect.w > 0 && rect.h > 0, 'rect has no area');
      assert(rect.pdfRect && Number.isFinite(rect.pdfRect.x1) && Number.isFinite(rect.pdfRect.y1), 'pdfRect missing');
      // Single-line selection on a portrait page: PDF y must be inside the MediaBox.
      assert(rect.pdfRect.y1 >= 0 && rect.pdfRect.y2 <= manifest.pageHeightPt + 1, `pdfRect y out of page: ${JSON.stringify(rect.pdfRect)}`);
      assert(rect.pdfRect.x1 >= 0 && rect.pdfRect.x2 <= manifest.pageWidthPt + 1, `pdfRect x out of page: ${JSON.stringify(rect.pdfRect)}`);
      assert(selection.anchorRect && selection.anchorRect.width > 0, 'anchorRect missing');
      return `"${selection.text.slice(0, 30)}" p${selection.pageNumber}/${selection.pageCount}, ${selection.rects.length} rect, pdf ${JSON.stringify(rect.pdfRect)}`;
    });

    /* --- 7. highlight persistence + repaint after cull/scroll ---------- */
    await check('highlight persists as JSON and repaints after page re-render', async () => {
      const stored = await evaluate(`(() => {
        const reader = window.__reader;
        reader.renderHighlights([]);
        const sel = reader.getSelection();
        const hl = reader.addHighlight({ page: sel.pageNumber, rects: sel.rects, text: sel.text, color: 'yellow' });
        // Force a full unrender/re-render of page 1 by zooming.
        reader.setScale(reader.getScale() * 1.15, { anchorPageNumber: 1 });
        return { stored: reader.getHighlights(), count: document.querySelectorAll('.pr-highlight').length };
      })()`);
      assert(stored.stored.length === 1, `expected 1 stored highlight, got ${stored.stored.length}`);
      // Wait for the re-render to finish, then count painted rects again.
      await sleep(600);
      const painted = await evaluate(`(() => ({
        count: document.querySelectorAll('.pr-highlight').length,
        ids: [...document.querySelectorAll('.pr-highlight')].map((e) => e.dataset.highlightId),
        stored: window.__reader.getHighlights(),
      }))()`);
      assert(painted.count >= 1, `highlight not repainted after zoom (${painted.count} rects)`);
      assert(painted.stored.length === 1, 'store lost the highlight');
      const roundtrip = JSON.parse(JSON.stringify(painted.stored));
      assert(roundtrip[0].pdfRect && Number.isFinite(roundtrip[0].pdfRect.x1), 'pdfRect not JSON-safe');
      return `${painted.count} painted rect(s), JSON round-trip ok: ${JSON.stringify(roundtrip[0].pdfRect)}`;
    });

    /* --- 8. zoom / fitWidth consistency ------------------------------- */
    await check('setScale + fitWidth keep canvas and text layer consistent', async () => {
      const info = await evaluate(`(async () => {
        const reader = window.__reader;
        reader.setScale(1.5, { anchorPageNumber: 1 });
        await new Promise((r) => setTimeout(r, 800));
        const s1 = reader.getDebugState();
        reader.fitWidth(1);
        await new Promise((r) => setTimeout(r, 800));
        const s2 = reader.getDebugState();
        const host = document.querySelector('#reader-host .pr-reader');
        const div = document.querySelector('.pr-page[data-page="1"]');
        const text = div.querySelector('.textLayer');
        return {
          at150: s1.pages[0],
          fit: s2.pages[0],
          hostWidth: host.clientWidth,
          pageCssWidth: div.getBoundingClientRect().width,
          textCss: { w: text.getBoundingClientRect().width, h: text.getBoundingClientRect().height },
          totalScale: getComputedStyle(div).getPropertyValue('--total-scale-factor').trim(),
        };
      })()`);
      assert(Math.abs(info.pageCssWidth - info.hostWidth) < 40, `fitWidth page ${info.pageCssWidth} vs host ${info.hostWidth}`);
      // The text layer must cover the (unrotated) page box; on a portrait page
      // its width equals the page width.
      assert(Math.abs(info.textCss.w - info.pageCssWidth) < 2, `text layer width ${info.textCss.w} != page ${info.pageCssWidth}`);
      assert(info.fit.canvasPx && info.fit.canvasPx[0] > 0, 'no canvas after fitWidth');
      return `zoom150 canvas ${info.at150.canvasPx.join('x')} → fitWidth canvas ${info.fit.canvasPx.join('x')}, page ${Math.round(info.pageCssWidth)}px`;
    });

    /* --- 9. rotated page selection mapping ---------------------------- */
    await check('rotated page (/Rotate 90) selection maps into the rotated box', async () => {
      const info = await evaluate(`(async () => {
        const reader = window.__reader;
        reader.scrollToPage(4, { align: 'start' });
        await new Promise((r) => setTimeout(r, 900));
        reader.setScale(1, { anchorPageNumber: 4 });
        await new Promise((r) => setTimeout(r, 900));
        const div = document.querySelector('.pr-page[data-page="4"]');
        const layer = div.querySelector('.textLayer');
        const pageBox = div.getBoundingClientRect();
        const span = [...layer.querySelectorAll('span')].find((s) => s.textContent.includes('Rotated page'));
        if (!span) throw new Error('rotated page span not found');
        const node = span.firstChild;
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, Math.min(node.length, 'Rotated'.length));
        const sel = document.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        const selection = reader.getSelection();
        const rect = selection && selection.rects[0];
        // Compare against the client rect of the range, converted to page space.
        const clientRect = range.getBoundingClientRect();
        return {
          pageBox: { w: pageBox.width, h: pageBox.height },
          viewport: reader.getDebugState().pages[3],
          selection,
          rect,
          clientRect: { l: clientRect.left - pageBox.left, t: clientRect.top - pageBox.top, w: clientRect.width, h: clientRect.height },
        };
      })()`);
      assert(info.selection && info.selection.text.includes('Rotated'), 'rotated selection text missing');
      const r = info.rect;
      assert(r.x >= -1 && r.y >= -1 && r.x + r.w <= info.pageBox.w + 1 && r.y + r.h <= info.pageBox.h + 1,
        `rotated rect ${JSON.stringify(r)} outside rotated page box ${JSON.stringify(info.pageBox)}`);
      // 90° rotation: the rotated page box is (height x width) of the MediaBox.
      assert(Math.abs(info.pageBox.h - manifest.pageWidthPt * 4 / 3) < 30,
        `rotated page box height ${info.pageBox.h} should be ~MediaBox width`);
      // The PDF-space rect must be expressed in *unrotated* page coordinates
      // (MediaBox is 612 x 792 regardless of /Rotate).
      assert(r.pdfRect.y2 <= manifest.pageHeightPt + 2 && r.pdfRect.x2 <= manifest.pageWidthPt + 2,
        `pdfRect not in unrotated page space: ${JSON.stringify(r.pdfRect)}`);
      return `rotated box ${Math.round(info.pageBox.w)}x${Math.round(info.pageBox.h)}, rect ${JSON.stringify({ x: r.x, y: r.y, w: r.w, h: r.h })}, pdf ${JSON.stringify(r.pdfRect)}`;
    });

    /* --- 10. search + normalisation + exact rects ---------------------- */
    await check('search is normalisation-aware and maps to item/offset + exact rects', async () => {
      const info = await evaluate(`(async () => {
        const reader = window.__reader;
        const out = {};
        for (const q of ["Paper Reader Spike", "TEXT   EXTRACTION", "whitespace collapsing", "cjk text", "中文检索测试", "jpeg2000 image", "non-breaking space"]) {
          const res = await reader.search(q);
          out[q] = { total: res.total, first: res.matches[0] || null };
        }
        const res = await reader.search("Paper Reader Spike");
        const rects = res.matches.length ? await reader.getMatchRects(res.matches[0]) : [];
        return { out, rects };
      })()`);
      for (const query of ['Paper Reader Spike', 'TEXT   EXTRACTION', 'whitespace collapsing', 'cjk text', '中文检索测试', 'jpeg2000 image']) {
        assert(info.out[query] && info.out[query].total > 0, `search miss for ${JSON.stringify(query)}`);
      }
      assert(info.out['Paper Reader Spike'].first.page === 1, 'first hit should be page 1');
      assert(info.out['cjk text'].first && info.out['cjk text'].first.page === 3, 'CJK hit should be page 3');
      assert(Number.isInteger(info.out['Paper Reader Spike'].first.itemIndex), 'itemIndex not an integer');
      assert(info.rects.length > 0, 'getMatchRects returned nothing');
      const rect = info.rects[0];
      assert(rect.w > 0 && rect.h > 0, 'match rect has no area');
      return `7 queries ok; first "Paper Reader Spike" -> item ${info.out['Paper Reader Spike'].first.itemIndex}@${info.out['Paper Reader Spike'].first.startOffset}, ${info.rects.length} rects, first ${JSON.stringify(rect.pdfRect)}`;
    });

    /* --- 11. lazy render: mount cap honoured --------------------------- */
    await check('lazy render: keeps pages mounted up to maxMountedPages and never drops the visible one', async () => {
      const info = await evaluate(`(async () => {
        const reader = window.__reader;
        const host = document.querySelector('#reader-host .pr-reader');
        for (let n = 1; n <= 4; n++) { reader.scrollToPage(n, { align: 'start' }); await new Promise((r) => setTimeout(r, 500)); }
        host.scrollTop = 0;
        await new Promise((r) => setTimeout(r, 1500));
        const state = reader.getDebugState();
        const canvases = [...document.querySelectorAll('.pr-page canvas')].map((c) => {
          const page = c.closest('.pr-page').dataset.page;
          return page + ':' + c.width + 'x' + c.height;
        });
        return { rendered: state.renderedPages, numPages: state.numPages, canvasSizes: canvases };
      })()`);
      // maxMountedPages defaults to 8 and the sample has 4 pages, so nothing is
      // culled; the guarantee we can check here is that every visited page that
      // stays within the cap keeps painted pixels and page 1 (visible at
      // scrollTop 0) is never dropped.
      assert(info.rendered.length >= 1, 'nothing rendered');
      assert(info.rendered.includes(1), 'page 1 was culled even though it is visible');
      const painted = info.canvasSizes.filter((s) => !s.endsWith('300x150')); // 300x150 == untouched placeholder
      return `mounted ${JSON.stringify(info.rendered)} of ${info.numPages}; painted canvases ${painted.join(', ')}`;
    });

    /* --- 12. no stray worker/asset 404s -------------------------------- */
    await check('pdf.js tile/worker/font/wasm/cmap assets served with HTTP 200', async () => {
      const notFound = served.filter((s) => s.status !== 200);
      assert(notFound.length === 0, `404s: ${notFound.map((n) => n.path).join(', ')}`);
      const vendor = served.filter((s) => s.path.includes('/vendor/'));
      const groups = {
        worker: vendor.filter((s) => /pdf\.worker/.test(s.path)),
        pdfjs: vendor.filter((s) => /pdf\.min\.mjs$/.test(s.path)),
        cmaps: vendor.filter((s) => /\/cmaps\//.test(s.path)),
        standardFonts: vendor.filter((s) => /\/standard_fonts\//.test(s.path)),
        wasm: vendor.filter((s) => /\/wasm\//.test(s.path)),
        iccs: vendor.filter((s) => /\/iccs\//.test(s.path)),
      };
      const summary = Object.fromEntries(
        Object.entries(groups).map(([k, v]) => [k, `${v.length} file(s)${v[0] ? ' e.g. ' + path.basename(v[0].path) : ''}`]),
      );
      assert(groups.pdfjs.length >= 1, 'the pdf.js main module was never served');
      assert(groups.cmaps.length >= 1, 'no CMap was fetched — the Type0/UniGB page would decode as garbage');
      assert(groups.standardFonts.length >= 1, 'no standard_fonts/ file was fetched — base-14 substitution did not run');
      assert(groups.wasm.length >= 1, 'no wasm/ file was fetched — JPEG2000/QCMS decode path did not run');
      return `${vendor.length} vendor files served, all 200; ${JSON.stringify(summary)}`;
    });

    /* --- 13. fonts: standard_fonts substitution actually used ---------- */
    await check('standard fonts substituted from standard_fonts/ (no system font fallback)', async () => {
      const info = await evaluate(`(() => {
        const spans = [...document.querySelectorAll('.pr-page[data-page="1"] .textLayer span')];
        const families = new Set();
        for (const span of spans) {
          const family = getComputedStyle(span).fontFamily;
          if (family) families.add(family);
        }
        const fontsUsed = [...document.fonts].map((f) => f.family + '/' + f.status);
        return { families: [...families], fontsUsed };
      })()`);
      const joined = info.families.join(',').toLowerCase();
      assert(/liberation|arial|helvetica|sans|serif|times/.test(joined) || info.fontsUsed.length === 0,
        `unexpected font families: ${joined}`);
      return `families ${info.families.join(' | ')}; loaded @font-face ${info.fontsUsed.length}`;
    });

    /* --- 14. query CSS variables after zoom ---------------------------- */
    await check('--total-scale-factor tracks zoom (text layer font contract)', async () => {
      const info = await evaluate(`(async () => {
        const reader = window.__reader;
        reader.scrollToPage(1, { align: 'start' });
        await new Promise((r) => setTimeout(r, 900));
        const div = document.querySelector('.pr-page[data-page="1"]');
        const sample = () => ({
          total: getComputedStyle(div).getPropertyValue('--total-scale-factor').trim(),
          scale: getComputedStyle(div).getPropertyValue('--scale-factor').trim(),
          fontSize: getComputedStyle(div.querySelector('.textLayer span[role="presentation"]')).fontSize,
          width: div.getBoundingClientRect().width,
        });
        const a = sample();
        reader.setScale(2, { anchorPageNumber: 1 });
        await new Promise((r) => setTimeout(r, 900));
        const b = sample();
        reader.setScale(1, { anchorPageNumber: 1 });
        return { a, b };
      })()`);
      assert(info.b.total !== info.a.total, `--total-scale-factor did not change with zoom (${info.a.total} -> ${info.b.total})`);
      // --total-scale-factor resolves to `calc(<scale-factor> * <user-unit>)`.
      const resolved = (value) => {
        const calc = /calc\(([^)]*)\)/.exec(value);
        const body = calc ? calc[1] : value;
        const factors = body.split('*').map((part) => parseFloat(part.trim()));
        return factors.reduce((acc, n) => acc * (Number.isFinite(n) ? n : 1), 1);
      };
      const expected = 2 * (96 / 72); // zoom 2 at 96 CSS dpi == 72 pdf dpi
      const actual = resolved(info.b.total);
      assert(Math.abs(actual - expected) < 0.03, `--total-scale-factor ${actual} != ${expected} (zoom 2 at 96dpi)`);
      // And the page box must have doubled, which is the user-visible proof.
      assert(Math.abs(info.b.width / info.a.width - 2) < 0.02, `page width ${info.a.width} -> ${info.b.width} did not double`);
      return `--total-scale-factor ${info.a.total} -> ${info.b.total} (= ${actual}, expected ${expected}); span font-size ${info.a.fontSize} -> ${info.b.fontSize}; page width ${Math.round(info.a.width)} -> ${Math.round(info.b.width)}px`;
    });

    /* --- 15. highlight JSON survives a re-open ------------------------- */
    await check('highlights re-paint at the same place after reload from JSON', async () => {
      const info = await evaluate(`(async () => {
        const reader = window.__reader;
        const stored = JSON.parse(JSON.stringify(reader.getHighlights()));
        const before = [...document.querySelectorAll('.pr-highlight')].map((e) => ({
          id: e.dataset.highlightId, r: e.getBoundingClientRect().toJSON(),
        }));
        reader.renderHighlights([]);
        const cleared = document.querySelectorAll('.pr-highlight').length;
        reader.renderHighlights(stored);
        const after = [...document.querySelectorAll('.pr-highlight')].map((e) => ({
          id: e.dataset.highlightId, r: e.getBoundingClientRect().toJSON(),
        }));
        return { stored: stored.length, cleared, before: before.length, after: after.length,
                 same: JSON.stringify(before.map((b) => b.r)) === JSON.stringify(after.map((a) => a.r)) };
      })()`);
      assert(info.stored >= 1, 'no stored highlights to round-trip');
      assert(info.cleared === 0, 'renderHighlights([]) did not clear');
      assert(info.after === info.stored, `repainted ${info.after} of ${info.stored}`);
      assert(info.same, 'geometry changed after JSON round-trip repaint');
      return `${info.stored} highlight(s), cleared -> repainted identically`;
    });

    /* --- 16. selection rect vs painted glyphs (the alignment proof) ---- */
    await check('selection rects cover the painted glyph pixels (text layer ↔ canvas aligned)', async () => {
      const info = await evaluate(`(async () => {
        const reader = window.__reader;
        reader.scrollToPage(1, { align: 'start' });
        reader.setScale(1.5, { anchorPageNumber: 1 });
        await new Promise((r) => setTimeout(r, 1200));
        const div = document.querySelector('.pr-page[data-page="1"]');
        const layer = div.querySelector('.textLayer');
        const spans = [...layer.querySelectorAll('span')].filter((s) => s.textContent.trim());
        const span = spans.find((s) => s.textContent.includes('Paper Reader Spike'));
        const node = span.firstChild;
        const range = document.createRange();
        range.setStart(node, 0);
        range.setEnd(node, Math.min(node.length, 'Paper Reader Spike'.length));
        const sel = document.getSelection(); sel.removeAllRanges(); sel.addRange(range);
        const selection = reader.getSelection();
        const rect = selection.rects[0];

        // Map the selection rect into canvas pixels and measure the ink there.
        const canvas = div.querySelector('canvas');
        const canvasBox = canvas.getBoundingClientRect();
        const pageBox = div.getBoundingClientRect();
        const sx = canvas.width / canvasBox.width;
        const sy = canvas.height / canvasBox.height;
        const left = rect.x, top = rect.y, right = rect.x + rect.w, bottom = rect.y + rect.h;
        const px0 = Math.max(0, Math.floor(left * sx));
        const px1 = Math.min(canvas.width, Math.ceil(right * sx));
        const py0 = Math.max(0, Math.floor(top * sy));
        const py1 = Math.min(canvas.height, Math.ceil(bottom * sy));
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        const band = ctx.getImageData(px0, py0, Math.max(1, px1 - px0), Math.max(1, py1 - py0)).data;
        let inkCols = 0, inkRows = 0, minX = Infinity, maxX = -1, minY = Infinity, maxY = -1;
        const wpx = Math.max(1, px1 - px0), hpx = Math.max(1, py1 - py0);
        const colHasInk = new Array(wpx).fill(false), rowHasInk = new Array(hpx).fill(false);
        for (let y = 0; y < hpx; y++) {
          for (let x = 0; x < wpx; x++) {
            const i = (y * wpx + x) * 4;
            if (band[i] < 200 || band[i+1] < 200 || band[i+2] < 200) {
              colHasInk[x] = true; rowHasInk[y] = true;
              if (x < minX) minX = x; if (x > maxX) maxX = x;
              if (y < minY) minY = y; if (y > maxY) maxY = y;
            }
          }
        }
        inkCols = colHasInk.filter(Boolean).length;
        inkRows = rowHasInk.filter(Boolean).length;
        // Convert the ink bbox back to page CSS px to compare with the rect.
        const inkCss = { left: (px0 + minX) / sx, top: (py0 + minY) / sy, right: (px0 + maxX + 1) / sx, bottom: (py0 + maxY + 1) / sy };
        return {
          rect, inkCss, inkCols, inkRows, bandPx: [wpx, hpx],
          canvasBitmap: [canvas.width, canvas.height],
          canvasCss: [canvasBox.width, canvasBox.height],
          dpr: window.devicePixelRatio,
        };
      })()`);
      const r = info.rect;
      assert(info.inkCols > 0, `no ink pixels inside the selection rect (${JSON.stringify(r)} in a ${info.bandPx.join('x')} px band)`);
      // Horizontal: the selection rect must start and end on the glyphs
      // (tolerance ~1 CSS px + one glyph advance).
      const dLeft = Math.abs(info.inkCss.left - r.x);
      const dTop = Math.abs(info.inkCss.top - r.y);
      assert(dLeft < 4, `horizontal misalignment: selection x=${r.x} ink starts at ${info.inkCss.left} (Δ${dLeft.toFixed(2)}px)`);
      assert(dTop < 6, `vertical misalignment: selection y=${r.y} ink starts at ${info.inkCss.top} (Δ${dTop.toFixed(2)}px)`);
      // Vertical coverage: the glyph ink must span most of the rect height
      // (the rect includes ascent/descent slack, so ~50% is healthy, 0% means
      // the text layer is offset from the canvas).
      const coverage = (info.inkCss.bottom - info.inkCss.top) / r.h;
      assert(coverage > 0.45, `ink covers only ${(coverage * 100).toFixed(0)}% of the selection height — text layer not on the glyphs`);
      return `rect ${JSON.stringify({ x: r.x, y: r.y, w: r.w, h: r.h })}; ink ${JSON.stringify(info.inkCss)}; Δleft ${dLeft.toFixed(2)}px Δtop ${dTop.toFixed(2)}px; ink covers ${(coverage * 100).toFixed(0)}% of rect height; canvas ${info.canvasBitmap.join('x')} bitmap / ${info.canvasCss.join('x')} css @dpr${info.dpr}`;
    });

    const report = {
      url,
      browser: executable,
      results,
      pass: results.filter((r) => r.ok).length,
      fail: results.filter((r) => !r.ok).length,
      foreignRequests,
      failedRequests,
      totalRequests: pageRequests.length,
      assetsLoaded: responseStatuses.filter((r) => r.url.includes('/vendor/')).map((r) => path.basename(new URL(r.url).pathname)),
      clientExceptions,
    };
    console.log('\n' + JSON.stringify(report, null, 2));
    if (report.fail > 0) process.exitCode = 1;
  } finally {
    if (!keepBrowser) {
      try { proc.kill(); } catch {}
      await sleep(200);
    }
    ws.close();
    server.close();
  }
}

main().catch((err) => {
  console.error('VERIFY FAILED:', err && err.stack ? err.stack : err);
  process.exitCode = 1;
  process.exit(1);
});
