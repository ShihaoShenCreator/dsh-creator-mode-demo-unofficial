/**
 * Build the video-editor client bundle.
 *
 * The Harness client module format is a classic script that calls
 * `window.__ModuleLoader__.load({ id, factory })`. The factory body is CommonJS:
 * the module table answers `require('react')`, and the factory's return value
 * is the bundle's export surface.
 *
 * So: compile `src/client/index.jsx` to CJS, then wrap it in the handoff.
 *
 * Usage: node tools/build.mjs [--watch]
 */
import { build } from 'esbuild'
import { writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', 'video-editor')
const outfile = join(root, 'client.js')
const entry = join(root, 'src', 'client', 'index.jsx')

const result = await build({
  entryPoints: [entry],
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: ['chrome120', 'firefox120', 'safari17'],
  jsx: 'transform',
  jsxFactory: 'React.createElement',
  jsxFragment: 'React.Fragment',
  minify: false,
  sourcemap: false,
  legalComments: 'none',
  external: ['react', 'react-dom', 'react-dom/client'],
  loader: { '.css': 'text' },
  logLevel: 'warning',
})

const code = result.outputFiles[0].text

const banner = `/**
 * Video editing workbench — generated client bundle.
 * Source lives in video-editor/src/client/; rebuild with: node tools/build.mjs
 */
window.__ModuleLoader__.load({
  id: '@local/video-editor',
  factory(require) {
    var module = { exports: {} };
    var exports = module.exports;
`

const footer = `
    return module.exports;
  },
});
`

await mkdir(dirname(outfile), { recursive: true })
await writeFile(outfile, banner + code + footer, 'utf8')
console.log('built', outfile)
