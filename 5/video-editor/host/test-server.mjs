/**
 * Minimal WebRoute harness standing in for the Harness webServer service.
 *
 * The plugin registers one `prefix` route and expects an
 * IncomingMessage/ServerResponse pair. Real ServerResponse is a Node Writable
 * Stream — file streaming (`createReadStream(...).pipe(res)`) depends on that —
 * so this harness builds a REAL Writable and collects its bytes, rather than a
 * duck-typed object that would make every streamed response look empty.
 */

import { Writable } from 'node:stream'

export function createTrackedServer() {
  const routes = []

  function register(route) {
    routes.push(route)
    return () => {
      const index = routes.indexOf(route)
      if (index !== -1) routes.splice(index, 1)
    }
  }

  function match(url) {
    const pathname = new URL(url, 'http://local').pathname
    let best = null
    for (const route of routes) {
      if (route.kind === 'exact' && route.path === pathname) {
        if (best === null || best.path.length < route.path.length) best = route
      } else if (route.kind === 'prefix' && (pathname === route.path || pathname.startsWith(`${route.path}/`))) {
        if (best === null || best.path.length < route.path.length) best = route
      }
    }
    return best
  }

  async function dispatch({ method = 'GET', url = '/', headers = {}, body = null, remoteAddress = '127.0.0.1', host = '127.0.0.1:8080' }) {
    const route = match(url)
    if (route === null) return { status: 404, headers: {}, body: null, json: undefined }

    const requestHeaders = { host, 'sec-fetch-site': 'same-origin', ...headers }
    const req = {
      method,
      url,
      headers: requestHeaders,
      socket: { remoteAddress },
      on(event, listener) {
        if (event === 'data') {
          if (body !== null && body !== undefined) {
            const chunk = Buffer.from(body)
            queueMicrotask(() => listener(chunk))
          }
        } else if (event === 'end') {
          queueMicrotask(() => listener())
        } else if (event === 'error') {
          // callers may attach; never fire in the harness
        }
        return req
      },
      removeListener() {
        return req
      },
    }

    return await new Promise((settle) => {
      const captured = { status: 0, headers: {}, chunks: [], settled: false }
      const headResponse = method === 'HEAD'
      const finish = () => {
        if (captured.settled) return
        captured.settled = true
        const buffer = Buffer.concat(captured.chunks)
        let json
        try {
          json = JSON.parse(buffer.toString('utf8'))
        } catch {
          json = undefined
        }
        settle({ status: captured.status, headers: captured.headers, body: headResponse ? null : buffer, json })
      }

      const sink = new Writable({
        write(chunk, _encoding, callback) {
          if (!headResponse) captured.chunks.push(Buffer.from(chunk))
          callback()
        },
        final(callback) {
          callback()
        },
      })
      sink.on('error', () => {
        // a streamed read error tears the response down; keep whatever arrived
      })

      const res = sink
      res.headersSent = false
      res.statusCode = 200
      res.writeHead = function writeHead(status, responseHeaders) {
        captured.status = status
        captured.headers = { ...(responseHeaders ?? {}) }
        this.headersSent = true
        this.statusCode = status
        return this
      }
      res.setHeader = function setHeader(name, value) {
        captured.headers[String(name).toLowerCase()] = value
        return this
      }
      const originalEnd = sink.end.bind(sink)
      res.end = function end(...args) {
        originalEnd(...args)
        // Give streamed file reads a tick to flush before reading the buffer.
        setTimeout(finish, 25)
        return this
      }
      const originalDestroy = sink.destroy.bind(sink)
      res.destroy = function destroy(...args) {
        originalDestroy(...args)
        setTimeout(finish, 25)
        return this
      }

      void route.handler(req, res)
      setTimeout(finish, 8000)
    })
  }

  return { routes, register, dispatch }
}
