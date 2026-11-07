/**
 * Paper reader — Host half.
 *
 * Two jobs:
 * 1. Serve this package's vendored, offline pdf.js runtime (worker, cMaps,
 *    standard fonts, wasm decoders, ICC profiles) on a read-only prefix route,
 *    so the browser loads a same-origin engine instead of a CDN.
 * 2. Persist uploaded papers and per-paper annotations under the DSH home, and
 *    expose them to the page through exact `/api/paper-reader.*` Fetch routes.
 *    Those routes live inside Connection's shared `/api` handler, which admits
 *    the browser-session owner principal before a handler runs.
 */
import { createReadStream } from 'node:fs'
import { mkdir, open, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, extname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROUTE = '/paper-reader'
const API = '/api/paper-reader'

const MIME = {
  '.mjs': 'text/javascript; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.bcmap': 'application/octet-stream',
  '.pfb': 'application/octet-stream',
  '.ttf': 'font/ttf',
  '.wasm': 'application/wasm',
  '.icc': 'application/octet-stream',
  '.json': 'application/json; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

function packageRoot() {
  return dirname(fileURLToPath(import.meta.url))
}

/** Resolve the DSH home without depending on another package. */
function dshHome() {
  const configured = process.env.DSH_HOME
  if (typeof configured === 'string' && configured.trim() !== '') {
    return resolve(configured.trim().replace(/^~(?=$|[/\\])/, homedir()))
  }
  return join(homedir(), '.dsh')
}

const papersDir = () => join(dshHome(), 'paper-reader', 'papers')
const annotationsDir = () => join(dshHome(), 'paper-reader', 'annotations')

/** Reject path segments that could escape the served directory. */
function safeRelative(raw) {
  const withoutLeading = raw.replace(/^\/+/, '')
  if (withoutLeading === '' || withoutLeading.includes('\0')) return undefined
  const segments = withoutLeading.split('/')
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) return undefined
  return segments.join('/')
}

async function serveAsset(request) {
  const url = new URL(request.url)
  const relative = safeRelative(url.pathname.slice(ROUTE.length))
  if (relative === undefined) return new Response('not found', { status: 404 })
  const root = packageRoot()
  const target = resolve(join(root, relative))
  if (!target.startsWith(root + sep)) return new Response('forbidden', { status: 403 })
  let info
  try {
    info = await stat(target)
  } catch {
    return new Response('not found', { status: 404 })
  }
  if (!info.isFile()) return new Response('not found', { status: 404 })
  const headers = {
    'content-type': MIME[extname(target).toLowerCase()] ?? 'application/octet-stream',
    'content-length': `${info.size}`,
    'cache-control': 'public, max-age=31536000, immutable',
    'x-content-type-options': 'nosniff',
  }
  if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
  return new Response(createReadStream(target), { status: 200, headers })
}

function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  })
}

const fail = (status, message) =>
  new Response(message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' },
  })

const paperId = (value) => (typeof value === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(value) ? value : undefined)

async function paperRecords() {
  let names
  try {
    names = await readdir(papersDir())
  } catch {
    return []
  }
  const records = []
  for (const name of names) {
    if (!name.endsWith('.pdf')) continue
    const id = name.slice(0, -4)
    try {
      const info = await stat(join(papersDir(), name))
      const meta = await readFile(join(papersDir(), `${id}.json`), 'utf8')
        .then(JSON.parse)
        .catch(() => undefined)
      records.push({
        id,
        title: typeof meta?.title === 'string' ? meta.title : id,
        bytes: info.size,
        addedAt: typeof meta?.addedAt === 'number' ? meta.addedAt : info.mtimeMs,
      })
    } catch {
      continue
    }
  }
  records.sort((left, right) => right.addedAt - left.addedAt)
  return records
}

/** Stream one uploaded PDF into the papers directory. */
async function storePaper(request) {
  const declared = request.headers.get('x-paper-title')
  let title = 'paper.pdf'
  if (typeof declared === 'string' && declared !== '') {
    try {
      title = decodeURIComponent(declared).trim().slice(0, 240) || title
    } catch {
      title = 'paper.pdf'
    }
  }
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  await mkdir(papersDir(), { recursive: true })
  const target = join(papersDir(), `${id}.pdf`)
  const handle = await open(target, 'w')
  let bytes = 0
  try {
    const body = request.body
    if (body === null) throw new Error('missing paper bytes')
    const reader = body.getReader()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        bytes += value.byteLength
        await handle.write(value)
      }
    } finally {
      reader.releaseLock()
    }
    await handle.close()
  } catch (error) {
    await handle.close().catch(() => {})
    await rm(target, { force: true }).catch(() => {})
    throw error
  }
  await writeFile(join(papersDir(), `${id}.json`), JSON.stringify({ title, addedAt: Date.now(), bytes }), 'utf8')
  return json({ id, title, bytes })
}

async function paperBytes(request) {
  const url = new URL(request.url)
  const id = paperId(url.searchParams.get('id') ?? undefined)
  if (id === undefined) return fail(400, 'invalid paper id')
  let bytes
  try {
    bytes = await readFile(join(papersDir(), `${id}.pdf`))
  } catch {
    return fail(404, 'paper not found')
  }
  return new Response(bytes, {
    status: 200,
    headers: {
      'content-type': 'application/pdf',
      'content-length': `${bytes.byteLength}`,
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
    },
  })
}

async function removePaper(request) {
  const url = new URL(request.url)
  const id = paperId(url.searchParams.get('id') ?? undefined)
  if (id === undefined) return fail(400, 'invalid paper id')
  await rm(join(papersDir(), `${id}.pdf`), { force: true })
  await rm(join(papersDir(), `${id}.json`), { force: true })
  await rm(join(annotationsDir(), `${id}.json`), { force: true })
  return json({ removed: true })
}

async function readAnnotations(request) {
  const url = new URL(request.url)
  const id = paperId(url.searchParams.get('paperId') ?? undefined)
  if (id === undefined) return fail(400, 'invalid paper id')
  try {
    return new Response(await readFile(join(annotationsDir(), `${id}.json`), 'utf8'), {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    })
  } catch {
    return json({ paperId: id, items: [] })
  }
}

async function writeAnnotations(request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return fail(400, 'body is not JSON')
  }
  const id = paperId(payload?.paperId)
  if (id === undefined) return fail(400, 'invalid paper id')
  const items = Array.isArray(payload?.items) ? payload.items : []
  await mkdir(annotationsDir(), { recursive: true })
  await writeFile(join(annotationsDir(), `${id}.json`), JSON.stringify({ paperId: id, items }), 'utf8')
  return json({ saved: true, count: items.length })
}

export const inject = ['webServer', 'connection']

export function apply(ctx) {
  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: ROUTE, resource: serveAsset }),
    'paper-reader: pdf.js runtime assets',
  )

  const routes = [
    {
      path: `${API}.papers`,
      methods: ['GET', 'POST', 'DELETE'],
      requestBody: 'streaming',
      async fetch(request) {
        if (request.method === 'GET') return json({ papers: await paperRecords() })
        if (request.method === 'POST') {
          try {
            return await storePaper(request)
          } catch (error) {
            return fail(500, `could not store paper: ${error instanceof Error ? error.message : String(error)}`)
          }
        }
        return removePaper(request)
      },
    },
    { path: `${API}.file`, methods: ['GET'], fetch: paperBytes },
    {
      path: `${API}.annotations`,
      methods: ['GET', 'PUT'],
      fetch: (request) => (request.method === 'GET' ? readAnnotations(request) : writeAnnotations(request)),
    },
  ]

  for (const route of routes) {
    ctx.effect(() => ctx.connection.fetch.register(route), `paper-reader: ${route.path}`)
  }
}
