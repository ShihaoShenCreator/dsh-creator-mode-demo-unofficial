/**
 * Host-half integration test: captures the routes the plugin registers on a
 * stub ctx, then drives them with real `Request`/`Response` objects against a
 * temporary DSH home. Covers upload -> list -> read -> annotate -> delete and
 * the asset route's traversal guard.
 */
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const home = mkdtempSync(join(tmpdir(), 'paper-reader-host-'))
process.env.DSH_HOME = home

const webRoutes = []
const fetchRoutes = new Map()
const effects = []

const ctx = {
  effect(fn, label) {
    const disposer = fn()
    effects.push({ label, disposer })
    return () => disposer?.()
  },
  webServer: {
    register(route) {
      webRoutes.push(route)
      return () => {}
    },
  },
  connection: {
    fetch: {
      register(route) {
        assert.ok(!fetchRoutes.has(route.path), `duplicate fetch route ${route.path}`)
        fetchRoutes.set(route.path, route)
        return () => fetchRoutes.delete(route.path)
      },
    },
  },
}

const host = await import('../.dsh-created-plugins/paper-reader/index.js')
assert.deepEqual([...host.inject].sort(), ['connection', 'webServer'])
host.apply(ctx)

// ---- assets ---------------------------------------------------------------
const assetRoute = webRoutes.find((route) => route.path === '/paper-reader')
assert.ok(assetRoute, 'pdf.js asset prefix route registered')
assert.equal(assetRoute.kind, 'prefix')

const origin = 'http://127.0.0.1:52266'
const assetResponse = await assetRoute.resource(new Request(`${origin}/paper-reader/vendor/pdfjs/build/pdf.min.mjs`))
assert.equal(assetResponse.status, 200)
assert.equal(assetResponse.headers.get('content-type'), 'text/javascript; charset=utf-8')
assert.equal(assetResponse.headers.get('cache-control'), 'public, max-age=31536000, immutable')
assert.ok((await assetResponse.text()).includes('getDocument'), 'worker-independent api bundle served')

const cmap = await assetRoute.resource(new Request(`${origin}/paper-reader/vendor/pdfjs/cmaps/UniGB-UCS2-H.bcmap`))
assert.equal(cmap.status, 200)
assert.equal(cmap.headers.get('content-type'), 'application/octet-stream')

const wasm = await assetRoute.resource(new Request(`${origin}/paper-reader/vendor/pdfjs/wasm/openjpeg.wasm`))
assert.equal(wasm.status, 200)
assert.equal(wasm.headers.get('content-type'), 'application/wasm')

const font = await assetRoute.resource(new Request(`${origin}/paper-reader/vendor/pdfjs/standard_fonts/FoxitSerif.pfb`))
assert.equal(font.status, 200)

for (const path of [
  '/paper-reader/../package.json',
  '/paper-reader/%2e%2e/package.json',
  '/paper-reader/vendor/../../index.js',
  '/paper-reader/',
]) {
  const blocked = await assetRoute.resource(new Request(`${origin}${path}`))
  assert.ok([403, 404].includes(blocked.status), `${path} must not be served (got ${blocked.status})`)
}

const missing = await assetRoute.resource(new Request(`${origin}/paper-reader/vendor/pdfjs/nope.wasm`))
assert.equal(missing.status, 404)

// ---- papers ----------------------------------------------------------------
const papers = fetchRoutes.get('/api/paper-reader.papers')
assert.ok(papers, 'papers route registered')
assert.deepEqual([...papers.methods].sort(), ['DELETE', 'GET', 'POST'])
assert.equal(papers.requestBody, 'streaming')

const emptyList = await papers.fetch(new Request(`${origin}/api/paper-reader.papers`, { method: 'GET' }))
assert.deepEqual(await emptyList.json(), { papers: [] })

// A minimal but structurally valid PDF, uploaded as a streamed body.
const pdfBytes = Buffer.from(
  `%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n` +
    `3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 612 792]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n`,
  'utf8',
)
const upload = await papers.fetch(
  new Request(`${origin}/api/paper-reader.papers`, {
    method: 'POST',
    headers: { 'content-type': 'application/pdf', 'x-paper-title': encodeURIComponent('Attention Is All You Need.pdf') },
    body: pdfBytes,
    duplex: 'half',
  }),
)
assert.equal(upload.status, 200)
const stored = await upload.json()
assert.match(stored.id, /^[a-zA-Z0-9_-]+$/)
assert.equal(stored.title, 'Attention Is All You Need.pdf')
assert.equal(stored.bytes, pdfBytes.byteLength)

const listed = await (await papers.fetch(new Request(`${origin}/api/paper-reader.papers`, { method: 'GET' }))).json()
assert.equal(listed.papers.length, 1)
assert.equal(listed.papers[0].id, stored.id)
assert.equal(listed.papers[0].title, 'Attention Is All You Need.pdf')

const file = fetchRoutes.get('/api/paper-reader.file')
const fileResponse = await file.fetch(new Request(`${origin}/api/paper-reader.file?id=${stored.id}`))
assert.equal(fileResponse.status, 200)
assert.equal(fileResponse.headers.get('content-type'), 'application/pdf')
assert.equal((await fileResponse.arrayBuffer()).byteLength, pdfBytes.byteLength)

const badFile = await file.fetch(new Request(`${origin}/api/paper-reader.file?id=../../secrets`))
assert.equal(badFile.status, 400)
const missingFile = await file.fetch(new Request(`${origin}/api/paper-reader.file?id=doesnotexist`))
assert.equal(missingFile.status, 404)

// ---- annotations ------------------------------------------------------------
const annotations = fetchRoutes.get('/api/paper-reader.annotations')
assert.deepEqual([...annotations.methods].sort(), ['GET', 'PUT'])

const emptyAnnotations = await (await annotations.fetch(
  new Request(`${origin}/api/paper-reader.annotations?paperId=${stored.id}`, { method: 'GET' }),
)).json()
assert.deepEqual(emptyAnnotations, { paperId: stored.id, items: [] })

const items = [
  {
    id: 'a1',
    page: 1,
    quote: 'self-attention',
    note: 'compare with recurrence',
    rects: [{ page: 1, x: 0.1, y: 0.2, w: 0.3, h: 0.02 }],
    createdAt: 1,
  },
]
const saved = await annotations.fetch(
  new Request(`${origin}/api/paper-reader.annotations`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ paperId: stored.id, items }),
  }),
)
assert.equal(saved.status, 200)
assert.deepEqual(await saved.json(), { saved: true, count: 1 })

const reread = await (await annotations.fetch(
  new Request(`${origin}/api/paper-reader.annotations?paperId=${stored.id}`, { method: 'GET' }),
)).json()
assert.deepEqual(reread.items, items)

const badPut = await annotations.fetch(
  new Request(`${origin}/api/paper-reader.annotations`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: 'not json',
  }),
)
assert.equal(badPut.status, 400)

// ---- delete -------------------------------------------------------------
const removed = await papers.fetch(
  new Request(`${origin}/api/paper-reader.papers?id=${stored.id}`, { method: 'DELETE' }),
)
assert.deepEqual(await removed.json(), { removed: true })
const afterDelete = await (await papers.fetch(new Request(`${origin}/api/paper-reader.papers`, { method: 'GET' }))).json()
assert.equal(afterDelete.papers.length, 0)
const goneFile = await file.fetch(new Request(`${origin}/api/paper-reader.file?id=${stored.id}`))
assert.equal(goneFile.status, 404)

// Unload path: every disposer must run cleanly.
const registeredPaths = [...fetchRoutes.keys()]
for (const effect of effects) effect.disposer?.()
assert.equal(fetchRoutes.size, 0, 'every Fetch route disposer removed its registration')

rmSync(home, { recursive: true, force: true })
console.log('host half integration test: PASS', {
  webRoutes: webRoutes.map((route) => route.path),
  fetchRoutes: registeredPaths,
  effects: effects.length,
})
