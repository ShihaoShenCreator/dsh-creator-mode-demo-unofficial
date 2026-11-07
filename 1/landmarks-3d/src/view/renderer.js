/**
 * Compact WebGL renderer for landmark meshes.
 *
 * Draws flat-shaded, per-face-coloured triangles with a sun + hemisphere
 * ambient term, over a soft ground disc and contact shadow. Lighting is
 * computed in world space so the sun stays fixed while the model orbits.
 *
 * The vertex buffer is baked once per model: position, face normal,
 * face colour. There is no index buffer — triangle soup is already what
 * `geom-kit` produces, and one draw call keeps this fast.
 */

import {
  mat4,
  perspective,
  lookAt,
  multiply,
  unit,
  cross,
  sub,
  dot,
  lightDir,
} from './math.js';

const MODEL_VERT = `
attribute vec3 aPos;
attribute vec3 aNrm;
attribute vec3 aCol;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
varying vec3 vNrm;
varying vec3 vCol;
varying vec3 vWorld;
void main() {
  vec4 w = uModel * vec4(aPos, 1.0);
  vWorld = w.xyz;
  vNrm = (uModel * vec4(aNrm, 0.0)).xyz;
  vCol = aCol;
  gl_Position = uProj * uView * w;
}
`;

const MODEL_FRAG = `
precision mediump float;
varying vec3 vNrm;
varying vec3 vCol;
varying vec3 vWorld;
uniform vec3 uSun;
uniform vec3 uSky;
uniform vec3 uBounce;
uniform vec3 uEye;
void main() {
  vec3 n = normalize(vNrm);
  float lambert = max(dot(n, uSun), 0.0);
  // Hemisphere ambient: sky above, faint bounce below.
  float hemi = 0.5 + 0.5 * n.y;
  vec3 ambient = mix(uBounce, uSky, hemi);
  vec3 col = vCol * ambient + vCol * (lambert * 0.82);
  // A whisper of rim light keeps dark iron edges from going flat black.
  vec3 v = normalize(uEye - vWorld);
  float rim = pow(1.0 - max(dot(n, v), 0.0), 3.0);
  col += vec3(0.09, 0.10, 0.12) * rim;
  gl_FragColor = vec4(col, 1.0);
}
`;

const DISC_VERT = `
attribute vec2 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
varying vec2 vXZ;
void main() {
  vec4 w = uModel * vec4(aPos.x, 0.0, aPos.y, 1.0);
  vXZ = aPos;
  gl_Position = uProj * uView * w;
}
`;

const DISC_FRAG = `
precision mediump float;
varying vec2 vXZ;
uniform float uRadius;
uniform vec3 uInner;
uniform vec3 uOuter;
void main() {
  float d = length(vXZ) / uRadius;
  float t = clamp(d, 0.0, 1.0);
  float edge = 1.0 - smoothstep(0.55, 1.0, t);
  float core = 1.0 - smoothstep(0.0, 0.92, t);
  vec3 col = mix(uOuter, uInner, core);
  gl_FragColor = vec4(col, edge * 0.9);
}
`;

/** A soft elliptical contact shadow, drawn just above the ground disc. */
const SHADOW_VERT = `
attribute vec2 aPos;
uniform mat4 uProj;
uniform mat4 uView;
uniform mat4 uModel;
varying vec2 vXZ;
void main() {
  vec4 w = uModel * vec4(aPos.x, 0.0, aPos.y, 1.0);
  vXZ = aPos;
  gl_Position = uProj * uView * w;
}
`;

const SHADOW_FRAG = `
precision mediump float;
varying vec2 vXZ;
uniform vec2 uHalf;
uniform float uStrength;
void main() {
  float d = length(vXZ / uHalf);
  float a = (1.0 - smoothstep(0.15, 1.0, d)) * uStrength;
  gl_FragColor = vec4(0.0, 0.0, 0.0, a);
}
`;

function compile(gl, type, src) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(sh);
    gl.deleteShader(sh);
    throw new Error(`shader compile failed: ${log}`);
  }
  return sh;
}

function program(gl, vert, frag) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vert));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, frag));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(p);
    gl.deleteProgram(p);
    throw new Error(`program link failed: ${log}`);
  }
  return p;
}

function attribute(gl, prog, name) {
  const loc = gl.getAttribLocation(prog, name);
  return loc < 0 ? null : loc;
}

function uniform(gl, prog, name) {
  return gl.getUniformLocation(prog, name);
}

/** Build the interleaved model buffer (9 floats per vertex). */
function packModel(tris, offset) {
  const count = tris.length * 3;
  const data = new Float32Array(count * 9);
  let o = 0;
  for (let i = 0; i < tris.length; i += 1) {
    const t = tris[i];
    // Face normal from the cross product of the triangle's edges.
    const ax = t.p[3] - t.p[0],
      ay = t.p[4] - t.p[1],
      az = t.p[5] - t.p[2];
    const bx = t.p[6] - t.p[0],
      by = t.p[7] - t.p[1],
      bz = t.p[8] - t.p[2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L;
    ny /= L;
    nz /= L;
    const r = t.c[0],
      g = t.c[1],
      b = t.c[2];
    for (let v = 0; v < 3; v += 1) {
      data[o] = t.p[v * 3] - offset[0];
      data[o + 1] = t.p[v * 3 + 1] - offset[1];
      data[o + 2] = t.p[v * 3 + 2] - offset[2];
      data[o + 3] = nx;
      data[o + 4] = ny;
      data[o + 5] = nz;
      data[o + 6] = r;
      data[o + 7] = g;
      data[o + 8] = b;
      o += 9;
    }
  }
  return { data, vertexCount: count };
}

export class LandmarkRenderer {
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.onLost = options.onLost ?? null;
    this.gl = null;
    this.ready = false;
    this.model = null;
    this.buffers = null;
    this.frame = 0;
    this._pixRatio = 1;
    this._lostHandler = (ev) => {
      // Calling preventDefault lets the browser restore the context later.
      ev.preventDefault();
      this.ready = false;
      this.buffers = null;
      if (this.onLost) this.onLost();
    };
    this._restoreHandler = () => {
      this._init();
      if (this.model) this.setModel(this.model);
    };
    canvas.addEventListener('webglcontextlost', this._lostHandler, false);
    canvas.addEventListener('webglcontextrestored', this._restoreHandler, false);
    this._init();
  }

  _init() {
    const gl = this.canvas.getContext('webgl', {
      alpha: true,
      antialias: true,
      depth: true,
      premultipliedAlpha: false,
      powerPreference: 'default',
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL is unavailable');
    this.gl = gl;
    this.progModel = program(gl, MODEL_VERT, MODEL_FRAG);
    this.progDisc = program(gl, DISC_VERT, DISC_FRAG);
    this.progShadow = program(gl, SHADOW_VERT, SHADOW_FRAG);

    this.loc = {
      pPos: attribute(gl, this.progModel, 'aPos'),
      pNrm: attribute(gl, this.progModel, 'aNrm'),
      pCol: attribute(gl, this.progModel, 'aCol'),
      pProj: uniform(gl, this.progModel, 'uProj'),
      pView: uniform(gl, this.progModel, 'uView'),
      pModel: uniform(gl, this.progModel, 'uModel'),
      pSun: uniform(gl, this.progModel, 'uSun'),
      pSky: uniform(gl, this.progModel, 'uSky'),
      pBounce: uniform(gl, this.progModel, 'uBounce'),
      pEye: uniform(gl, this.progModel, 'uEye'),

      dPos: attribute(gl, this.progDisc, 'aPos'),
      dProj: uniform(gl, this.progDisc, 'uProj'),
      dView: uniform(gl, this.progDisc, 'uView'),
      dModel: uniform(gl, this.progDisc, 'uModel'),
      dRadius: uniform(gl, this.progDisc, 'uRadius'),
      dInner: uniform(gl, this.progDisc, 'uInner'),
      dOuter: uniform(gl, this.progDisc, 'uOuter'),

      sPos: attribute(gl, this.progShadow, 'aPos'),
      sProj: uniform(gl, this.progShadow, 'uProj'),
      sView: uniform(gl, this.progShadow, 'uView'),
      sModel: uniform(gl, this.progShadow, 'uModel'),
      sHalf: uniform(gl, this.progShadow, 'uHalf'),
      sStrength: uniform(gl, this.progShadow, 'uStrength'),
    };

    // Disc + shadow geometry: a unit quad in the XZ plane, reused for both.
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW,
    );
    gl.bindBuffer(gl.ARRAY_BUFFER, null);

    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.enable(gl.CULL_FACE);
    gl.cullFace(gl.BACK);
    gl.clearColor(0, 0, 0, 0);
    this.ready = true;
  }

  /** Upload a triangle array as the current model. */
  setModel(tris) {
    const gl = this.gl;
    if (!gl || !tris || !tris.length) {
      this.model = null;
      return null;
    }
    this.model = tris;

    // Translate the model so its footprint centre sits at the origin and its
    // lowest point rests on y = 0; the builder already aims for that, but a
    // model that drifts should still stand on the ground.
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      minZ = Infinity,
      maxZ = -Infinity,
      maxY = -Infinity;
    for (let i = 0; i < tris.length; i += 1) {
      const p = tris[i].p;
      for (let v = 0; v < 3; v += 1) {
        const x = p[v * 3],
          y = p[v * 3 + 1],
          z = p[v * 3 + 2];
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
        if (z < minZ) minZ = z;
        if (z > maxZ) maxZ = z;
      }
    }
    const offset = [(minX + maxX) / 2, minY, (minZ + maxZ) / 2];
    const halfX = (maxX - minX) / 2;
    const halfZ = (maxZ - minZ) / 2;
    const height = maxY - minY;
    // Extents used for framing and for the ground disc / contact shadow:
    // the circumradius of the footprint, its depth radius, and the restored
    // world-space Y bounds (the model is translated so it rests on y = 0).
    const footprintRadius = Math.hypot(halfX, halfZ) || 1;
    const depthRadius = Math.max(halfX, halfZ) || 1;
    const radius = Math.hypot(footprintRadius, height * 0.5) || 1;

    const packed = packModel(tris, offset);
    if (this.buffers) {
      gl.deleteBuffer(this.buffers.vbo);
      this.buffers = null;
    }
    const vbo = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.bufferData(gl.ARRAY_BUFFER, packed.data, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
    this.buffers = { vbo, vertexCount: packed.vertexCount };

    this.metrics = {
      radius,
      height,
      halfX,
      halfZ,
      footprint: Math.max(halfX, halfZ) || radius * 0.5,
      footprintRadius,
      depthRadius,
      minY: 0,
      maxY: height,
    };
    return this.metrics;
  }

  resize(cssWidth, cssHeight, dpr) {
    const c = this.canvas;
    const w = Math.max(1, Math.round(cssWidth * dpr));
    const h = Math.max(1, Math.round(cssHeight * dpr));
    if (c.width !== w || c.height !== h) {
      c.width = w;
      c.height = h;
    }
    this._pixRatio = dpr;
  }

  /**
   * Camera distance that exactly frames the model's bounding box for the given
   * orbit and target.
   *
   * The eight box corners are projected onto the camera's right and up axes;
   * the distance is the smallest one that keeps every corner inside the
   * frustum. Fitting per axis matters because a 330 m tower is limited by the
   * vertical half-angle while a 1 km wall is limited by the horizontal one —
   * a single bounding-sphere radius would push the wall out to a distant
   * sliver.
   */
  fitDistance(aspect, camera = {}) {
    if (!this.metrics) return 1;
    const m = this.metrics;
    const yaw = camera.yaw ?? 0.72;
    const pitch = camera.pitch ?? 0.3;
    const target = camera.target ?? [0, m.height * 0.42, 0];
    const margin = camera.margin ?? 1.04;

    // Camera basis for a Y-up orbit: forward points from the eye to the
    // target, right is horizontal, up completes the frame.
    const cp = Math.cos(pitch);
    const eyeDir = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
    const forward = [-eyeDir[0], -eyeDir[1], -eyeDir[2]];
    const right = unit(cross(forward, [0, 1, 0]));
    const up = cross(right, forward);

    const fovy = 0.72;
    const tanV = Math.tan(fovy / 2);
    const tanH = tanV * Math.max(0.45, aspect);

    let needed = 0;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const p = [
            sx * m.halfX,
            sy > 0 ? m.maxY : m.minY,
            sz * m.halfZ,
          ];
          const dx = p[0] - target[0];
          const dy = p[1] - target[1];
          const dz = p[2] - target[2];
          // Corner coordinates in the camera frame.
          const cx = dot([dx, dy, dz], right);
          const cy = dot([dx, dy, dz], up);
          const cz = dot([dx, dy, dz], forward);
          // Distance so this corner lands on the corresponding frustum plane.
          const needX = Math.abs(cx) / tanH - cz;
          const needY = Math.abs(cy) / tanV - cz;
          needed = Math.max(needed, needX, needY);
        }
      }
    }
    return Math.max(needed * margin, m.radius * 0.35);
  }

  /**
   * Draw one frame.
   * `cam` = { yaw, pitch, zoom, target: [x,y,z] }
   * `style` = { sun: [x,y,z], sky, bounce, discInner, discOuter, shadow }
   */
  draw(cam, style) {
    const gl = this.gl;
    if (!gl || !this.ready || !this.metrics) return;
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const aspect = this.canvas.width / Math.max(1, this.canvas.height);
    const fovy = 0.72;
    const target = cam.target ?? [0, this.metrics.height * 0.42, 0];
    const distance = this.fitDistance(aspect, {
      yaw: cam.yaw,
      pitch: cam.pitch,
      target,
    }) * (cam.zoom || 1);
    const near = Math.max(0.01, distance * 0.02);
    const far = Math.max(10, distance * 12 + this.metrics.radius * 8);
    const proj = perspective(fovy, aspect, near, far);

    const cp = Math.cos(cam.pitch);
    const eye = [
      target[0] + Math.sin(cam.yaw) * cp * distance,
      target[1] + Math.sin(cam.pitch) * distance,
      target[2] + Math.cos(cam.yaw) * cp * distance,
    ];
    const view = lookAt(eye, target, [0, 1, 0]);

    const radius = this.metrics.radius;
    const discR = radius * 2.1;
    const model = mat4();

    // --- ground disc (blended, no depth interference with the model) ---
    gl.useProgram(this.progDisc);
    gl.disable(gl.CULL_FACE);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.depthMask(false);
    gl.uniformMatrix4fv(this.loc.dProj, false, proj);
    gl.uniformMatrix4fv(this.loc.dView, false, view);
    gl.uniformMatrix4fv(this.loc.dModel, false, model);
    gl.uniform1f(this.loc.dRadius, discR);
    gl.uniform3fv(this.loc.dInner, style.discInner);
    gl.uniform3fv(this.loc.dOuter, style.discOuter);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(this.loc.dPos);
    gl.vertexAttribPointer(this.loc.dPos, 2, gl.FLOAT, false, 0, 0);
    // The disc uses world-space metres, so scale the unit quad.
    gl.uniformMatrix4fv(
      this.loc.dModel,
      false,
      scaleTranslate(discR, 0, discR),
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // --- contact shadow ---
    gl.useProgram(this.progShadow);
    gl.uniformMatrix4fv(this.loc.sProj, false, proj);
    gl.uniformMatrix4fv(this.loc.sView, false, view);
    gl.uniformMatrix4fv(
      this.loc.sModel,
      false,
      scaleTranslate(this.metrics.footprint * 1.9, 0.06, this.metrics.footprint * 1.9),
    );
    gl.uniform2f(this.loc.sHalf, this.metrics.footprint * 1.35 || 1, this.metrics.footprint * 1.35 || 1);
    gl.uniform1f(this.loc.sStrength, style.shadow);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(this.loc.sPos);
    gl.vertexAttribPointer(this.loc.sPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    // --- model ---
    gl.disable(gl.BLEND);
    gl.depthMask(true);
    gl.enable(gl.CULL_FACE);
    if (!this.buffers) return;
    gl.useProgram(this.progModel);
    gl.uniformMatrix4fv(this.loc.pProj, false, proj);
    gl.uniformMatrix4fv(this.loc.pView, false, view);
    gl.uniformMatrix4fv(this.loc.pModel, false, model);
    gl.uniform3fv(this.loc.pSun, style.sun);
    gl.uniform3fv(this.loc.pSky, style.sky);
    gl.uniform3fv(this.loc.pBounce, style.bounce);
    gl.uniform3fv(this.loc.pEye, eye);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.buffers.vbo);
    const stride = 9 * 4;
    gl.enableVertexAttribArray(this.loc.pPos);
    gl.vertexAttribPointer(this.loc.pPos, 3, gl.FLOAT, false, stride, 0);
    gl.enableVertexAttribArray(this.loc.pNrm);
    gl.vertexAttribPointer(this.loc.pNrm, 3, gl.FLOAT, false, stride, 3 * 4);
    gl.enableVertexAttribArray(this.loc.pCol);
    gl.vertexAttribPointer(this.loc.pCol, 3, gl.FLOAT, false, stride, 6 * 4);
    gl.drawArrays(gl.TRIANGLES, 0, this.buffers.vertexCount);
    gl.bindBuffer(gl.ARRAY_BUFFER, null);
  }

  dispose() {
    const gl = this.gl;
    this.canvas.removeEventListener('webglcontextlost', this._lostHandler, false);
    this.canvas.removeEventListener('webglcontextrestored', this._restoreHandler, false);
    if (!gl) return;
    if (this.buffers) gl.deleteBuffer(this.buffers.vbo);
    gl.deleteBuffer(this.quadBuf);
    gl.deleteProgram(this.progModel);
    gl.deleteProgram(this.progDisc);
    gl.deleteProgram(this.progShadow);
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
    this.gl = null;
    this.ready = false;
    this.buffers = null;
  }
}

/** Uniform scale + Y translation, used for the unit quad passes. */
function scaleTranslate(sx, y, sz) {
  const m = mat4();
  m[0] = sx;
  m[5] = 1;
  m[10] = sz;
  m[13] = y;
  return m;
}

/** Fixed sun direction shared with the UI legend. */
export const SUN = unit(lightDir(-0.62, 0.55));
export { unit, cross, sub };
