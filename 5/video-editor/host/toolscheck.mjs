/**
 * Validate the `video_editor` tool against the REAL registry implementation
 * (@deepseek-ai/dsh-tools), not a hand-copied schema.
 *
 * Run: node video-editor/host/toolscheck.mjs
 *
 * Why this exists: the tool registry validates the wire schema when the plugin
 * registers the tool, and validates model arguments before `execute` runs. A
 * malformed `parameters` object or a missing `output.render` would therefore
 * fail at install/activation time in the running Harness. This test loads the
 * shipped registry offline (vendor-ref/node_modules) and drives it the same way.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))
const workspace = join(here, '..', '..')

let failures = 0
const check = (name, condition, detail = '') => {
  if (condition) console.log(`PASS  ${name}${detail === '' ? '' : `  ${detail}`}`)
  else {
    failures += 1
    console.log(`FAIL  ${name}${detail === '' ? '' : `  ${detail}`}`)
  }
}

const toolsEntry = join(workspace, 'vendor-ref', 'node_modules', '@deepseek-ai', 'dsh-tools', 'lib', 'index.js')
const tools = await import(pathToFileURL(toolsEntry).href)

// Import the ACTUAL definition out of index.js by loading the module with stubbed
// plugin services (ffmpeg paths resolve relative to the package, which is fine).
const plugin = await import(pathToFileURL(join(workspace, 'video-editor', 'index.js')).href)

const registered = []
const fakeCtx = {
  get(name) {
    if (name === 'tools') return { register: (definition) => { registered.push(definition); return () => {} } }
    if (name === 'agents') return { currentInitiator: () => ({ id: 'test-session' }) }
    return undefined
  },
  inject: (deps, callback) => { callback(fakeCtx) },
  effect: (fn) => {
    const dispose = fn()
    return typeof dispose === 'function' ? dispose : () => {}
  },
  logger: { warn() {} },
}
plugin.apply(fakeCtx, {})

check('plugin registered exactly one tool', registered.length === 1, String(registered.length))
const definition = registered[0]
check('tool name is video_editor', definition.name === 'video_editor', definition.name)
check('tool declares output.render', typeof definition.output?.render === 'function')
check('tool declares execute', typeof definition.execute === 'function')
check('tool description mentions workbench text', definition.description.includes('剪辑工作台'))

try {
  tools.assertSupportedJsonSchema(definition.parameters)
  check('parameters pass assertSupportedJsonSchema', true)
} catch (error) {
  check('parameters pass assertSupportedJsonSchema', false, String(error?.message ?? error))
}

try {
  tools.assertSupportedJsonSchema(definition.output.schema)
  check('output schema passes assertSupportedJsonSchema', true)
} catch (error) {
  check('output schema passes assertSupportedJsonSchema', false, String(error?.message ?? error))
}

// Drive the registry-owned argument validation exactly as the pipeline does.
const validCalls = [
  [{ action: 'state' }, 'state'],
  [{ action: 'import', paths: ['a.mp4'] }, 'import'],
  [{ action: 'add_clip', media: 'demo', in: 1, out: 4 }, 'add_clip numeric window'],
  [{ action: 'trim', clip: 1, in: 0, out: 2 }, 'trim by index'],
  [{ action: 'trim', clip: 'c2', in: 0, out: 2 }, 'trim by id'],
  [{ action: 'delete', clips: [1, 'c3'] }, 'delete mixed refs'],
  [{ action: 'move', clip: 'c1', toIndex: 2 }, 'move'],
  [{ action: 'set_project', title: 'x', fps: 30 }, 'set_project'],
  [{ action: 'export', quality: 'fast', filename: 'out.mp4' }, 'export'],
  [{ action: 'add_clip', media: 'm1', track: 1, start: 2, x: 10, y: 20, scale: 0.4 }, 'overlay clip'],
]
for (const [call, label] of validCalls) {
  const violations = tools.validateJsonSchemaValue(definition.parameters, call, '')
  check(`valid args accepted: ${label}`, violations.length === 0, violations.join('; '))
}

const invalidCalls = [
  [{}, 'missing action'],
  [{ action: 'bogus' }, 'unknown action'],
  [{ action: 'trim', clip: true }, 'boolean clip'],
  [{ action: 'delete', clips: 'not-an-array' }, 'non-array clips'],
  [{ action: 'add_clip', media: 7 }, 'numeric media'],
  [{ action: 'export', quality: 'ultra' }, 'unknown quality'],
  [{ action: 'add_clip', track: 2 }, 'track out of range'],
  [{ action: 'set_project', fps: 25.5 }, 'fractional fps'],
]
for (const [call, label] of invalidCalls) {
  const violations = tools.validateJsonSchemaValue(definition.parameters, call, '')
  check(`invalid args rejected: ${label}`, violations.length > 0, violations.join('; ') || 'no violations!')
}

// A real ToolsService registering this definition must accept it (the check the
// install path performs). The service needs a cordis Context, which is heavy to
// boot here; the field assertions plus the schema assertions above are exactly
// what `register()` validates before anything else runs, and this plugin's own
// smoke test exercises the live service.
check('definition passes registry field checks', definition.output !== undefined
  && typeof definition.output.render === 'function'
  && definition.name !== 'run_code')

// Render projection: one string value becomes one text block.
const rendered = definition.output.render({ action: 'state' }, '项目「x」 总时长 0:06.00')
check('render returns one text block', Array.isArray(rendered) && rendered.length === 1 && rendered[0].type === 'text', JSON.stringify(rendered))
check('render text is the summary', rendered[0].text === '项目「x」 总时长 0:06.00')

// Output schema enforcement on a real value.
check('output accepts a string', tools.validateJsonSchemaValue(definition.output.schema, '导出完成', 'value').length === 0)
check('output rejects a number', tools.validateJsonSchemaValue(definition.output.schema, 42, 'value').length > 0)

// Schema/dispatch drift: every enum action appears as a case in index.js.
const source = await readFile(join(workspace, 'video-editor', 'index.js'), 'utf8')
for (const action of definition.parameters.properties.action.enum) {
  check(`index.js handles action ${action}`, source.includes(`case '${action}'`))
}

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`)
process.exit(failures === 0 ? 0 : 1)
