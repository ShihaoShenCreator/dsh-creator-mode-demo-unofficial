/**
 * Headless smoke test for the renderer and the model registry.
 *
 * It does not draw anything: it substitutes a recording fake WebGL context so
 * the exact call sequence the browser would make can be inspected. That
 * catches the failure modes a static check cannot — a missing uniform, an
 * attribute bound to the wrong buffer, or a model that produces no geometry —
 * without pretending to be a visual test.
 *
 *   node tools/smoke.mjs
 */
import { pathToFileURL } from 'node:url';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** A WebGL stub that records every call and validates the draw sequence. */
function fakeCanvas() {
  const calls = [];
  let nextId = 1;
  const constants = {
    VERTEX_SHADER: 0x8b31,
    FRAGMENT_SHADER: 0x8b30,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    DEPTH_TEST: 0x0b71,
    CULL_FACE: 0x0b44,
    BACK: 0x0405,
    LEQUAL: 0x0203,
    BLEND: 0x0be2,
    SRC_ALPHA: 0x0302,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    COLOR_BUFFER_BIT: 0x4000,
    DEPTH_BUFFER_BIT: 0x0100,
  };

  const gl = {
    ...constants,
    canvas: { width: 800, height: 600 },
    getContext: () => gl,
    createShader: () => ({ id: nextId++ }),
    shaderSource: (sh, src) => {
      if (typeof src !== 'string' || !src.trim()) throw new Error('empty shader source');
      sh.src = src;
    },
    compileShader: () => {},
    getShaderParameter: () => true,
    getShaderInfoLog: () => '',
    deleteShader: () => {},
    createProgram: () => ({ id: nextId++, uniforms: {}, attrs: {} }),
    attachShader: () => {},
    linkProgram: () => {},
    getProgramParameter: () => true,
    getProgramInfoLog: () => '',
    deleteProgram: () => {},
    getAttribLocation: (prog, name) => {
      if (!prog) throw new Error('getAttribLocation without a program');
      prog.attrs[name] = prog.attrs[name] ?? 0;
      return prog.attrs[name]++;
    },
    getUniformLocation: (prog, name) => {
      if (!prog) throw new Error('getUniformLocation without a program');
      return { program: prog.id, name };
    },
    useProgram: (p) => {
      if (!p) throw new Error('useProgram(null)');
      calls.push(['useProgram', p.id]);
    },
    createBuffer: () => ({ id: nextId++ }),
    bindBuffer: (target, buf) => calls.push(['bindBuffer', buf && buf.id]),
    bufferData: (target, data) => {
      if (!(data instanceof Float32Array)) throw new Error('bufferData needs a Float32Array');
      // The shared full-screen quad holds 6 vec2 vertices; model buffers hold
      // 9 floats per vertex (position, normal, colour).
      if (data.length !== 12 && data.length % 9 !== 0) {
        throw new Error(`vertex data length ${data.length} matches no known layout`);
      }
      calls.push(['bufferData', data.length]);
    },
    deleteBuffer: () => {},
    enableVertexAttribArray: (loc) => {
      if (loc !== null && loc !== undefined) calls.push(['enableAttrib', loc]);
    },
    vertexAttribPointer: (loc, size, type, norm, stride, offset) => {
      if (![1, 2, 3, 4].includes(size)) throw new Error(`bad vertex size ${size}`);
      // stride 0 is legal for tightly packed data, but only for a vec2 layout
      // (the shared quad); model vertices must declare their 9-float stride.
      if (size === 3 && !(stride > 0)) throw new Error(`model attribute with stride ${stride}`);
      calls.push(['attribPointer', size, stride, offset]);
    },
    uniformMatrix4fv: (loc, transpose, m) => {
      if (!loc) throw new Error('uniformMatrix4fv with no location');
      if (!(m && m.length === 16)) throw new Error(`matrix for ${loc.name} is not 16 floats`);
      calls.push(['uniformMatrix4fv', loc.name]);
    },
    uniform1f: (loc, v) => {
      if (!loc) throw new Error('uniform1f with no location');
      if (!Number.isFinite(v)) throw new Error(`uniform1f ${loc.name} is not finite (${v})`);
      calls.push(['uniform1f', loc.name]);
    },
    uniform2f: (loc, a, b) => {
      if (![a, b].every(Number.isFinite)) throw new Error(`uniform2f ${loc.name} not finite`);
    },
    uniform3fv: (loc, v) => {
      if (!loc) throw new Error('uniform3fv with no location');
      if (!(v && v.length === 3)) throw new Error(`uniform3fv ${loc.name} needs 3 floats`);
      if (!v.every(Number.isFinite)) throw new Error(`uniform3fv ${loc.name} not finite: ${v}`);
      calls.push(['uniform3fv', loc.name]);
    },
    drawArrays: (mode, first, count) => {
      if (mode !== constants.TRIANGLES) throw new Error('drawArrays with a non-triangle mode');
      if (!(count > 0)) throw new Error('drawArrays with zero vertices');
      if (count % 3 !== 0) throw new Error(`drawArrays vertex count ${count} is not a multiple of 3`);
      calls.push(['drawArrays', count]);
    },
    viewport: (x, y, w, h) => {
      if (!(w > 0 && h > 0)) throw new Error('viewport with a zero dimension');
      calls.push(['viewport', w, h]);
    },
    clear: () => calls.push(['clear']),
    clearColor: () => {},
    enable: () => {},
    disable: () => {},
    depthFunc: () => {},
    cullFace: () => {},
    depthMask: () => {},
    blendFunc: () => {},
    getExtension: () => null,
  };
  gl.getContext = () => gl;
  const canvas = {
    width: 800,
    height: 600,
    addEventListener: () => {},
    removeEventListener: () => {},
    getContext: () => gl,
  };
  canvas.calls = calls;
  canvas.gl = gl;
  return canvas;
}

const { LandmarkRenderer } = await import(pathToFileURL(resolve(root, 'src/view/renderer.js')).href);
const { loadModel, listLandmarks } = await import(pathToFileURL(resolve(root, 'src/client/models.js')).href);

let failures = 0;

const canvas = fakeCanvas();
let onLostCalls = 0;
const renderer = new LandmarkRenderer(canvas, { onLost: () => (onLostCalls += 1) });
console.log('✓ renderer constructed, shaders compiled and program linked');

renderer.resize(800, 600, 2);
if (canvas.width !== 1600 || canvas.height !== 1200) {
  console.error(`✗ resize produced ${canvas.width}×${canvas.height}, expected 1600×1200`);
  failures += 1;
} else {
  console.log('✓ resize honours the device pixel ratio');
}

for (const entry of listLandmarks()) {
  canvas.calls.length = 0;
  const tris = loadModel(entry.id);
  const metrics = renderer.setModel(tris);
  if (!metrics || !(metrics.radius > 0) || !(metrics.height > 0)) {
    console.error(`✗ ${entry.id}: setModel returned no usable metrics`);
    failures += 1;
    continue;
  }
  const draws = canvas.calls.filter((c) => c[0] === 'drawArrays');
  if (draws.length) {
    console.error(`✗ ${entry.id}: setModel drew before a frame was requested`);
    failures += 1;
  }
  canvas.calls.length = 0;
  const cam = { yaw: 0.72, pitch: 0.3, zoom: 1, target: [0, metrics.height * 0.42, 0] };
  const style = {
    sun: [0.4, 0.7, 0.6],
    sky: [0.6, 0.7, 0.8],
    bounce: [0.3, 0.3, 0.3],
    discInner: [0.8, 0.8, 0.8],
    discOuter: [0.7, 0.7, 0.7],
    shadow: 0.2,
  };
  renderer.draw(cam, style);
  const drawCount = canvas.calls.filter((c) => c[0] === 'drawArrays').length;
  // Three passes: ground disc (6 verts), contact shadow (6), model (3·tris).
  if (drawCount !== 3) {
    console.error(`✗ ${entry.id}: expected 3 draw calls, got ${drawCount}`);
    failures += 1;
  } else {
    const modelDraw = canvas.calls.filter((c) => c[0] === 'drawArrays').at(-1);
    if (modelDraw[1] !== tris.length * 3) {
      console.error(`✗ ${entry.id}: model draw had ${modelDraw[1]} verts, expected ${tris.length * 3}`);
      failures += 1;
    }
    const viewCalls = canvas.calls.filter((c) => c[0] === 'uniformMatrix4fv' && /View/.test(c[1]));
    if (viewCalls.length !== 3) {
      console.error(`✗ ${entry.id}: the view matrix was not set for every pass`);
      failures += 1;
    }
    // Camera fit must be far enough that the sphere is inside the frustum.
    const fit = renderer.fitDistance(4 / 3, 1.1);
    if (!(fit > metrics.radius)) {
      console.error(`✗ ${entry.id}: fit distance ${fit} is inside the model radius ${metrics.radius}`);
      failures += 1;
    }
  }
  const verts = tris.length * 3;
  console.log(`✓ ${entry.id}: ${drawCount} draws, ${verts} vertices, radius ${metrics.radius.toFixed(1)} m, fit ${renderer.fitDistance(4 / 3).toFixed(1)} m`);
}

// Context loss must be recoverable: the renderer drops its buffers and reports.
canvas.gl.dispatchEvent = null;
renderer._lostHandler({ preventDefault: () => {} });
if (canvas.calls) {
  // After loss the renderer refuses to draw rather than throwing.
  let threw = false;
  try {
    renderer.draw({ yaw: 0, pitch: 0.3, zoom: 1, target: [0, 0, 0] }, {
      sun: [0, 1, 0], sky: [0, 0, 0], bounce: [0, 0, 0],
      discInner: [0, 0, 0], discOuter: [0, 0, 0], shadow: 0,
    });
  } catch {
    threw = true;
  }
  if (threw) {
    console.error('✗ draw threw after context loss');
    failures += 1;
  } else {
    console.log('✓ context loss stops drawing without throwing');
  }
  if (!onLostCalls) {
    console.error('✗ context loss did not invoke the onLost callback');
    failures += 1;
  }
}

renderer.dispose();
console.log(failures ? `\n${failures} smoke check(s) failed.` : '\nAll renderer smoke checks passed.');
process.exit(failures ? 1 : 0);
