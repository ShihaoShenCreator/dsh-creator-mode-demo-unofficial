/**
 * HTTP plumbing for the video editing workbench: JSON bodies, CORS-free
 * same-origin fencing, Range requests, and the route table.
 *
 * The Host owns every byte of project state; the browser only renders it and
 * calls `/op`. That is what makes agent tool calls and UI clicks converge.
 */

import { createReadStream, statSync } from 'node:fs'
import { basename, extname, join, resolve, sep } from 'node:path'
import { homedir } from 'node:os'

const MAX_JSON = 1_000_000
const MAX_UPLOAD = 512 * 1024 * 1024

export const ROUTE_PREFIX = '/video-editor'

const SESSION_RE = /^[A-Za-z0-9._-]{1,120}$/
const MEDIA_RE = /^[A-Za-z0-9._-]{1,64}$/
const JOB_RE = /^[A-Za-z0-9._-]{1,64}$/

const MIME = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.mpg': 'video/mpeg',
  '.mpeg': 'video/mpeg',
  '.ts': 'video/mp2t',
  '.flv': 'video/x-flv',
  '.wmv': 'video/x-ms-wmv',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
}

export function contentTypeOf(path) {
  return MIME[extname(String(path)).toLowerCase()] ?? 'application/octet-stream'
}

export function isLoopback(address) {
  if (address === undefined) return false
  const plain = address.startsWith('::ffff:') ? address.slice('::ffff:'.length) : address
  return plain === '::1' || /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(plain)
}

/** Same-origin loopback fence for this plugin's own routes. */
function refusalOf(req) {
  if (!isLoopback(req.socket?.remoteAddress)) return 403
  const host = req.headers.host
  if (host !== undefined) {
    if (!URL.canParse(`http://${host}`)) return 403
    const name = new URL(`http://${host}`).hostname
    if (name !== 'localhost' && name !== '[::1]' && !/^127\.\d\.\d\.\d$/.test(name)) return 403
  }
  const site = req.headers['sec-fetch-site']
  if (site !== undefined && site !== 'same-origin' && site !== 'none') return 403
  const origin = req.headers.origin
  if (origin === undefined) return undefined
  if (!URL.canParse(origin)) return 403
  return new URL(origin).host === host ? undefined : 403
}

export function sendJson(res, status, payload) {
  const body = Buffer.from(JSON.stringify(payload))
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(body.byteLength),
    'cache-control': 'no-store',
  })
  res.end(body)
}

export function methodRefused(req, res, methods) {
  if (req.method !== undefined && methods.includes(req.method)) return false
  res.writeHead(405, { allow: methods.join(', ') })
  res.end()
  return true
}

export function readBody(req, limit) {
  return new Promise((settle) => {
    const chunks = []
    let size = 0
    let over = false
    req.on('data', (chunk) => {
      if (over) return
      size += chunk.length
      if (size > limit) {
        over = true
        settle({ tooLarge: true })
        return
      }
      chunks.push(Buffer.from(chunk))
    })
    req.on('end', () => {
      if (!over) settle({ bytes: Buffer.concat(chunks) })
    })
    req.on('error', () => {
      if (!over) settle({ error: true })
    })
  })
}

export async function readJson(req) {
  const body = await readBody(req, MAX_JSON)
  if (body.tooLarge === true) return { error: '请求体过大' }
  if (body.error === true) return { error: '读取请求失败' }
  const text = body.bytes.toString('utf8')
  if (text.trim() === '') return { value: {} }
  try {
    return { value: JSON.parse(text) }
  } catch {
    return { error: '请求体不是合法 JSON' }
  }
}

export async function readRaw(req, limit = MAX_UPLOAD) {
  const body = await readBody(req, limit)
  if (body.tooLarge === true) return { error: '文件超过上传上限（512 MB）' }
  if (body.error === true) return { error: '读取上传文件失败' }
  return { bytes: body.bytes }
}

/** Stream one media file with correct HTTP Range semantics. */
export function streamMedia(req, res, filePath, contentType) {
  let stat
  try {
    stat = statSync(filePath)
  } catch {
    res.writeHead(404, { 'cache-control': 'no-store' })
    res.end()
    return
  }
  if (!stat.isFile()) {
    res.writeHead(404)
    res.end()
    return
  }
  const size = stat.size
  const headers = {
    'content-type': contentType,
    'accept-ranges': 'bytes',
    'cache-control': 'private, max-age=3600',
  }
  const rangeHeader = req.headers.range
  let start = 0
  let end = size - 1
  let status = 200
  if (typeof rangeHeader === 'string' && rangeHeader.startsWith('bytes=')) {
    const spec = rangeHeader.slice('bytes='.length).split(',')[0]?.trim() ?? ''
    const dash = spec.indexOf('-')
    if (dash !== -1) {
      const head = spec.slice(0, dash)
      const tail = spec.slice(dash + 1)
      const parsedStart = head === '' ? undefined : Number(head)
      const parsedEnd = tail === '' ? undefined : Number(tail)
      if (parsedStart !== undefined && Number.isFinite(parsedStart)) {
        start = Math.max(0, Math.floor(parsedStart))
        end = parsedEnd !== undefined && Number.isFinite(parsedEnd) ? Math.min(size - 1, Math.floor(parsedEnd)) : size - 1
      } else if (parsedEnd !== undefined && Number.isFinite(parsedEnd) && parsedEnd > 0) {
        start = Math.max(0, size - Math.floor(parsedEnd))
        end = size - 1
      } else {
        start = 0
        end = size - 1
      }
      if (start > end || start >= size) {
        res.writeHead(416, { 'content-range': `bytes */${size}`, 'accept-ranges': 'bytes' })
        res.end()
        return
      }
      status = 206
      headers['content-range'] = `bytes ${start}-${end}/${size}`
    }
  }
  headers['content-length'] = String(end - start + 1)
  res.writeHead(status, headers)
  if (req.method === 'HEAD') {
    res.end()
    return
  }
  const stream = createReadStream(filePath, { start, end })
  stream.on('error', () => {
    res.destroy()
  })
  res.on('close', () => {
    stream.destroy()
  })
  stream.pipe(res)
}

export { MAX_UPLOAD, SESSION_RE, MEDIA_RE, JOB_RE, basename, extname, join, resolve, sep, homedir }

/** Deployment data root: `<home>/video-editor`, matching other plugins' conventions. */
export function dataRoot(ctx) {
  const resolvePath = typeof ctx?.get === 'function' ? ctx.get('dshHomePath') : undefined
  if (typeof resolvePath === 'function') {
    try {
      return resolvePath('video-editor')
    } catch {
      // fall through to the environment convention
    }
  }
  const home = process.env.DSH_HOME ?? join(homedir(), '.dsh')
  return join(home, 'video-editor')
}
