/* Build the served client bundle: inline the font stylesheet and the GLSL source
 * into src/client.js and write client.js next to the manifest. */
import { readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const templatePath = join(root, 'src', 'client.js')
const cssPath = join(root, 'src', 'fonts.css')
const glslPath = join(root, 'src', 'fragment.glsl')
const outPath = join(root, 'client.js')

const [template, css, glsl] = await Promise.all([
  readFile(templatePath, 'utf8'),
  readFile(cssPath, 'utf8'),
  readFile(glslPath, 'utf8'),
])

const markers = ['__FONTS_CSS__', '__FRAGMENT_GLSL__']
for (const marker of markers) {
  if (!template.includes(marker)) throw new Error(`missing marker in template: ${marker}`)
}
if (!glsl.startsWith('#version 300 es')) throw new Error('fragment.glsl does not start with #version 300 es')

const output = template
  .replace('__FONTS_CSS__', JSON.stringify(css))
  .replace('__FRAGMENT_GLSL__', JSON.stringify(glsl))

for (const marker of markers) {
  if (output.includes(marker)) throw new Error(`unreplaced marker in output: ${marker}`)
}

await writeFile(outPath, output, 'utf8')
console.log(`client.js written: ${output.length} bytes`)
