/**
 * Static verifier for landmark meshes. Run with:
 *   node tools/verify-models.mjs            # every model that exists
 *   node tools/verify-models.mjs eiffel     # only models whose name matches
 *
 * It reports triangle counts, bounds (so units stay sane in metres), NaN
 * vertices, degenerate faces, and winding consistency. A model that fails
 * exits non-zero; an unfinished model (file missing) is reported as MISSING
 * and does not fail the run while other models are still being authored.
 */
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { existsSync } from 'node:fs';

const MODELS = [
  { file: 'src/models/eiffel.js', name: 'eiffel', tests: { minH: 280, maxH: 400, maxW: 220 } },
  // The Great Wall scene height includes the ridge it rides; the wall alone
  // is ~7 m. Footprint is the compressed scene, not the real wall's length.
  { file: 'src/models/great-wall.js', name: 'great-wall', tests: { minH: 30, maxH: 70, maxW: 620 } },
  { file: 'src/models/forbidden-city.js', name: 'forbidden-city', tests: { minH: 10, maxH: 60, maxW: 1100 } },
  { file: 'src/models/taj-mahal.js', name: 'taj-mahal', tests: { minH: 40, maxH: 120, maxW: 200 } },
];

const filter = process.argv.slice(2).filter((a) => !a.startsWith('-'));
const only = filter.length ? new Set(filter) : null;

let failures = 0;
let checked = 0;

function fmt(n) {
  return typeof n === 'number' ? (Math.abs(n) > 1e9 ? 'n/a' : n.toFixed(2)) : String(n);
}

for (const model of MODELS) {
  if (only && !only.has(model.name)) continue;
  const abs = resolve(model.file);
  if (!existsSync(abs)) {
    console.log(`- ${model.name}: MISSING (${model.file})`);
    continue;
  }
  checked += 1;
  let tris;
  try {
    const mod = await import(pathToFileURL(abs).href);
    const build = mod.build ?? mod.default?.build ?? mod.default;
    if (typeof build !== 'function') throw new Error('module exports no build() function');
    tris = build();
  } catch (err) {
    failures += 1;
    console.error(`✗ ${model.name}: threw while building\n    ${err && err.stack ? err.stack : err}`);
    continue;
  }
  if (!Array.isArray(tris) || tris.length === 0) {
    failures += 1;
    console.error(`✗ ${model.name}: build() returned no triangles`);
    continue;
  }

  const problems = [];
  let nan = 0;
  let degenerate = 0;
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  // Directed edge table for winding consistency: every shared edge must be
  // walked once in each direction. Edges only appearing once mean an open
  // boundary; that is allowed (ground planes) and only reported.
  const edges = new Map();
  const key = (a, c) => {
    // Quantise to 1e-4 m so independently built parts still pair up.
    const q = (v) => Math.round(v * 1e4);
    return `${q(a[0])},${q(a[1])},${q(a[2])}>${q(c[0])},${q(c[1])},${q(c[2])}`;
  };
  let volume = 0;
  for (const t of tris) {
    if (!t || !Array.isArray(t.p) || t.p.length !== 9) {
      problems.push('triangle without a 9-number `p` array');
      break;
    }
    for (let i = 0; i < 9; i += 1) {
      const v = t.p[i];
      if (!Number.isFinite(v)) nan += 1;
      if (!Number.isFinite(v)) continue;
      const axis = i % 3;
      const val = v;
      if (axis === 0) {
        if (val < b[0]) b[0] = val;
        if (val > b[3]) b[3] = val;
      } else if (axis === 1) {
        if (val < b[1]) b[1] = val;
        if (val > b[4]) b[4] = val;
      } else {
        if (val < b[2]) b[2] = val;
        if (val > b[5]) b[5] = val;
      }
    }
    const a = [t.p[0], t.p[1], t.p[2]];
    const c = [t.p[3], t.p[4], t.p[5]];
    const d = [t.p[6], t.p[7], t.p[8]];
    const nx = (c[1] - a[1]) * (d[2] - a[2]) - (c[2] - a[2]) * (d[1] - a[1]);
    const ny = (c[2] - a[2]) * (d[0] - a[0]) - (c[0] - a[0]) * (d[2] - a[2]);
    const nz = (c[0] - a[0]) * (d[1] - a[1]) - (c[1] - a[1]) * (d[0] - a[0]);
    if (nx * nx + ny * ny + nz * nz < 1e-16) degenerate += 1;
    volume += a[0] * (c[1] * d[2] - c[2] * d[1]) - a[1] * (c[0] * d[2] - c[2] * d[0]) + a[2] * (c[0] * d[1] - c[1] * d[0]);
    for (const [u, v] of [
      [a, c],
      [c, d],
      [d, a],
    ]) {
      const k = key(u, v);
      edges.set(k, (edges.get(k) ?? 0) + 1);
    }
  }
  let openEdges = 0;
  let flippedEdges = 0;
  for (const [k, n] of edges) {
    if (n === 2) continue;
    if (n === 1) {
      const [u, v] = k.split('>');
      const rev = `${v}>${u}`;
      if (!edges.has(rev)) openEdges += 1;
    } else {
      flippedEdges += 1;
    }
  }

  const h = b[4] - b[1];
  const w = Math.max(b[3] - b[0], b[5] - b[2]);
  if (nan) problems.push(`${nan} non-finite vertex coordinates`);
  if (degenerate) problems.push(`${degenerate} degenerate (zero-area) triangles`);
  if (flippedEdges) problems.push(`${flippedEdges} edges shared inconsistently (winding bugs)`);
  if (!(h >= model.tests.minH && h <= model.tests.maxH)) problems.push(`height ${fmt(h)} m outside ${model.tests.minH}..${model.tests.maxH} m`);
  if (!(w <= model.tests.maxW)) problems.push(`footprint ${fmt(w)} m exceeds ${model.tests.maxW} m`);
  if (volume < 0) problems.push(`negative signed volume (${fmt(volume)} m³): surfaces point inward`);

  const mark = problems.length ? '✗' : '✓';
  console.log(
    `${mark} ${model.name}: ${tris.length} tris, bbox x[${fmt(b[0])}, ${fmt(b[3])}] y[${fmt(b[1])}, ${fmt(b[4])}] z[${fmt(b[2])}, ${fmt(b[5])}], h=${fmt(h)} m, open edges=${openEdges}, vol=${fmt(volume)}`,
  );
  if (problems.length) {
    failures += 1;
    for (const p of problems) console.error(`    - ${p}`);
  }
}

if (!checked) {
  console.error('No models were checked (nothing exists yet).');
  process.exit(1);
}
if (failures) {
  console.error(`\n${failures} model(s) failed verification.`);
  process.exit(1);
}
console.log('\nAll present models passed.');
