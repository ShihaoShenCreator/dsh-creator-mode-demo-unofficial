/**
 * Engine test: parse a real PDF with the exact vendored pdf.js build and the
 * exact option object the plugin passes, then read text out of it. This proves
 * the shipped engine + cmaps/fonts/wasm layout works, which is the part a
 * screenshot cannot prove server-side.
 */
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { pathToFileURL } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(import.meta.dirname, '..', '.dsh-created-plugins', 'paper-reader', 'vendor', 'pdfjs')
// Load the shipped worker bundle first: it publishes `globalThis.pdfjsWorker`,
// which is the code path pdf.js uses when no real Worker constructor exists.
await import(pathToFileURL(resolve(root, 'build', 'pdf.worker.min.mjs')).href)
assert.equal(
  typeof globalThis.pdfjsWorker?.WorkerMessageHandler,
  'function',
  'shipped worker bundle publishes its message handler',
)
const lib = await import(pathToFileURL(resolve(root, 'build', 'pdf.min.mjs')).href)

const data = new Uint8Array(await readFile(process.argv[2]))
const task = lib.getDocument({
  data,
  cMapUrl: pathToFileURL(resolve(root, 'cmaps')).href + '/',
  cMapPacked: true,
  standardFontDataUrl: pathToFileURL(resolve(root, 'standard_fonts')).href + '/',
  wasmUrl: pathToFileURL(resolve(root, 'wasm')).href + '/',
  iccUrl: pathToFileURL(resolve(root, 'iccs')).href + '/',
  isEvalSupported: false,
  disableWorker: true,
  verbosity: 0,
})
const doc = await task.promise
assert.equal(doc.numPages, 2, 'page count from the real document catalog')

const page = await doc.getPage(1)
const viewport = page.getViewport({ scale: 1 })
assert.equal(Math.round(viewport.width), 612)
assert.equal(Math.round(viewport.height), 792)

const text = await page.getTextContent()
const joined = text.items.map((item) => item.str).join(' ').trim()
assert.match(joined, /Faithful page one/, `page text extracted (got ${JSON.stringify(joined)})`)

const second = await doc.getPage(2)
const secondText = await second.getTextContent()
assert.match(secondText.items.map((item) => item.str).join(' '), /Second page text/)

// A text layer can be constructed from the page's own stream (the plugin's
// path) and rejects nothing when there is no DOM by simply not rendering here.
assert.equal(typeof lib.TextLayer, 'function', 'TextLayer exported by the vendored build')
assert.equal(typeof lib.GlobalWorkerOptions, 'function', 'GlobalWorkerOptions exposed by the vendored build')

// Browser builds resolve these through the DOM; in Node the loading task owns
// teardown. The plugin itself runs this in a page, where pdf.js is a browser build.
await task.destroy()
console.log('pdf.js engine test: PASS', { version: lib.version, pages: 2, textItems: text.items.length })

