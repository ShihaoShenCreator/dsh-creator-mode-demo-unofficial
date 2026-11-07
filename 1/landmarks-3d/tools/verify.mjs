/**
 * One command for the whole verification suite.
 *
 *   node tools/verify.mjs            # everything
 *   node tools/verify.mjs --no-preview   # skip PNG rendering
 *
 * Runs, in order: mesh verification, the shipped-bundle checks, the renderer
 * smoke test against a fake WebGL context, the headless render check, and the
 * end-to-end integration test that executes the built client.js the way the
 * browser does.
 */
import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const skipPreview = process.argv.includes('--no-preview');

const steps = [
  ['models', 'tools/verify-models.mjs'],
  ['bundle', 'tools/check-bundle.mjs'],
  ['styles', 'tools/check-styles.mjs'],
  ['renderer', 'tools/smoke.mjs'],
  ['render', 'tools/render-check.mjs'],
  ['integration', 'tools/integration.mjs'],
];
if (!skipPreview) steps.push(['preview', 'tools/preview.mjs']);

function run(script) {
  return new Promise((resolveRun) => {
    const child = spawn(process.execPath, [resolve(root, script)], {
      cwd: root,
      stdio: 'inherit',
    });
    child.on('close', (code) => resolveRun(code ?? 1));
  });
}

let failed = 0;
for (const [label, script] of steps) {
  console.log(`\n──── ${label} ────`);
  const code = await run(script);
  if (code !== 0) {
    failed += 1;
    console.error(`✗ ${label} failed (exit ${code})`);
  }
}

console.log(
  failed
    ? `\n${failed} suite step(s) failed.`
    : '\nAll verification steps passed.',
);
process.exit(failed ? 1 : 0);
