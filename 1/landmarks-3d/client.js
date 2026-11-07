// src/view/math.js
function mat4() {
  const m = new Float32Array(16);
  m[0] = 1;
  m[5] = 1;
  m[10] = 1;
  m[15] = 1;
  return m;
}
function perspective(fovy, aspect, near, far) {
  const out = mat4();
  const f = 1 / Math.tan(fovy / 2);
  out[0] = f / aspect;
  out[5] = f;
  out[10] = (far + near) / (near - far);
  out[11] = -1;
  out[14] = 2 * far * near / (near - far);
  out[15] = 0;
  return out;
}
function lookAt(eye, center, up) {
  const z = unit(sub(eye, center));
  const x = unit(cross(up, z));
  const y = cross(z, x);
  const out = mat4();
  out[0] = x[0];
  out[1] = y[0];
  out[2] = z[0];
  out[3] = 0;
  out[4] = x[1];
  out[5] = y[1];
  out[6] = z[1];
  out[7] = 0;
  out[8] = x[2];
  out[9] = y[2];
  out[10] = z[2];
  out[11] = 0;
  out[12] = -dot(x, eye);
  out[13] = -dot(y, eye);
  out[14] = -dot(z, eye);
  out[15] = 1;
  return out;
}
function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}
function unit(v) {
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
}
function lightDir(yaw, pitch) {
  const cp = Math.cos(pitch);
  return [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
}

// src/view/renderer.js
var MODEL_VERT = `
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
var MODEL_FRAG = `
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
var DISC_VERT = `
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
var DISC_FRAG = `
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
var SHADOW_VERT = `
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
var SHADOW_FRAG = `
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
function packModel(tris, offset) {
  const count = tris.length * 3;
  const data = new Float32Array(count * 9);
  let o = 0;
  for (let i = 0; i < tris.length; i += 1) {
    const t = tris[i];
    const ax = t.p[3] - t.p[0], ay = t.p[4] - t.p[1], az = t.p[5] - t.p[2];
    const bx = t.p[6] - t.p[0], by = t.p[7] - t.p[1], bz = t.p[8] - t.p[2];
    let nx = ay * bz - az * by;
    let ny = az * bx - ax * bz;
    let nz = ax * by - ay * bx;
    const L = Math.hypot(nx, ny, nz) || 1;
    nx /= L;
    ny /= L;
    nz /= L;
    const r = t.c[0], g = t.c[1], b = t.c[2];
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
var LandmarkRenderer = class {
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
      ev.preventDefault();
      this.ready = false;
      this.buffers = null;
      if (this.onLost) this.onLost();
    };
    this._restoreHandler = () => {
      this._init();
      if (this.model) this.setModel(this.model);
    };
    canvas.addEventListener("webglcontextlost", this._lostHandler, false);
    canvas.addEventListener("webglcontextrestored", this._restoreHandler, false);
    this._init();
  }
  _init() {
    const gl = this.canvas.getContext("webgl", {
      alpha: true,
      antialias: true,
      depth: true,
      premultipliedAlpha: false,
      powerPreference: "default",
      preserveDrawingBuffer: false
    });
    if (!gl) throw new Error("WebGL is unavailable");
    this.gl = gl;
    this.progModel = program(gl, MODEL_VERT, MODEL_FRAG);
    this.progDisc = program(gl, DISC_VERT, DISC_FRAG);
    this.progShadow = program(gl, SHADOW_VERT, SHADOW_FRAG);
    this.loc = {
      pPos: attribute(gl, this.progModel, "aPos"),
      pNrm: attribute(gl, this.progModel, "aNrm"),
      pCol: attribute(gl, this.progModel, "aCol"),
      pProj: uniform(gl, this.progModel, "uProj"),
      pView: uniform(gl, this.progModel, "uView"),
      pModel: uniform(gl, this.progModel, "uModel"),
      pSun: uniform(gl, this.progModel, "uSun"),
      pSky: uniform(gl, this.progModel, "uSky"),
      pBounce: uniform(gl, this.progModel, "uBounce"),
      pEye: uniform(gl, this.progModel, "uEye"),
      dPos: attribute(gl, this.progDisc, "aPos"),
      dProj: uniform(gl, this.progDisc, "uProj"),
      dView: uniform(gl, this.progDisc, "uView"),
      dModel: uniform(gl, this.progDisc, "uModel"),
      dRadius: uniform(gl, this.progDisc, "uRadius"),
      dInner: uniform(gl, this.progDisc, "uInner"),
      dOuter: uniform(gl, this.progDisc, "uOuter"),
      sPos: attribute(gl, this.progShadow, "aPos"),
      sProj: uniform(gl, this.progShadow, "uProj"),
      sView: uniform(gl, this.progShadow, "uView"),
      sModel: uniform(gl, this.progShadow, "uModel"),
      sHalf: uniform(gl, this.progShadow, "uHalf"),
      sStrength: uniform(gl, this.progShadow, "uStrength")
    };
    this.quadBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, 1, 1, -1, -1, 1, 1, -1, 1]),
      gl.STATIC_DRAW
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
    let minX = Infinity, maxX = -Infinity, minY = Infinity, minZ = Infinity, maxZ = -Infinity, maxY = -Infinity;
    for (let i = 0; i < tris.length; i += 1) {
      const p = tris[i].p;
      for (let v = 0; v < 3; v += 1) {
        const x = p[v * 3], y = p[v * 3 + 1], z = p[v * 3 + 2];
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
      maxY: height
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
            sz * m.halfZ
          ];
          const dx = p[0] - target[0];
          const dy = p[1] - target[1];
          const dz = p[2] - target[2];
          const cx = dot([dx, dy, dz], right);
          const cy = dot([dx, dy, dz], up);
          const cz = dot([dx, dy, dz], forward);
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
      target
    }) * (cam.zoom || 1);
    const near = Math.max(0.01, distance * 0.02);
    const far = Math.max(10, distance * 12 + this.metrics.radius * 8);
    const proj = perspective(fovy, aspect, near, far);
    const cp = Math.cos(cam.pitch);
    const eye = [
      target[0] + Math.sin(cam.yaw) * cp * distance,
      target[1] + Math.sin(cam.pitch) * distance,
      target[2] + Math.cos(cam.yaw) * cp * distance
    ];
    const view = lookAt(eye, target, [0, 1, 0]);
    const radius = this.metrics.radius;
    const discR = radius * 2.1;
    const model = mat4();
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
    gl.uniformMatrix4fv(
      this.loc.dModel,
      false,
      scaleTranslate(discR, 0, discR)
    );
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    gl.useProgram(this.progShadow);
    gl.uniformMatrix4fv(this.loc.sProj, false, proj);
    gl.uniformMatrix4fv(this.loc.sView, false, view);
    gl.uniformMatrix4fv(
      this.loc.sModel,
      false,
      scaleTranslate(this.metrics.footprint * 1.9, 0.06, this.metrics.footprint * 1.9)
    );
    gl.uniform2f(this.loc.sHalf, this.metrics.footprint * 1.35 || 1, this.metrics.footprint * 1.35 || 1);
    gl.uniform1f(this.loc.sStrength, style.shadow);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quadBuf);
    gl.enableVertexAttribArray(this.loc.sPos);
    gl.vertexAttribPointer(this.loc.sPos, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
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
    this.canvas.removeEventListener("webglcontextlost", this._lostHandler, false);
    this.canvas.removeEventListener("webglcontextrestored", this._restoreHandler, false);
    if (!gl) return;
    if (this.buffers) gl.deleteBuffer(this.buffers.vbo);
    gl.deleteBuffer(this.quadBuf);
    gl.deleteProgram(this.progModel);
    gl.deleteProgram(this.progDisc);
    gl.deleteProgram(this.progShadow);
    const lose = gl.getExtension("WEBGL_lose_context");
    if (lose) lose.loseContext();
    this.gl = null;
    this.ready = false;
    this.buffers = null;
  }
};
function scaleTranslate(sx, y, sz) {
  const m = mat4();
  m[0] = sx;
  m[5] = 1;
  m[10] = sz;
  m[13] = y;
  return m;
}
var SUN = unit(lightDir(-0.62, 0.55));

// src/geom-kit.js
var EPS = 1e-9;
function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
function hex(value) {
  let s = String(value).replace(/^#/, "");
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (!/^[0-9a-f]{6}$/i.test(s)) throw new Error(`bad colour: ${value}`);
  const n = parseInt(s, 16);
  return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255];
}
function shade(c, k) {
  return [clamp01(c[0] * k), clamp01(c[1] * k), clamp01(c[2] * k)];
}
function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t
  ];
}
function norm(v) {
  const L = Math.hypot(v[0], v[1], v[2]);
  if (L < EPS) return [0, 1, 0];
  return [v[0] / L, v[1] / L, v[2] / L];
}
function cross2(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}
function sub2(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}
function createBuilder() {
  const tris = [];
  function push(a, b, c, colour) {
    const abx = b[0] - a[0], aby = b[1] - a[1], abz = b[2] - a[2];
    const acx = c[0] - a[0], acy = c[1] - a[1], acz = c[2] - a[2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    if (nx * nx + ny * ny + nz * nz < 1e-14) return;
    tris.push({
      p: [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]],
      c: [colour[0], colour[1], colour[2]]
    });
  }
  function triangle(a, b, c, colour) {
    push(a, b, c, colour);
  }
  function quad(a, b, c, d, colour) {
    push(a, b, c, colour);
    push(a, c, d, colour);
  }
  function quadFacing(a, b, c, d, colour, hint) {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) quad(d, c, b, a, colour);
    else quad(a, b, c, d, colour);
  }
  function triFacing(a, b, c, colour, hint) {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) push(a, c, b, colour);
    else push(a, b, c, colour);
  }
  function box(x0, y0, z0, x1, y1, z1, colour) {
    const [xa, xb] = x0 < x1 ? [x0, x1] : [x1, x0];
    const [ya, yb] = y0 < y1 ? [y0, y1] : [y1, y0];
    const [za, zb] = z0 < z1 ? [z0, z1] : [z1, z0];
    quad([xb, ya, za], [xb, yb, za], [xb, yb, zb], [xb, ya, zb], colour);
    quad([xa, ya, zb], [xa, yb, zb], [xa, yb, za], [xa, ya, za], colour);
    quad([xa, yb, za], [xa, yb, zb], [xb, yb, zb], [xb, yb, za], colour);
    quad([xa, ya, zb], [xa, ya, za], [xb, ya, za], [xb, ya, zb], colour);
    quad([xa, ya, zb], [xb, ya, zb], [xb, yb, zb], [xa, yb, zb], colour);
    quad([xa, yb, za], [xb, yb, za], [xb, ya, za], [xa, ya, za], colour);
  }
  function beam(from, to, width, depth, colour) {
    const d = norm(sub2(to, from));
    const ax = Math.abs(d[0]), ay = Math.abs(d[1]), az = Math.abs(d[2]);
    let up;
    if (az <= ax && az <= ay) up = [0, 0, 1];
    else if (ay <= ax) up = [0, 1, 0];
    else up = [1, 0, 0];
    let u = norm(cross2(up, d));
    let v = norm(cross2(d, u));
    if (Math.abs(u[1]) < 0.05) {
      u = norm([1, 0, 0]);
      v = norm(cross2(d, u));
    }
    const hu = [u[0] * width / 2, u[1] * width / 2, u[2] * width / 2];
    const hv = [v[0] * depth / 2, v[1] * depth / 2, v[2] * depth / 2];
    const s = (p, su, sv) => [
      p[0] + su * hu[0] + sv * hv[0],
      p[1] + su * hu[1] + sv * hv[1],
      p[2] + su * hu[2] + sv * hv[2]
    ];
    const c00 = s(from, -1, -1), c10 = s(from, 1, -1), c11 = s(from, 1, 1), c01 = s(from, -1, 1);
    const d00 = s(to, -1, -1), d10 = s(to, 1, -1), d11 = s(to, 1, 1), d01 = s(to, -1, 1);
    quad(c00, c10, d10, d00, colour);
    quad(c10, c11, d11, d10, colour);
    quad(c11, c01, d01, d11, colour);
    quad(c01, c00, d00, d01, colour);
    quad(d00, d10, d11, d01, colour);
    quad(c00, c01, c11, c10, colour);
  }
  function cylinder(cx, cz, y0, y1, r0, r1, sides, colour, caps = true) {
    const n = Math.max(3, Math.floor(sides));
    const ring = (y, r) => {
      const out = new Array(n);
      for (let i = 0; i < n; i += 1) {
        const a = i / n * Math.PI * 2;
        out[i] = [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
      }
      return out;
    };
    const lo = y0 <= y1 ? ring(y0, r0) : ring(y1, r0);
    const hi = y0 <= y1 ? ring(y1, r1) : ring(y0, r1);
    const baseLo = y0 <= y1 ? r0 : r1;
    const baseHi = y0 <= y1 ? r1 : r0;
    const yLo = Math.min(y0, y1);
    const yHi = Math.max(y0, y1);
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      if (baseHi === 0) {
        push(lo[i], [cx, yHi, cz], lo[j], colour);
      } else if (baseLo === 0) {
        push([cx, yLo, cz], hi[i], hi[j], colour);
      } else {
        quad(lo[i], hi[i], hi[j], lo[j], colour);
      }
    }
    if (caps && baseLo > 0) {
      for (let i = 0; i < n; i += 1) push([cx, yLo, cz], lo[i], lo[(i + 1) % n], colour);
    }
    if (caps && baseHi > 0) {
      for (let i = 0; i < n; i += 1) push([cx, yHi, cz], hi[(i + 1) % n], hi[i], colour);
    }
  }
  function prism(cx, cz, y0, y1, r0, r1, sides, colour, phase = 0) {
    cylinder(cx, cz, y0, y1, r0, r1, sides, colour, true);
    if (phase) {
    }
    return phase;
  }
  function loft(loopA, loopB, colour, capColour) {
    const n = loopA.length;
    if (loopB.length !== n) throw new Error("loft loops must have equal length");
    let nx = 0;
    let ny = 0;
    let nz = 0;
    for (let i = 0; i < n; i += 1) {
      const p = loopA[i];
      const q = loopA[(i + 1) % n];
      nx += (p[1] - q[1]) * (p[2] + q[2]);
      ny += (p[2] - q[2]) * (p[0] + q[0]);
      nz += (p[0] - q[0]) * (p[1] + q[1]);
    }
    const cap = capColour ?? colour;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      const ex = loopA[j][0] - loopA[i][0];
      const ey = loopA[j][1] - loopA[i][1];
      const ez = loopA[j][2] - loopA[i][2];
      const hint = [ey * nz - ez * ny, ez * nx - ex * nz, ex * ny - ey * nx];
      quadFacing(loopA[i], loopA[j], loopB[j], loopB[i], colour, hint);
    }
    for (let i = 1; i < n - 1; i += 1) {
      triFacing(loopA[0], loopA[i], loopA[i + 1], cap, [-nx, -ny, -nz]);
      triFacing(loopB[0], loopB[i], loopB[i + 1], cap, [nx, ny, nz]);
    }
  }
  function polygonFan(loop, colour, hint) {
    const n = loop.length;
    for (let i = 1; i < n - 1; i += 1) {
      triFacing(loop[0], loop[i], loop[i + 1], colour, hint);
    }
  }
  function groundQuad(x0, z0, x1, z1, y, colour) {
    quadFacing([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], colour, [0, 1, 0]);
  }
  return {
    tris,
    triangle,
    quad,
    quadFacing,
    triFacing,
    box,
    beam,
    cylinder,
    prism,
    loft,
    polygonFan,
    groundQuad,
    /**
     * Append every triangle from another model array, optionally offset.
     */
    merge(other, offset = [0, 0, 0]) {
      for (const t of other) {
        tris.push({
          p: [
            t.p[0] + offset[0],
            t.p[1] + offset[1],
            t.p[2] + offset[2],
            t.p[3] + offset[0],
            t.p[4] + offset[1],
            t.p[5] + offset[2],
            t.p[6] + offset[0],
            t.p[7] + offset[1],
            t.p[8] + offset[2]
          ],
          c: t.c
        });
      }
    }
  };
}

// src/models/eiffel.js
var IRON = hex("#4b443a");
var IRON_LIGHT = hex("#6a6052");
var IRON_DARK = hex("#37322b");
var IRON_WARM = hex("#7b6b55");
var STONE = hex("#b6aa93");
var STONE_DARK = hex("#97896f");
var GROUND = hex("#8f8b7e");
var GILT = hex("#c9a95d");
function halfAt(y) {
  const t = Math.max(0, Math.min(1, (y - 57) / (276 - 57)));
  const k = Math.exp(-3 * t);
  return 5 + 30 * (k - Math.exp(-3)) / (1 - Math.exp(-3));
}
function frustum(b, y0, y1, h0, h1, cx0, cz0, cx1, cz1, tones) {
  const ring = (cx, cz, h, y) => [
    [cx + h, y, cz + h],
    [cx - h, y, cz + h],
    [cx - h, y, cz - h],
    [cx + h, y, cz - h]
  ];
  const lo = ring(cx0, cz0, h0, y0);
  const hi = ring(cx1, cz1, h1, y1);
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    b.quad(lo[i], hi[i], hi[j], lo[j], tones[i % tones.length]);
  }
}
function latticeFace(b, face, y0, y1, h0, h1, cx0, cz0, cx1, cz1, scale = 1) {
  const ang = face * Math.PI * 0.5;
  const nx = Math.sin(ang);
  const nz = Math.cos(ang);
  const tx = Math.cos(ang);
  const tz = -Math.sin(ang);
  const P = (u, y, h, cx, cz) => [cx + nx * h + tx * u, y, cz + nz * h + tz * u];
  const w = h0 * 0.94 * scale;
  b.beam(P(-w, y0, h0, cx0, cz0), P(w, y1, h1, cx1, cz1), 0.85, 0.85, IRON_DARK);
  b.beam(P(w, y0, h0, cx0, cz0), P(-w, y1, h1, cx1, cz1), 0.85, 0.85, IRON_DARK);
  b.beam(P(-w, y0, h0, cx0, cz0), P(-w, y1, h1, cx1, cz1), 1.15, 1.15, shade(IRON_WARM, 1.06));
  b.beam(P(w, y0, h0, cx0, cz0), P(w, y1, h1, cx1, cz1), 1.15, 1.15, shade(IRON_WARM, 1.06));
  const ym = (y0 + y1) / 2;
  const hm = (h0 + h1) / 2;
  b.beam(P(-w, ym, hm, (cx0 + cx1) / 2, (cz0 + cz1) / 2), P(w, ym, hm, (cx0 + cx1) / 2, (cz0 + cz1) / 2), 0.6, 0.6, shade(IRON_WARM, 0.95));
}
function platform(b, y, half, thick, tone) {
  b.box(-half, y, -half, half, y + thick, half, tone);
  b.box(-half - 1.3, y + thick, -half - 1.3, half + 1.3, y + thick + 0.75, half + 1.3, shade(tone, 1.12));
  b.box(-half - 0.6, y - 0.7, -half - 0.6, half + 0.6, y, half + 0.6, shade(tone, 0.82));
}
var LEGS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1]
];
function build() {
  const b = createBuilder();
  b.groundQuad(-86, -86, 86, 86, 0, GROUND);
  b.groundQuad(-44, -44, 44, 44, 0.02, shade(GROUND, 0.88));
  for (const [sx, sz] of LEGS) {
    const cx = sx * 44;
    const cz = sz * 44;
    b.box(cx - 14.5, 0, cz - 14.5, cx + 14.5, 1.6, cz + 14.5, STONE_DARK);
    b.box(cx - 13, 1.6, cz - 13, cx + 13, 3.4, cz + 13, STONE);
    b.box(cx - 12, 3.4, cz - 12, cx + 12, 4.1, cz + 12, shade(STONE, 1.05));
  }
  const LEG_BOTTOM = 4;
  const LEG_TOP = 56;
  const LEG_SEG = 9;
  for (const [sx, sz] of LEGS) {
    for (let i = 0; i < LEG_SEG; i += 1) {
      const t0 = i / LEG_SEG;
      const t1 = (i + 1) / LEG_SEG;
      const y0 = LEG_BOTTOM + (LEG_TOP - LEG_BOTTOM) * t0;
      const y1 = LEG_BOTTOM + (LEG_TOP - LEG_BOTTOM) * t1;
      const h0 = 18 - 9.5 * t0;
      const h1 = 18 - 9.5 * t1;
      const cx0 = sx * (44 - 15.5 * t0);
      const cz0 = sz * (44 - 15.5 * t0);
      const cx1 = sx * (44 - 15.5 * t1);
      const cz1 = sz * (44 - 15.5 * t1);
      frustum(b, y0, y1, h0, h1, cx0, cz0, cx1, cz1, [
        shade(IRON, 1.06),
        shade(IRON, 0.92),
        shade(IRON, 0.98),
        shade(IRON, 0.86)
      ]);
      latticeFace(b, 0, y0, y1, h0, h1, cx0, cz0, cx1, cz1);
      latticeFace(b, 1, y0, y1, h0, h1, cx0, cz0, cx1, cz1);
      latticeFace(b, 2, y0, y1, h0, h1, cx0, cz0, cx1, cz1);
      latticeFace(b, 3, y0, y1, h0, h1, cx0, cz0, cx1, cz1);
      if (i > 0) {
        b.box(cx0 - h0 - 0.4, y0 - 0.5, cz0 - h0 - 0.4, cx0 + h0 + 0.4, y0, cz0 + h0 + 0.4, shade(IRON_WARM, 1.02));
      }
    }
  }
  const ARCH_R = 25.5;
  const ARCH_BASE = 5;
  const ARCH_SEG = 16;
  for (let f = 0; f < 4; f += 1) {
    const ang = f * Math.PI * 0.5;
    const nx = Math.sin(ang);
    const nz = Math.cos(ang);
    const tx = Math.cos(ang);
    const tz = -Math.sin(ang);
    const off = 30.5;
    for (let i = 0; i < ARCH_SEG; i += 1) {
      const a0 = Math.PI * i / ARCH_SEG;
      const a1 = Math.PI * (i + 1) / ARCH_SEG;
      const R = ARCH_R;
      const point = (a, r) => [
        nx * off + tx * (Math.cos(a) * r),
        ARCH_BASE + Math.sin(a) * R,
        nz * off + tz * (Math.cos(a) * r)
      ];
      const inner = point(a0, R - 6.4);
      const innerNext = point(a1, R - 6.4);
      const outer = point(a0, R);
      const outerNext = point(a1, R);
      b.quad(inner, outer, outerNext, innerNext, IRON_WARM);
      if (i === 0 || i === ARCH_SEG - 1) {
        const base = [nx * off + tx * (Math.cos(a0) * R * (i ? 1 : -1)), ARCH_BASE, nz * off + tz * (Math.cos(a0) * R * (i ? 1 : -1))];
        b.beam(outer, [base[0], ARCH_BASE + 0.2, base[2]], 1.2, 1.2, IRON_DARK);
      }
    }
  }
  platform(b, 56.2, 32.5, 3, shade(IRON, 1.1));
  for (let f = 0; f < 4; f += 1) {
    const ang = f * Math.PI * 0.5;
    const nx = Math.sin(ang);
    const nz = Math.cos(ang);
    const tx = Math.cos(ang);
    const tz = -Math.sin(ang);
    for (let k = -3; k <= 3; k += 1) {
      const u = k * 8.6;
      const px = nx * 32.9 + tx * u;
      const pz = nz * 32.9 + tz * u;
      b.box(px - 1.2, 59.4, pz - 1.2, px + 1.2, 64.6, pz + 1.2, shade(IRON_WARM, 1.08));
      b.box(px - 1.5, 64.6, pz - 1.5, px + 1.5, 65.4, pz + 1.5, GILT);
    }
  }
  for (let f = 0; f < 4; f += 1) {
    const ang = f * Math.PI * 0.5;
    const nx = Math.sin(ang);
    const nz = Math.cos(ang);
    const tx = Math.cos(ang);
    const tz = -Math.sin(ang);
    for (let k = 0; k < 12; k += 1) {
      const u0 = -33 + 66 * k / 12;
      const u1 = -33 + 66 * (k + 1) / 12;
      const p0 = [nx * 32.4 + tx * u0, 65.6, nz * 32.4 + tz * u0];
      const p1 = [nx * 32.4 + tx * u1, 65.6, nz * 32.4 + tz * u1];
      b.quad(p0, p1, [p1[0], 66.9, p1[2]], [p0[0], 66.9, p0[2]], k % 2 ? IRON_WARM : GILT);
    }
  }
  const SHAFT_BOTTOM = 59;
  const SHAFT_TOP = 276;
  const SHAFT_SEG = 26;
  for (let i = 0; i < SHAFT_SEG; i += 1) {
    const y0 = SHAFT_BOTTOM + (SHAFT_TOP - SHAFT_BOTTOM) * i / SHAFT_SEG;
    const y1 = SHAFT_BOTTOM + (SHAFT_TOP - SHAFT_BOTTOM) * (i + 1) / SHAFT_SEG;
    const h0 = halfAt(Math.max(y0, 59));
    const h1 = halfAt(y1);
    frustum(b, y0, y1, h0, h1, 0, 0, 0, 0, [
      shade(IRON, 1.07),
      shade(IRON, 0.9),
      shade(IRON, 0.97),
      shade(IRON, 0.84)
    ]);
    for (let f = 0; f < 4; f += 1) {
      latticeFace(b, f, y0, y1, h0, h1, 0, 0, 0, 0);
    }
    if (i % 3 === 0) {
      b.box(-h1 - 0.5, y1 - 0.55, -h1 - 0.5, h1 + 0.5, y1, h1 + 0.5, shade(IRON_WARM, 1.05));
    }
  }
  platform(b, 112.5, 18, 2.4, shade(IRON, 1.06));
  platform(b, 193, 9.8, 2, shade(IRON, 1));
  for (const [deckY, r, posts] of [
    [116, 18.4, 28],
    [196.5, 10.2, 20]
  ]) {
    for (let i = 0; i < posts; i += 1) {
      const a = i / posts * Math.PI * 2;
      const px = Math.cos(a) * r;
      const pz = Math.sin(a) * r;
      b.box(px - 0.24, deckY, pz - 0.24, px + 0.24, deckY + 2.1, pz + 0.24, shade(IRON, 1.18));
    }
    for (let i = 0; i < posts; i += 1) {
      const a0 = i / posts * Math.PI * 2;
      const a1 = (i + 1) / posts * Math.PI * 2;
      b.beam(
        [Math.cos(a0) * r, deckY + 2.05, Math.sin(a0) * r],
        [Math.cos(a1) * r, deckY + 2.05, Math.sin(a1) * r],
        0.35,
        0.35,
        shade(IRON, 1.22)
      );
    }
  }
  b.box(-9.6, 276, -9.6, 9.6, 279.4, 9.6, shade(IRON, 1.12));
  b.box(-7.4, 279.4, -7.4, 7.4, 284.6, 7.4, shade(IRON, 0.96));
  b.box(-7.7, 281, -7.7, 7.7, 283.1, 7.7, shade(GILT, 0.94));
  b.box(-5.7, 284.6, -5.7, 5.7, 290.4, 5.7, shade(IRON, 1.06));
  b.box(-6, 286, -6, 6, 287.6, 6, shade(GILT, 0.9));
  b.cylinder(0, 0, 290.4, 302, 2.7, 1.7, 16, shade(IRON, 0.98));
  b.cylinder(0, 0, 302, 314, 1.5, 0.55, 12, shade(IRON, 1.04));
  b.cylinder(0, 0, 314, 320.5, 0.5, 0.24, 10, GILT);
  b.cylinder(0, 0, 320.5, 330, 0.24, 0, 8, GILT);
  b.box(-33, 54.8, -33, 33, 59.4, 33, shade(IRON, 0.94));
  b.box(-33.6, 58.6, -33.6, 33.6, 60.2, 33.6, shade(IRON_WARM, 1.02));
  for (const [sx, sz] of LEGS) {
    b.beam([sx * 27, 54.9, sz * 27], [sx * 20, 74, sz * 20], 1.3, 1.3, shade(IRON_DARK, 1.1));
  }
  for (let f = 0; f < 4; f += 1) {
    const ang = f * Math.PI * 0.5;
    const nx = Math.sin(ang);
    const nz = Math.cos(ang);
    const tx = Math.cos(ang);
    const tz = -Math.sin(ang);
    for (let k = -4; k <= 4; k += 1) {
      const u = k * 7.4;
      b.beam(
        [nx * 30 + tx * u, 50.2, nz * 30 + tz * u],
        [nx * 30 + tx * u, 56.2, nz * 30 + tz * u],
        1.1,
        1.1,
        shade(IRON_DARK, 1.05)
      );
    }
  }
  for (const [sx, sz] of LEGS) {
    b.box(sx * 44 - 12.4, 3.9, sz * 44 - 12.4, sx * 44 + 12.4, 4.7, sz * 44 + 12.4, mix(STONE, IRON_DARK, 0.45));
  }
  return b.tris;
}

// src/models/great-wall.js
var BRICK = hex("#bda98f");
var BRICK_PALE = hex("#cdbc9f");
var BRICK_DARK = hex("#9c876f");
var STONE2 = hex("#8d7c68");
var STONE_DARK2 = hex("#736556");
var RIDGE = hex("#7b8a5c");
var RIDGE_PALE = hex("#93a06f");
var RIDGE_DARK = hex("#616e48");
var PAVING = hex("#ab9f8a");
var MOSS = hex("#6b7a50");
var ROCK = hex("#8a8478");
var HALF_SPAN = 150;
var NX = 46;
var NZ = 18;
function crest(x) {
  const hump = 24 * Math.sin((x + HALF_SPAN) / (2 * HALF_SPAN) * Math.PI);
  const relief = Math.pow(Math.max(0, hump), 1.05) + 5 * Math.sin(x * 0.045 + 0.7);
  const edge = Math.max(0, Math.min(1, (HALF_SPAN - 24 - Math.abs(x)) / 34));
  return Math.max(0, (7 + relief) * edge);
}
function pathZ(x) {
  return 24 * Math.sin(x / 62) + 6 * Math.sin(x / 21);
}
function terrainAt(x, z) {
  const dz = z - pathZ(x);
  const sigma = 26;
  const fall = Math.exp(-(dz * dz) / (sigma * sigma));
  const c = crest(x);
  return Math.max(0, c * fall - 1.5 * (1 - fall));
}
function pathDir(x) {
  const e = 0.8;
  const dz = pathZ(x + e) - pathZ(x - e);
  const L = Math.hypot(2 * e, dz) || 1;
  return [2 * e / L, 0, dz / L];
}
function slab(b, cx, cz, dir, halfLen, halfWid, y0, y1, colour) {
  const px = -dir[2];
  const pz = dir[0];
  const ox = dir[0] * halfLen;
  const oz = dir[2] * halfLen;
  const wx = px * halfWid;
  const wz = pz * halfWid;
  const loop = (y) => [
    [cx - ox + wx, y, cz - oz + wz],
    [cx - ox - wx, y, cz - oz - wz],
    [cx + ox - wx, y, cz + oz - wz],
    [cx + ox + wx, y, cz + oz + wz]
  ];
  b.loft(loop(y0), loop(y1), colour, shade(colour, 0.88));
}
function build2() {
  const b = createBuilder();
  const X0 = -HALF_SPAN;
  const X1 = HALF_SPAN;
  const Z0 = -72;
  const Z1 = 72;
  for (let i = 0; i < NX; i += 1) {
    for (let j = 0; j < NZ; j += 1) {
      const xa = X0 + (X1 - X0) * i / NX;
      const xb = X0 + (X1 - X0) * (i + 1) / NX;
      const za = Z0 + (Z1 - Z0) * j / NZ;
      const zb = Z0 + (Z1 - Z0) * (j + 1) / NZ;
      const edge = (x) => Math.max(0, Math.min(1, (HALF_SPAN - 34 - Math.abs(x)) / 26));
      const side = (z) => Math.max(0, Math.min(1, (72 - 18 - Math.abs(z)) / 22));
      const h = (x, z) => terrainAt(x, z) * edge(x) * side(z);
      const hA = h(xa, za);
      const hB = h(xb, za);
      const hC = h(xb, zb);
      const hD = h(xa, zb);
      const avg = (hA + hB + hC + hD) / 4;
      const t = avg / 34;
      const tone = t > 0.76 ? RIDGE_PALE : t > 0.48 ? RIDGE : t > 0.2 ? RIDGE_DARK : mix(ROCK, MOSS, 0.55);
      b.quadFacing(
        [xa, hD, zb],
        [xb, hC, zb],
        [xb, hB, za],
        [xa, hA, za],
        tone,
        [0, 1, 0]
      );
    }
  }
  const SEGMENTS = 52;
  const WALL_H = 8.5;
  const WALL_W = 3;
  const BATTER = 2.2;
  const START = X0 + 18;
  const END = X1 - 18;
  for (let i = 0; i < SEGMENTS; i += 1) {
    const xa = START + (END - START) * i / SEGMENTS;
    const xb = START + (END - START) * (i + 1) / SEGMENTS;
    const xm = (xa + xb) / 2;
    const dir = pathDir(xm);
    const cz = (pathZ(xa) + pathZ(xb)) / 2;
    const yBase = crest(xm) - 2.6;
    const top = yBase + WALL_H;
    const len = Math.max((xb - xa) * 0.62, 1.2);
    slab(b, xm, cz, dir, len, WALL_W + BATTER, yBase, yBase + WALL_H * 0.42, STONE2);
    slab(b, xm, cz, dir, len, WALL_W, yBase + WALL_H * 0.42, top, BRICK_DARK);
    slab(b, xm, cz, dir, len, WALL_W - 0.55, top - 0.25, top, PAVING);
    for (const side of [-1, 1]) {
      const px = -dir[2] * side;
      const pz = dir[0] * side;
      const off = WALL_W - 0.3;
      const pcx = xm + px * off;
      const pcz = cz + pz * off;
      slab(b, pcx, pcz, dir, len, 0.3, top, top + 0.9, BRICK);
      for (let k = 0; k < 3; k += 1) {
        const t = ((k + 0.5) / 3 - 0.5) * 2 * len;
        slab(b, pcx + dir[0] * t, pcz + dir[2] * t, dir, len / 3 * 0.55, 0.3, top + 0.9, top + 1.7, BRICK_PALE);
      }
    }
  }
  for (const tx of [-95, -18, 62, 128]) {
    const dir = pathDir(tx);
    const tz = pathZ(tx);
    const base = crest(tx) - 3;
    const px = -dir[2];
    const pz = dir[0];
    slab(b, tx, tz, dir, 8.4, 6.9, base, base + 2, STONE_DARK2);
    slab(b, tx, tz, dir, 7.4, 5.9, base + 2, base + 9.4, BRICK_DARK);
    slab(b, tx, tz, dir, 7.7, 6.2, base + 9.4, base + 10.3, BRICK);
    const arch = (nx, nz, halfW, y0, y1) => {
      const ax = -nz;
      const az = nx;
      const off = 5.95;
      const cxx = tx + nx * off;
      const czz = tz + nz * off;
      b.polygonFan(
        [
          [cxx - ax * halfW, y0, czz - az * halfW],
          [cxx + ax * halfW, y0, czz + az * halfW],
          [cxx + ax * halfW, y1 - halfW * 1.1, czz + az * halfW],
          [cxx, y1, czz],
          [cxx - ax * halfW, y1 - halfW * 1.1, czz - az * halfW]
        ],
        mix(STONE_DARK2, BRICK_DARK, 0.25),
        [nx, 0, nz]
      );
    };
    arch(0, 1, 1.7, base + 2.6, base + 6.6);
    arch(0, -1, 1.7, base + 2.6, base + 6.6);
    arch(1, 0, 1.5, base + 2.6, base + 6.4);
    arch(-1, 0, 1.5, base + 2.6, base + 6.4);
    const topY = base + 10.3;
    for (const side of [-1, 1]) {
      for (let k = -2; k <= 2; k += 1) {
        const cx2 = tx + px * side * 5.9 + dir[0] * k * 2.4;
        const cz2 = tz + pz * side * 5.9 + dir[2] * k * 2.4;
        slab(b, cx2, cz2, dir, 0.75, 0.4, topY, topY + 1.5, BRICK_PALE);
      }
    }
    slab(b, tx, tz, dir, 7, 5.6, topY - 0.35, topY, PAVING);
  }
  return b.tris;
}

// src/models/forbidden-city.js
var VERMILION = hex("#a8322c");
var VERMILION_DARK = hex("#8a2822");
var VERMILION_LIGHT = hex("#bc443a");
var TILE = hex("#d9a92e");
var TILE_DARK = hex("#ba8d26");
var TILE_PALE = hex("#e9be49");
var MARBLE = hex("#e9e3d7");
var MARBLE_DARK = hex("#cfc7b9");
var PAVING2 = hex("#b6b1a7");
var PAVING_DARK = hex("#9e9990");
var LACQUER = hex("#c9a24a");
var INK = hex("#4a3a34");
function hipRoof(b, cx, cz, halfX, halfZ, y0, overhang, rise, colour, ridgeFrac = 0.42) {
  const ex = halfX + overhang;
  const ez = halfZ + overhang;
  const ridgeHalfX = Math.max(1, halfX * ridgeFrac);
  const ridgeHalfZ = Math.max(0.5, ez * 0.045);
  const ring = (hx, hz, y) => [
    [cx + hx, y, cz + hz],
    [cx - hx, y, cz + hz],
    [cx - hx, y, cz - hz],
    [cx + hx, y, cz - hz]
  ];
  const COURSES = 6;
  const rings = [];
  for (let i = 0; i <= COURSES; i += 1) {
    const t = i / COURSES;
    const k = Math.pow(1 - t, 1.8);
    const hx = ridgeHalfX + (ex - ridgeHalfX) * k;
    const hz = ridgeHalfZ + (ez - ridgeHalfZ) * k;
    const y = y0 + rise * Math.pow(t, 1.4);
    rings.push(ring(hx, hz, y));
  }
  for (let i = 0; i < COURSES; i += 1) {
    const tone = shade(colour, i % 2 ? 1 : 1.06);
    b.loft(rings[i], rings[i + 1], tone, shade(colour, 0.84));
  }
  const ridgeY = y0 + rise;
  b.box(
    cx - ridgeHalfX,
    ridgeY - 0.1,
    cz - ridgeHalfZ - 0.5,
    cx + ridgeHalfX,
    ridgeY + 0.7,
    cz + ridgeHalfZ + 0.5,
    shade(colour, 1.14)
  );
  for (const sx of [-1, 1]) {
    b.box(
      cx + sx * ridgeHalfX - 0.6,
      ridgeY,
      cz - 0.7,
      cx + sx * ridgeHalfX + 0.6,
      ridgeY + 1.5,
      cz + 0.7,
      shade(colour, 0.92)
    );
  }
  b.box(
    cx - ex - 0.35,
    y0 - 0.32,
    cz - ez - 0.35,
    cx + ex + 0.35,
    y0,
    cz + ez + 0.35,
    shade(colour, 0.7)
  );
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1]
  ]) {
    const corner = [cx + sx * ex, y0 + 0.05, cz + sz * ez];
    const tip = [cx + sx * (ex + 1.1), y0 + 1.35, cz + sz * (ez + 1.1)];
    const back = [cx + sx * (ex - 2.2), y0 + 0.05, cz + sz * (ez - 2.2)];
    b.polygonFan([corner, back, tip], shade(colour, 1.18), [sx, 1, sz]);
  }
  return ridgeY;
}
function hallBody(b, cx, cz, halfX, halfZ, y0, h, cols = 7, colour = VERMILION) {
  b.box(cx - halfX, y0, cz - halfZ, cx + halfX, y0 + h, cz + halfZ, colour);
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1]
  ]) {
    b.box(
      cx + sx * (halfX - 0.9) - 1,
      y0,
      cz + sz * (halfZ - 0.9) - 1,
      cx + sx * (halfX - 0.9) + 1,
      y0 + h,
      cz + sz * (halfZ - 0.9) + 1,
      shade(LACQUER, 0.88)
    );
  }
  const n = Math.max(3, cols);
  for (let i = 0; i < n; i += 1) {
    const t = (i / (n - 1) - 0.5) * 2 * halfX * 0.92;
    b.box(cx + t - 0.7, y0, cz + halfZ - 0.4, cx + t + 0.7, y0 + h, cz + halfZ + 0.9, VERMILION_DARK);
  }
  for (let i = 0; i < n - 1; i += 1) {
    const t0 = (-0.5 + i / (n - 1)) * 2 * halfX * 0.92 + 0.9;
    const t1 = (-0.5 + (i + 1) / (n - 1)) * 2 * halfX * 0.92 - 0.9;
    if (t1 <= t0) continue;
    b.polygonFan(
      [
        [cx + t0, y0, cz + halfZ + 0.25],
        [cx + t1, y0, cz + halfZ + 0.25],
        [cx + t1, y0 + h * 0.82, cz + halfZ + 0.25],
        [cx + t0, y0 + h * 0.82, cz + halfZ + 0.25]
      ],
      mix(VERMILION_DARK, INK, 0.6),
      [0, 0, 1]
    );
  }
  b.box(cx - halfX - 0.7, y0 + h - 1.5, cz - halfZ - 0.7, cx + halfX + 0.7, y0 + h, cz + halfZ + 0.7, VERMILION_LIGHT);
  return y0 + h;
}
function balustrade(b, cx, cz, halfX, halfZ, y, colour = MARBLE) {
  const step = 5.2;
  const nx = Math.max(2, Math.round(halfX * 2 / step));
  const nz = Math.max(2, Math.round(halfZ * 2 / step));
  const post = (x, z) => b.box(x - 0.32, y, z - 0.32, x + 0.32, y + 1.3, z + 0.32, colour);
  for (let i = 0; i <= nx; i += 1) {
    const x = cx - halfX + 2 * halfX * i / nx;
    post(x, cz + halfZ);
    post(x, cz - halfZ);
  }
  for (let i = 0; i <= nz; i += 1) {
    const z = cz - halfZ + 2 * halfZ * i / nz;
    post(cx + halfX, z);
    post(cx - halfX, z);
  }
  b.beam([cx - halfX, y + 1.24, cz + halfZ], [cx + halfX, y + 1.24, cz + halfZ], 0.4, 0.4, shade(colour, 1.05));
  b.beam([cx - halfX, y + 1.24, cz - halfZ], [cx + halfX, y + 1.24, cz - halfZ], 0.4, 0.4, shade(colour, 1.05));
  b.beam([cx - halfX, y + 1.24, cz - halfZ], [cx - halfX, y + 1.24, cz + halfZ], 0.4, 0.4, shade(colour, 1.05));
  b.beam([cx + halfX, y + 1.24, cz - halfZ], [cx + halfX, y + 1.24, cz + halfZ], 0.4, 0.4, shade(colour, 1.05));
}
function build3() {
  const b = createBuilder();
  const WX = 105;
  const WZ = 95;
  const WH = 8;
  b.groundQuad(-WX - 17, -WZ - 17, WX + 17, WZ + 23, 0, PAVING2);
  b.groundQuad(-WX - 8, -WZ - 8, WX + 8, WZ + 8, 0.04, PAVING_DARK);
  const wallSlab = (x0, z0, x1, z1) => {
    b.box(x0, 0, z0, x1, WH, z1, VERMILION);
    b.box(x0 - 0.7, WH, z0 - 0.7, x1 + 0.7, WH + 0.85, z1 + 0.7, TILE);
    b.box(x0 - 1, WH - 0.6, z0 - 1, x1 + 1, WH, z1 + 1, TILE_DARK);
  };
  wallSlab(-WX, WZ - 3.5, WX, WZ);
  wallSlab(-WX, -WZ, WX, -WZ + 3.5);
  wallSlab(-WX, -WZ, -WX + 3.5, WZ);
  wallSlab(WX - 3.5, -WZ, WX, WZ);
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1]
  ]) {
    const cx = sx * WX;
    const cz = sz * WZ;
    hallBody(b, cx, cz, 8.5, 8.5, WH, 5.5, 3, VERMILION_DARK);
    hipRoof(b, cx, cz, 8.5, 8.5, WH + 5.5, 2.4, 4.8, TILE, 0.4);
  }
  const MG_Z = WZ - 3.5;
  const podiumY = 9;
  b.box(-46, 0, MG_Z - 17, 46, podiumY, MG_Z + 9, VERMILION_DARK);
  b.box(-48, 0, MG_Z - 18.5, 48, 1.8, MG_Z + 10.5, MARBLE_DARK);
  for (const [off, w, h] of [
    [0, 4.6, 6],
    [-16, 3.4, 4.8],
    [16, 3.4, 4.8]
  ]) {
    const z = MG_Z + 9.05;
    b.polygonFan(
      [
        [-off - w, 1.8, z],
        [off + w, 1.8, z],
        [off + w, 1.8 + h - w, z],
        [off, 1.8 + h, z],
        [-off - w, 1.8 + h - w, z]
      ],
      mix(VERMILION_DARK, INK, 0.72),
      [0, 0, 1]
    );
  }
  b.box(-47, podiumY, MG_Z - 18, 47, podiumY + 1.1, MG_Z + 10, TILE_DARK);
  hallBody(b, 0, MG_Z - 4, 18, 11.5, podiumY + 1.1, 7, 7);
  hipRoof(b, 0, MG_Z - 4, 18, 11.5, podiumY + 1.1 + 7, 3.4, 6.8, TILE, 0.4);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * 30;
      const cz = MG_Z - 4 + sz * 11.5;
      hallBody(b, cx, cz, 9, 5, podiumY + 1.1, 5.2, 3);
      hipRoof(b, cx, cz, 9, 5, podiumY + 1.1 + 5.2, 2.6, 4.8, TILE, 0.38);
    }
  }
  b.groundQuad(-9, MG_Z + 10, 9, -34, 0.07, MARBLE_DARK);
  b.groundQuad(-11.5, MG_Z + 10, -9, -34, 0.06, MARBLE);
  const TER_Z = -52;
  for (const [hx, hz, y0, y1] of [
    [58, 34, 0, 2.8],
    [53, 29.5, 2.8, 5.6],
    [48, 25, 5.6, 8.4]
  ]) {
    b.box(-hx, y0, TER_Z - hz, hx, y1, TER_Z + hz, MARBLE);
    b.box(-hx - 0.4, y0, TER_Z - hz - 0.4, hx + 0.4, y0 + 0.6, TER_Z + hz + 0.4, MARBLE_DARK);
  }
  balustrade(b, 0, TER_Z, 58, 34, 2.8);
  balustrade(b, 0, TER_Z, 53, 29.5, 5.6);
  balustrade(b, 0, TER_Z, 48, 25, 8.4);
  for (const sx of [-1, 1]) {
    for (let s = 0; s < 3; s += 1) {
      const y0 = s * 2.8;
      b.box(sx * 24 - 8, y0, TER_Z + 25 + s * 4.4, sx * 24 + 8, y0 + 2.8, TER_Z + 25 + s * 4.4 + 4.4, MARBLE);
    }
  }
  const HALL_Y = 8.4;
  const HX = 32;
  const HZ = 17;
  hallBody(b, 0, TER_Z, HX, HZ, HALL_Y, 12.5, 9);
  const skirtTop = hipRoof(b, 0, TER_Z, HX, HZ, HALL_Y + 12.5, 6.2, 4.6, TILE, 0.66);
  b.box(-HX * 0.78, skirtTop - 0.5, TER_Z - HZ * 0.78, HX * 0.78, skirtTop + 2.4, TER_Z + HZ * 0.78, VERMILION_DARK);
  const ridgeTop = hipRoof(b, 0, TER_Z, HX * 0.8, HZ * 0.8, skirtTop + 2.4, 3.6, 8.2, TILE, 0.4);
  for (const sx of [-1, 1]) {
    b.box(sx * 7.5 - 0.8, ridgeTop, TER_Z - 0.8, sx * 7.5 + 0.8, ridgeTop + 2, TER_Z + 0.8, LACQUER);
  }
  for (const sx of [-1, 1]) {
    b.box(sx * 16 - 2.2, HALL_Y, TER_Z + HZ + 2.6, sx * 16 + 2.2, HALL_Y + 2.8, TER_Z + HZ + 6.4, LACQUER);
  }
  for (const sx of [-1, 1]) {
    const cx = sx * 92;
    const cz = TER_Z + 2;
    hallBody(b, cx, cz, 15, 11, 0.1, 8, 5, VERMILION_DARK);
    hipRoof(b, cx, cz, 15, 11, 8.1, 3.2, 5.4, TILE, 0.42);
  }
  const NG_Z = -WZ + 3.5;
  b.box(-26, 0, NG_Z - 11, 26, 8.4, NG_Z + 11, VERMILION_DARK);
  b.box(-28, 0, NG_Z - 12.5, 28, 1.6, NG_Z + 12.5, MARBLE_DARK);
  hallBody(b, 0, NG_Z, 21, 9, 8.4, 5.8, 5);
  hipRoof(b, 0, NG_Z, 21, 9, 14.2, 2.8, 5.2, TILE, 0.42);
  for (const [x0, z0, x1, z1] of [
    [-WX - 2.5, WZ - 6, WX + 2.5, WZ + 2.5],
    [-WX - 2.5, -WZ - 2.5, WX + 2.5, -WZ + 6],
    [-WX - 2.5, -WZ, -WX + 6, WZ],
    [WX - 6, -WZ, WX + 2.5, WZ]
  ]) {
    b.groundQuad(x0, z0, x1, z1, 0.09, PAVING_DARK);
  }
  return b.tris;
}

// src/models/taj-mahal.js
var MARBLE2 = hex("#f2ede2");
var MARBLE_MID = hex("#e6dfd1");
var MARBLE_SHADE = hex("#d3ccbe");
var INLAY = hex("#b9b3a6");
var SANDSTONE = hex("#9d5b45");
var SANDSTONE_DARK = hex("#874f3b");
var WATER = hex("#4f7c74");
var WATER_PALE = hex("#6b9990");
var GILT2 = hex("#c3a05c");
var GARDEN = hex("#8c9a6c");
function ngon(cx, cz, y, r, n, phase = Math.PI / 8) {
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = phase + i / n * Math.PI * 2;
    out[i] = [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
  }
  return out;
}
function stack(b, cx, cz, y0, y1, r0, r1, n, colour, capColour) {
  b.loft(ngon(cx, cz, y0, r0, n), ngon(cx, cz, y1, r1, n), colour, capColour);
}
var DOME_PROFILE = [
  [0, 1.02],
  [0.1, 1.16],
  [0.22, 1.21],
  [0.35, 1.18],
  [0.5, 1.06],
  [0.64, 0.86],
  [0.76, 0.62],
  [0.86, 0.38],
  [0.94, 0.18],
  [1, 0.06]
];
function onionDome(b, cx, cz, y0, height, radius, colour) {
  const N = 18;
  const shadeOf = [1.03, 0.98, 0.94, 0.9, 0.88];
  for (let i = 0; i < DOME_PROFILE.length - 1; i += 1) {
    const [t0, r0f] = DOME_PROFILE[i];
    const [t1, r1f] = DOME_PROFILE[i + 1];
    const ya = y0 + height * t0;
    const yb = y0 + height * t1;
    const ra = radius * r0f;
    const rb = radius * r1f;
    stack(b, cx, cz, ya, yb, ra, rb, N, shade(colour, shadeOf[i % shadeOf.length]));
  }
  const bandY = y0 + height * 0.1;
  b.loft(
    ngon(cx, cz, bandY - 0.5, radius * 1.16, N),
    ngon(cx, cz, bandY + 0.5, radius * 1.2, N),
    GILT2,
    GILT2
  );
  return y0 + height;
}
function chhatri(b, cx, cz, y0, scale = 1) {
  const R = 3.4 * scale;
  const colH = 5 * scale;
  b.loft(ngon(cx, cz, y0, R * 1.35, 8), ngon(cx, cz, y0 + 0.8 * scale, R * 1.3, 8), MARBLE_SHADE, MARBLE2);
  for (let i = 0; i < 8; i += 1) {
    const a = i / 8 * Math.PI * 2 + Math.PI / 8;
    const px = cx + Math.cos(a) * R;
    const pz = cz + Math.sin(a) * R;
    b.box(px - 0.42 * scale, y0 + 0.8 * scale, pz - 0.42 * scale, px + 0.42 * scale, y0 + 0.8 * scale + colH, pz + 0.42 * scale, MARBLE_MID);
  }
  const top = y0 + 0.8 * scale + colH;
  b.loft(ngon(cx, cz, top, R * 1.12, 8), ngon(cx, cz, top + 1 * scale, R * 1.05, 8), MARBLE2, MARBLE_SHADE);
  onionDome(b, cx, cz, top + 1 * scale, 4.6 * scale, 2.5 * scale, MARBLE2);
  b.cylinder(cx, cz, top + 1 * scale + 4.6 * scale, top + 1 * scale + 6.2 * scale, 0.32 * scale, 0.08 * scale, 6, GILT2);
}
function minaret(b, cx, cz, y0, totalH) {
  const R = 2.6;
  b.loft(ngon(cx, cz, y0, R * 1.5, 8), ngon(cx, cz, y0 + 2.4, R * 1.3, 8), MARBLE_SHADE, MARBLE2);
  stack(b, cx, cz, y0 + 2.4, y0 + totalH * 0.42, R, R * 0.9, 8, MARBLE_MID);
  b.loft(ngon(cx, cz, y0 + totalH * 0.42, R * 1.5, 8), ngon(cx, cz, y0 + totalH * 0.42 + 0.7, R * 1.45, 8), MARBLE2, MARBLE_SHADE);
  stack(b, cx, cz, y0 + totalH * 0.42 + 0.7, y0 + totalH * 0.72, R * 0.86, R * 0.76, 8, MARBLE_MID);
  b.loft(ngon(cx, cz, y0 + totalH * 0.72, R * 1.32, 8), ngon(cx, cz, y0 + totalH * 0.72 + 0.6, R * 1.28, 8), MARBLE2, MARBLE_SHADE);
  stack(b, cx, cz, y0 + totalH * 0.72 + 0.6, y0 + totalH * 0.92, R * 0.72, R * 0.64, 8, MARBLE_MID);
  b.loft(ngon(cx, cz, y0 + totalH * 0.92, R * 0.95, 8), ngon(cx, cz, y0 + totalH * 0.92 + 0.8, R * 0.88, 8), MARBLE2, MARBLE2);
  onionDome(b, cx, cz, y0 + totalH * 0.92 + 0.8, totalH * 0.12, R * 0.78, MARBLE2);
}
function build4() {
  const b = createBuilder();
  b.groundQuad(-92, -70, 92, 128, 0, GARDEN);
  const PL = 47;
  const PLZ = 0;
  const PL_Y = 4.4;
  b.box(-PL - 2, 0, PLZ - PL - 2, PL + 2, 1, PLZ + PL + 2, MARBLE_SHADE);
  b.box(-PL, 1, PLZ - PL, PL, PL_Y, PLZ + PL, MARBLE2);
  b.box(-PL - 0.5, PL_Y - 0.5, PLZ - PL - 0.5, PL + 0.5, PL_Y, PLZ + PL + 0.5, MARBLE_SHADE);
  const railSeg = 8;
  for (let i = 0; i < railSeg; i += 1) {
    for (const side of [0, 1, 2, 3]) {
      if (side === 0 && (i === 3 || i === 4)) continue;
      const t0 = (i / railSeg - 0.5) * 2 * PL;
      const t1 = ((i + 1) / railSeg - 0.5) * 2 * PL;
      const mid = (t0 + t1) / 2;
      const len = Math.abs(t1 - t0);
      if (side === 0) b.beam([mid, PL_Y + 0.9, PLZ + PL], [mid + len, PL_Y + 0.9, PLZ + PL], 0.4, 0.4, MARBLE_MID);
      if (side === 2) b.beam([mid, PL_Y + 0.9, PLZ - PL], [mid + len, PL_Y + 0.9, PLZ - PL], 0.4, 0.4, MARBLE_MID);
      if (side === 1) b.beam([PL, PL_Y + 0.9, mid], [PL, PL_Y + 0.9, mid + len], 0.4, 0.4, MARBLE_MID);
      if (side === 3) b.beam([-PL, PL_Y + 0.9, mid], [-PL, PL_Y + 0.9, mid + len], 0.4, 0.4, MARBLE_MID);
    }
  }
  const MZ = PLZ;
  const HALF = 26;
  const BASE_H = 18;
  b.loft(
    ngon(0, MZ, PL_Y, HALF * 1.06, 8, Math.PI / 8),
    ngon(0, MZ, PL_Y + 1.6, HALF * 1.04, 8, Math.PI / 8),
    MARBLE_SHADE,
    MARBLE2
  );
  b.box(-HALF, PL_Y + 1.6, MZ - HALF, HALF, PL_Y + 1.6 + BASE_H, MZ + HALF, MARBLE2);
  for (let k = 0; k < 4; k += 1) {
    const a = Math.PI / 4 + k * Math.PI / 2;
    const nx = Math.cos(a);
    const nz = Math.sin(a);
    const px = HALF * 0.78 * nx;
    const pz = HALF * 0.78 * nz;
    const w = HALF * 0.55;
    const dx = -nz;
    const dz = nx;
    b.polygonFan(
      [
        [px - dx * w, PL_Y + 1.6, pz - dz * w],
        [px + dx * w, PL_Y + 1.6, pz + dz * w],
        [px + dx * w, PL_Y + 1.6 + BASE_H, pz + dz * w],
        [px - dx * w, PL_Y + 1.6 + BASE_H, pz - dz * w]
      ],
      shade(MARBLE2, 0.97),
      [nx, 0, nz]
    );
  }
  const iwan = (facing, centreT, halfWidth, archTop, baseY) => {
    const nx = facing[0];
    const nz = facing[2];
    const px = -nz;
    const pz = nx;
    const off = HALF + 0.15;
    const c = [centreT[0] + nx * off, 0, centreT[1] + nz * off];
    b.polygonFan(
      [
        [c[0] - px * halfWidth, baseY, c[2] - pz * halfWidth],
        [c[0] + px * halfWidth, baseY, c[2] + pz * halfWidth],
        [c[0] + px * halfWidth, archTop, c[2] + pz * halfWidth],
        [c[0] - px * halfWidth, archTop, c[2] - pz * halfWidth]
      ],
      MARBLE_MID,
      [nx, 0, nz]
    );
    const w = halfWidth * 0.62;
    const spring = baseY + (archTop - baseY) * 0.52;
    b.polygonFan(
      [
        [c[0] - px * w, baseY, c[2] - pz * w],
        [c[0] + px * w, baseY, c[2] + pz * w],
        [c[0] + px * w, spring, c[2] + pz * w],
        [c[0] + px * w * 0.42, archTop - (archTop - spring) * 0.28, c[2] + pz * w * 0.42],
        [c[0], archTop, c[2]],
        [c[0] - px * w * 0.42, archTop - (archTop - spring) * 0.28, c[2] - pz * w * 0.42],
        [c[0] - px * w, spring, c[2] - pz * w]
      ],
      mix(MARBLE_SHADE, INLAY, 0.42),
      [nx, 0, nz]
    );
    b.polygonFan(
      [
        [c[0] - px * (w + 0.55), baseY, c[2] - pz * (w + 0.55)],
        [c[0] + px * (w + 0.55), baseY, c[2] + pz * (w + 0.55)],
        [c[0] + px * (w + 0.55), spring, c[2] + pz * (w + 0.55)],
        [c[0] - px * (w + 0.55), spring, c[2] - pz * (w + 0.55)]
      ],
      INLAY,
      [nx, 0, nz]
    );
  };
  iwan([0, 0, 1], [0, MZ], 7.6, PL_Y + 17.4, PL_Y + 2.4);
  iwan([0, 0, -1], [0, MZ], 7.6, PL_Y + 17.4, PL_Y + 2.4);
  iwan([1, 0, 0], [MZ, 0], 7.6, PL_Y + 17.4, PL_Y + 2.4);
  iwan([-1, 0, 0], [MZ, 0], 7.6, PL_Y + 17.4, PL_Y + 2.4);
  for (const sx of [-1, 1]) {
    const cx = sx * 16.5;
    const z = MZ + HALF + 0.1;
    b.polygonFan(
      [
        [cx - 2.6, PL_Y + 2.4, z],
        [cx + 2.6, PL_Y + 2.4, z],
        [cx + 2.6, PL_Y + 8.2, z],
        [cx, PL_Y + 10.4, z],
        [cx - 2.6, PL_Y + 8.2, z]
      ],
      mix(MARBLE_SHADE, INLAY, 0.3),
      [0, 0, 1]
    );
    b.polygonFan(
      [
        [cx - 3.4, PL_Y + 2.4, z + 0.12],
        [cx + 3.4, PL_Y + 2.4, z + 0.12],
        [cx + 3.4, PL_Y + 9, z + 0.12],
        [cx, PL_Y + 11.4, z + 0.12],
        [cx - 3.4, PL_Y + 9, z + 0.12]
      ],
      MARBLE_MID,
      [0, 0, 1]
    );
  }
  const corniceY = PL_Y + 1.6 + BASE_H;
  b.box(-HALF - 1.4, corniceY, MZ - HALF - 1.4, HALF + 1.4, corniceY + 1.5, MZ + HALF + 1.4, MARBLE_MID);
  b.box(-HALF - 2, corniceY + 1.5, MZ - HALF - 2, HALF + 2, corniceY + 2.3, MZ + HALF + 2, MARBLE2);
  const drumY = corniceY + 2.3;
  const drumH = 6.4;
  stack(b, 0, MZ, drumY, drumY + drumH, 17.2, 17, 24, MARBLE_MID);
  b.loft(
    ngon(0, MZ, drumY + drumH - 0.9, 17.3, 24),
    ngon(0, MZ, drumY + drumH, 17.1, 24),
    INLAY,
    INLAY
  );
  b.loft(
    ngon(0, MZ, drumY + drumH, 18.2, 24),
    ngon(0, MZ, drumY + drumH + 1.2, 18, 24),
    MARBLE2,
    MARBLE_MID
  );
  const domeBase = drumY + drumH + 1.2;
  const domeH = 22.5;
  const domeR = 17.6;
  onionDome(b, 0, MZ, domeBase, domeH, domeR, MARBLE2);
  const domeApex = domeBase + domeH;
  b.cylinder(0, MZ, domeApex - 0.2, domeApex + 2, 1.4, 0.9, 12, GILT2);
  b.cylinder(0, MZ, domeApex + 2, domeApex + 3.4, 0.9, 0.55, 10, GILT2);
  b.cylinder(0, MZ, domeApex + 3.4, domeApex + 6.4, 0.5, 0.18, 8, GILT2);
  b.cylinder(0, MZ, domeApex + 6.4, domeApex + 8.6, 0.18, 0.02, 6, GILT2);
  const chY = corniceY + 2.3;
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1]
  ]) {
    chhatri(b, sx * (HALF - 3.5), MZ + sz * (HALF - 3.5), chY, 1.25);
  }
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1]
  ]) {
    minaret(b, sx * (PL - 3.4), MZ + sz * (PL - 3.4), 0, 41);
  }
  const POOL_Z0 = PLZ + PL + 8;
  const POOL_Z1 = 116;
  const POOL_HW = 6.5;
  b.box(-POOL_HW - 1.6, 0, POOL_Z0, POOL_HW + 1.6, 0.85, POOL_Z1, MARBLE_MID);
  b.groundQuad(-POOL_HW, POOL_Z0 + 1.2, POOL_HW, POOL_Z1 - 1.2, 0.55, WATER);
  b.groundQuad(-2.2, POOL_Z0 + 3, 2.2, POOL_Z1 - 3, 0.58, WATER_PALE);
  for (const sx of [-1, 1]) {
    b.groundQuad(sx * (POOL_HW + 1.6), POOL_Z0, sx * (POOL_HW + 15), POOL_Z1, 0.2, MARBLE_SHADE);
  }
  b.loft(
    ngon(0, POOL_Z0 + 3, 0.3, POOL_HW * 1.15, 12),
    ngon(0, POOL_Z0 + 3, 1.1, POOL_HW * 1.1, 12),
    MARBLE2,
    MARBLE_SHADE
  );
  for (const sx of [-1, 1]) {
    const cx = sx * 44;
    const cz = POOL_Z0 + 34;
    b.box(cx - 14, 0, cz - 12, cx + 14, 9.5, cz + 12, SANDSTONE);
    b.box(cx - 15, 9.5, cz - 13, cx + 15, 10.6, cz + 13, SANDSTONE_DARK);
    for (const ox of [-8, 0, 8]) {
      onionDome(b, cx + ox, cz, 10.6, 5.2, 3.6, MARBLE_MID);
    }
    b.polygonFan(
      [
        [cx - 12, 0.1, cz + 12.12],
        [cx + 12, 0.1, cz + 12.12],
        [cx + 12, 6.2, cz + 12.12],
        [cx - 12, 6.2, cz + 12.12]
      ],
      mix(SANDSTONE_DARK, INLAY, 0.25),
      [0, 0, 1]
    );
  }
  const GC = POOL_Z1 + 8;
  b.box(-22, 0, GC - 4, 22, 13, GC + 4, SANDSTONE);
  b.box(-24, 13, GC - 6, 24, 14.2, GC + 6, SANDSTONE_DARK);
  b.polygonFan(
    [
      [-7, 0.1, GC + 4.12],
      [7, 0.1, GC + 4.12],
      [7, 9, GC + 4.12],
      [0, 11.6, GC + 4.12],
      [-7, 9, GC + 4.12]
    ],
    mix(SANDSTONE_DARK, INLAY, 0.18),
    [0, 0, 1]
  );
  for (const sx of [-1, 1]) {
    onionDome(b, sx * 15, GC, 14.2, 4.4, 3, MARBLE_MID);
  }
  return b.tris;
}

// src/client/models.js
var cache = /* @__PURE__ */ new Map();
var ENTRIES = [
  {
    id: "eiffel",
    build,
    title: "Eiffel Tower",
    place: "Paris, France",
    blurb: "Three tiers of wrought iron over four splayed arches \u2014 the silhouette that has stood in for Paris since 1889.",
    titleKey: "eiffel.name",
    placeKey: "eiffel.place",
    blurbKey: "eiffel.blurb"
  },
  {
    id: "great-wall",
    build: build2,
    title: "Great Wall",
    place: "Badaling, China",
    blurb: "A crenellated parapet riding a mountain ridge, punctuated by square watchtowers that carried beacon fires.",
    titleKey: "wall.name",
    placeKey: "wall.place",
    blurbKey: "wall.blurb"
  },
  {
    id: "forbidden-city",
    build: build3,
    title: "Forbidden City",
    place: "Beijing, China",
    blurb: "Vermilion walls and imperial yellow hip roofs around the Hall of Supreme Harmony, raised on a white marble terrace.",
    titleKey: "forbidden-city.name",
    placeKey: "forbidden-city.place",
    blurbKey: "forbidden-city.blurb"
  },
  {
    id: "taj-mahal",
    build: build4,
    title: "Taj Mahal",
    place: "Agra, India",
    blurb: "A marble onion dome flanked by four minarets, mirrored in a long reflecting pool on the river terrace.",
    titleKey: "taj-mahal.name",
    placeKey: "taj-mahal.place",
    blurbKey: "taj-mahal.blurb"
  }
];
function loadModel(id) {
  if (cache.has(id)) {
    const cached = cache.get(id);
    if (cached instanceof Error) throw cached;
    return cached;
  }
  const entry = ENTRIES.find((e) => e.id === id);
  if (!entry) throw new Error(`unknown landmark: ${id}`);
  try {
    const tris = entry.build();
    cache.set(id, tris);
    return tris;
  } catch (err) {
    const wrapped = err instanceof Error ? err : new Error(String(err));
    cache.set(id, wrapped);
    throw wrapped;
  }
}
function listLandmarks() {
  return ENTRIES;
}

// src/client/ui.js
var PALETTES = {
  light: {
    skyTop: "#e2e9f1",
    skyBottom: "#f8f5ef",
    discInner: [0.88, 0.86, 0.83],
    discOuter: [0.8, 0.79, 0.76],
    shadow: 0.17,
    sky: [0.63, 0.69, 0.79],
    bounce: [0.35, 0.33, 0.31]
  },
  dark: {
    skyTop: "#0c121d",
    skyBottom: "#1c2636",
    discInner: [0.14, 0.17, 0.22],
    discOuter: [0.07, 0.09, 0.13],
    shadow: 0.36,
    sky: [0.18, 0.22, 0.3],
    bounce: [0.05, 0.06, 0.08]
  }
};
var CSS = `
.lm-root {
  box-sizing: border-box;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 20px 20px 16px;
  color: var(--dsw-alias-label-primary);
  font: inherit;
  background: var(--dsw-alias-bg-base);
}
.lm-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
}
.lm-title { margin: 0; font-size: 19px; font-weight: 600; letter-spacing: .01em; }
.lm-sub { margin: 3px 0 0; font-size: 12.5px; color: var(--dsw-alias-label-secondary); }
.lm-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.lm-btn {
  appearance: none; display: inline-flex; align-items: center; gap: 6px;
  height: 30px; padding: 0 11px; border-radius: 8px;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1);
  color: var(--dsw-alias-label-primary);
  font-size: 12.5px; font-family: inherit; cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.lm-btn:hover { background: var(--dsw-alias-bg-layer-2); border-color: var(--dsw-alias-border-l2); }
.lm-btn:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.lm-btn[aria-pressed='true'] { border-color: var(--dsw-alias-brand-primary); color: var(--dsw-alias-brand-primary); }
.lm-body {
  flex: 1 1 auto; min-height: 0;
  display: grid; grid-template-columns: 216px minmax(0, 1fr); gap: 12px;
}
.lm-list { display: flex; flex-direction: column; gap: 6px; overflow-y: auto; padding-right: 2px; }
.lm-item {
  appearance: none; text-align: left; display: block; width: 100%;
  padding: 9px 11px; border-radius: 10px; font-family: inherit;
  border: 1px solid var(--dsw-alias-border-l1);
  background: var(--dsw-alias-bg-layer-1); color: inherit; cursor: pointer;
  transition: background 120ms ease, border-color 120ms ease;
}
.lm-item:hover { background: var(--dsw-alias-bg-layer-2); }
.lm-item:focus-visible { outline: 2px solid var(--dsw-alias-brand-primary); outline-offset: 1px; }
.lm-item[aria-current='true'] { border-color: var(--dsw-alias-brand-primary); background: var(--dsw-alias-bg-layer-2); }
.lm-item-name { font-size: 13.5px; font-weight: 600; }
.lm-item-place { margin-top: 1px; font-size: 11.5px; color: var(--dsw-alias-label-secondary); }
.lm-stage-wrap { position: relative; min-height: 0; display: flex; }
.lm-stage {
  position: relative; flex: 1 1 auto; min-height: 260px; border-radius: 12px;
  border: 1px solid var(--dsw-alias-border-l1); overflow: hidden;
  background: linear-gradient(180deg, var(--lm-sky-top) 0%, var(--lm-sky-bottom) 100%);
}
.lm-canvas { display: block; width: 100%; height: 100%; touch-action: none; cursor: grab; }
.lm-canvas:active { cursor: grabbing; }
.lm-info {
  position: absolute; left: 12px; bottom: 12px; max-width: min(370px, 64%);
  padding: 10px 12px; border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay) 84%, transparent);
  border: 1px solid var(--dsw-alias-border-l1);
  pointer-events: none;
}
.lm-info-name { font-size: 14px; font-weight: 600; }
.lm-info-place { font-size: 11.5px; color: var(--dsw-alias-label-secondary); margin-top: 1px; }
.lm-info-blurb { margin: 6px 0 0; font-size: 12px; line-height: 1.5; color: var(--dsw-alias-label-secondary); }
.lm-stats { position: absolute; right: 12px; top: 12px; display: flex; gap: 6px; pointer-events: none; }
.lm-chip {
  padding: 3px 8px; border-radius: 999px; font-size: 11px; font-variant-numeric: tabular-nums;
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay) 84%, transparent);
  border: 1px solid var(--dsw-alias-border-l1); color: var(--dsw-alias-label-secondary);
}
.lm-hint {
  position: absolute; left: 12px; top: 12px; max-width: 55%;
  font-size: 11px; color: var(--dsw-alias-label-secondary);
  background: color-mix(in srgb, var(--dsw-alias-bg-overlay) 78%, transparent);
  border-radius: 999px; padding: 3px 10px; pointer-events: none; white-space: nowrap;
}
.lm-fallback {
  position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
  flex-direction: column; gap: 8px; text-align: center; padding: 24px;
  font-size: 12.5px; color: var(--dsw-alias-label-secondary);
}
@media (max-width: 760px) {
  .lm-body { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr); }
  .lm-list { flex-direction: row; overflow-x: auto; }
  .lm-item { min-width: 130px; }
  .lm-info { display: none; }
}
@media (prefers-reduced-motion: reduce) { .lm-btn, .lm-item { transition: none; } }
`;
function glyph(React, path, extras) {
  return React.createElement(
    "svg",
    { width: 14, height: 14, viewBox: "0 0 16 16", "aria-hidden": "true" },
    React.createElement("path", { d: path, fill: "none", stroke: "currentColor", strokeWidth: 1.4, strokeLinecap: "round", strokeLinejoin: "round", ...extras })
  );
}
function withBoundary(React, Component, renderError) {
  class Boundary extends React.Component {
    constructor(props) {
      super(props);
      this.state = { error: null };
    }
    componentDidCatch(error) {
      this.setState({ error: String(error && error.message || error) });
    }
    render() {
      if (this.state.error) return renderError(this.state.error, this.props);
      return React.createElement(Component, this.props);
    }
  }
  Boundary.displayName = "LandmarkBoundary";
  return Boundary;
}
function createLandmarkUi(React) {
  const h = React.createElement;
  function SidebarIcon({ size }) {
    const px = typeof size === "number" && size > 0 ? size : 16;
    return h(
      "svg",
      { width: px, height: px, viewBox: "0 0 16 16", fill: "none", "aria-hidden": "true", style: { display: "block" } },
      h("path", { d: "M2.9 13.5h10.2", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" }),
      h("path", { d: "M4.3 13.5 6.1 5.2h3.8l1.8 8.3z", stroke: "currentColor", strokeWidth: 1.2, strokeLinejoin: "round" }),
      h("path", { d: "M6 8.8h4M6.7 11.1h2.6", stroke: "currentColor", strokeWidth: 1.1, strokeLinecap: "round" }),
      h("path", { d: "M8 1.6v2.2", stroke: "currentColor", strokeWidth: 1.3, strokeLinecap: "round" })
    );
  }
  function Stage(props) {
    const { entry, palette, t, autoRotate, resetSignal, onMetrics, metrics } = props;
    const hostRef = React.useRef(null);
    const canvasRef = React.useRef(null);
    const rendererRef = React.useRef(null);
    const drawRef = React.useRef(null);
    const paintRef = React.useRef(null);
    const stateRef = React.useRef({ yaw: 0.72, pitch: 0.3, zoom: 1, dragging: false, lastX: 0, lastY: 0 });
    const [failure, setFailure] = React.useState(null);
    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return void 0;
      let renderer;
      try {
        renderer = new LandmarkRenderer(canvas, { onLost: () => setFailure("lost") });
      } catch (err) {
        setFailure(String(err && err.message || err));
        return void 0;
      }
      rendererRef.current = renderer;
      const host = hostRef.current;
      if (host) {
        const rect = host.getBoundingClientRect();
        renderer.resize(rect.width, rect.height, Math.min(window.devicePixelRatio || 1, 2.5));
      }
      paintRef.current?.();
      return () => {
        rendererRef.current = null;
        renderer.dispose();
      };
    }, []);
    React.useEffect(() => {
      const renderer = rendererRef.current;
      if (!renderer || !entry) return;
      let tris;
      try {
        tris = loadModel(entry.id);
        setFailure(null);
      } catch (err) {
        setFailure(String(err && err.message || err));
        return;
      }
      const metrics2 = renderer.setModel(tris);
      if (metrics2) onMetrics({ ...metrics2, triangles: tris.length });
      paintRef.current?.();
    }, [entry, onMetrics]);
    React.useEffect(() => {
      const host = hostRef.current;
      if (!host) return void 0;
      const apply = () => {
        const rect = host.getBoundingClientRect();
        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        if (rendererRef.current) rendererRef.current.resize(rect.width, rect.height, dpr);
        paintRef.current?.();
      };
      apply();
      if (typeof ResizeObserver === "function") {
        const ro = new ResizeObserver(apply);
        ro.observe(host);
        return () => ro.disconnect();
      }
      window.addEventListener("resize", apply);
      return () => window.removeEventListener("resize", apply);
    }, []);
    React.useEffect(() => {
      const draw = () => {
        const renderer = rendererRef.current;
        if (!renderer || !renderer.metrics) return;
        const s = stateRef.current;
        const pal = PALETTES[palette === "dark" ? "dark" : "light"];
        const cp = Math.cos(0.62);
        const sun = unit([Math.sin(s.yaw + 0.62) * cp, Math.sin(0.62), Math.cos(s.yaw + 0.62) * cp]);
        renderer.draw(
          {
            yaw: s.yaw,
            pitch: Math.max(-0.12, Math.min(1.1, s.pitch)),
            zoom: s.zoom,
            target: [0, renderer.metrics.height * 0.42, 0]
          },
          {
            sun,
            sky: pal.sky,
            bounce: pal.bounce,
            discInner: pal.discInner,
            discOuter: pal.discOuter,
            shadow: pal.shadow
          }
        );
      };
      drawRef.current = draw;
      paintRef.current = draw;
      draw();
      return () => {
        drawRef.current = null;
        paintRef.current = null;
      };
    }, [palette, entry]);
    React.useEffect(() => {
      if (!autoRotate) return void 0;
      let raf = 0;
      let last = 0;
      const loop = (now) => {
        const s = stateRef.current;
        const dt = last ? Math.min(64, now - last) : 16;
        last = now;
        if (!s.dragging) s.yaw += dt * 32e-5;
        drawRef.current?.();
        raf = requestAnimationFrame(loop);
      };
      raf = requestAnimationFrame(loop);
      return () => cancelAnimationFrame(raf);
    }, [autoRotate]);
    React.useEffect(() => {
      if (!resetSignal) return;
      stateRef.current.yaw = 0.72;
      stateRef.current.pitch = 0.3;
      stateRef.current.zoom = 1;
      paintRef.current?.();
    }, [resetSignal]);
    const onDown = React.useCallback((ev) => {
      const s = stateRef.current;
      s.dragging = true;
      s.lastX = ev.clientX;
      s.lastY = ev.clientY;
      try {
        ev.currentTarget.setPointerCapture(ev.pointerId);
      } catch {
      }
    }, []);
    const onMove = React.useCallback((ev) => {
      const s = stateRef.current;
      if (!s.dragging) return;
      s.yaw += (ev.clientX - s.lastX) * 75e-4;
      s.pitch = Math.max(-0.12, Math.min(1.1, s.pitch + (ev.clientY - s.lastY) * 5e-3));
      s.lastX = ev.clientX;
      s.lastY = ev.clientY;
      paintRef.current?.();
    }, []);
    const onUp = React.useCallback(() => {
      stateRef.current.dragging = false;
    }, []);
    const onDblClick = React.useCallback(() => {
      const s = stateRef.current;
      s.yaw = 0.72;
      s.pitch = 0.3;
      s.zoom = 1;
      paintRef.current?.();
    }, []);
    React.useEffect(() => {
      const canvas = canvasRef.current;
      if (!canvas) return void 0;
      const onWheelNative = (ev) => {
        ev.preventDefault();
        const s = stateRef.current;
        s.zoom = Math.max(0.5, Math.min(2.6, s.zoom * Math.exp((ev.deltaY || 0) * 12e-4)));
        paintRef.current?.();
      };
      canvas.addEventListener("wheel", onWheelNative, { passive: false });
      return () => canvas.removeEventListener("wheel", onWheelNative);
    }, []);
    return h(
      "div",
      { className: "lm-stage", ref: hostRef },
      h("canvas", {
        className: "lm-canvas",
        ref: canvasRef,
        role: "img",
        "aria-label": entry ? `${t(entry.titleKey, entry.title)} \u2014 ${t(entry.placeKey, entry.place)}` : t("panel.title"),
        onPointerDown: onDown,
        onPointerMove: onMove,
        onPointerUp: onUp,
        onPointerCancel: onUp,
        onDoubleClick: onDblClick
      }),
      entry ? h("div", { className: "lm-hint" }, t("panel.hint")) : null,
      metrics ? h(
        "div",
        { className: "lm-stats" },
        h("span", { className: "lm-chip" }, `${metrics.triangles} ${t("panel.triangles")}`),
        h("span", { className: "lm-chip" }, `${Math.round(metrics.height)} m ${t("panel.height")}`)
      ) : null,
      failure ? h("div", { className: "lm-fallback" }, h("strong", null, t("panel.error")), h("span", null, failure)) : null,
      entry ? h(
        "div",
        { className: "lm-info" },
        h("div", { className: "lm-info-name" }, t(entry.titleKey, entry.title)),
        h("div", { className: "lm-info-place" }, t(entry.placeKey, entry.place)),
        h("p", { className: "lm-info-blurb" }, t(entry.blurbKey, entry.blurb))
      ) : null
    );
  }
  function MainPanel(props) {
    const services = props.services ?? makeServices(null);
    const t = useTranslate(React, services.get("locale"));
    const palette = usePalette(React, services);
    const models = listLandmarks();
    const [selected, setSelected] = React.useState(models[0].id);
    const [autoRotate, setAutoRotate] = React.useState(true);
    const [resetSignal, setResetSignal] = React.useState(0);
    const [metrics, setMetrics] = React.useState(null);
    const onMetrics = React.useCallback((m) => setMetrics(m), []);
    const entry = models.find((m) => m.id === selected) ?? models[0];
    useLocaleRevision(React, services);
    const pal = PALETTES[palette];
    return h(
      "div",
      {
        className: "lm-root",
        style: { "--lm-sky-top": pal.skyTop, "--lm-sky-bottom": pal.skyBottom }
      },
      h("style", null, CSS),
      h(
        "header",
        { className: "lm-head" },
        h(
          "div",
          null,
          h("h1", { className: "lm-title" }, t("panel.title")),
          h("p", { className: "lm-sub" }, t("panel.subtitle"))
        ),
        h(
          "div",
          { className: "lm-actions" },
          h(
            "button",
            {
              type: "button",
              className: "lm-btn",
              "aria-pressed": autoRotate ? "true" : "false",
              onClick: () => setAutoRotate((v) => !v)
            },
            glyph(React, "M2.6 8a5.4 5.4 0 0 1 9.5-3.5M13.4 8a5.4 5.4 0 0 1-9.5 3.5"),
            glyph(React, "M12.9 1.9v3h-3M3.1 14.1v-3h3"),
            t("panel.rotate")
          ),
          h(
            "button",
            { type: "button", className: "lm-btn", onClick: () => setResetSignal((v) => v + 1) },
            glyph(React, "M8 3.2a4.8 4.8 0 1 1-4.4 2.9M2.4 3.4v3.1h3.1"),
            t("panel.reset")
          )
        )
      ),
      h(
        "div",
        { className: "lm-body" },
        h(
          "nav",
          { className: "lm-list", "aria-label": t("panel.title") },
          models.map(
            (m) => h(
              "button",
              {
                key: m.id,
                type: "button",
                className: "lm-item",
                "aria-current": m.id === selected ? "true" : "false",
                onClick: () => setSelected(m.id)
              },
              h("div", { className: "lm-item-name" }, t(m.titleKey, m.title)),
              h("div", { className: "lm-item-place" }, t(m.placeKey, m.place))
            )
          )
        ),
        h(
          "div",
          { className: "lm-stage-wrap" },
          h(Stage, { entry, palette, t, autoRotate, resetSignal, onMetrics, metrics })
        )
      )
    );
  }
  function renderPanelError(error, props) {
    const t = props.services ? makeTranslate(props.services.get("locale")) : (key, fallback) => fallback ?? key;
    return h(
      "div",
      { className: "lm-root" },
      h("style", null, CSS),
      h(
        "div",
        { className: "lm-fallback", style: { position: "static", flex: 1 } },
        h("strong", null, t("panel.error")),
        h("span", null, String(error))
      )
    );
  }
  return {
    MainPanel: withBoundary(React, MainPanel, renderPanelError),
    SidebarIcon
  };
}
function makeServices(ctx) {
  const lookup = (name) => {
    try {
      return ctx && typeof ctx.get === "function" ? ctx.get(name) : void 0;
    } catch {
      return void 0;
    }
  };
  return {
    get: lookup,
    subscribe(event, fn) {
      try {
        if (!ctx || typeof ctx.on !== "function") return void 0;
        return ctx.on(event, fn);
      } catch {
        return void 0;
      }
    }
  };
}
function makeTranslate(locale) {
  let bound = null;
  if (locale && typeof locale.bind === "function") {
    try {
      bound = locale.bind("landmarks3d");
    } catch {
      bound = null;
    }
  }
  return (key, fallback) => {
    if (!bound) return typeof fallback === "string" ? fallback : key;
    try {
      const value = bound(key);
      return typeof value === "string" && value !== key ? value : typeof fallback === "string" ? fallback : key;
    } catch {
      return typeof fallback === "string" ? fallback : key;
    }
  };
}
function useTranslate(React, locale) {
  return React.useMemo(() => makeTranslate(locale), [locale]);
}
function useLocaleRevision(React, services) {
  const [, force] = React.useReducer((v) => v + 1, 0);
  React.useEffect(() => {
    const unsubscribe = services.subscribe("locale/change", () => force());
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [services]);
  return null;
}
function usePalette(React, services) {
  const read = React.useCallback(() => {
    try {
      const theme = services.get("theme");
      const snap = theme && typeof theme.getTheme === "function" ? theme.getTheme() : null;
      const def = snap && (snap.active ?? snap);
      return def && def.colorScheme === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  }, [services]);
  const [palette, setPalette] = React.useState(read);
  React.useEffect(() => {
    setPalette(read());
  }, [read]);
  React.useEffect(() => {
    let unsubscribe;
    try {
      unsubscribe = services.subscribe ? services.subscribe("theme/change", () => setPalette(read())) : void 0;
    } catch {
      unsubscribe = void 0;
    }
    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [services, read]);
  return palette;
}

// src/client/locale-data.js
var LOCALE_NAMESPACES = {
  en: {
    "panel.title": "Landmark studio",
    "panel.subtitle": "Four monuments, rebuilt as real-time 3D models",
    "panel.hint": "Drag to orbit \xB7 scroll to zoom \xB7 double-click to reset",
    "panel.error": "This model could not be built.",
    "panel.reset": "Reset view",
    "panel.rotate": "Auto-rotate",
    "panel.triangles": "triangles",
    "panel.height": "height",
    "eiffel.name": "Eiffel Tower",
    "eiffel.place": "Paris, France",
    "eiffel.blurb": "Three tiers of wrought iron over four splayed arches \u2014 the silhouette that has stood in for Paris since 1889.",
    "wall.name": "Great Wall",
    "wall.place": "Badaling, China",
    "wall.blurb": "A crenellated parapet riding a mountain ridge, punctuated by square watchtowers that carried beacon fires.",
    "forbidden-city.name": "Forbidden City",
    "forbidden-city.place": "Beijing, China",
    "forbidden-city.blurb": "Vermilion walls and imperial yellow hip roofs around the Hall of Supreme Harmony, raised on a white marble terrace.",
    "taj-mahal.name": "Taj Mahal",
    "taj-mahal.place": "Agra, India",
    "taj-mahal.blurb": "A marble onion dome flanked by four minarets, mirrored in a long reflecting pool on the river terrace."
  },
  zh: {
    "panel.title": "\u5730\u6807\u5DE5\u574A",
    "panel.subtitle": "\u56DB\u5EA7\u540D\u8FF9\uFF0C\u4EE5\u5B9E\u65F6 3D \u6A21\u578B\u91CD\u5EFA",
    "panel.hint": "\u62D6\u52A8\u65CB\u8F6C \xB7 \u6EDA\u8F6E\u7F29\u653E \xB7 \u53CC\u51FB\u590D\u4F4D",
    "panel.error": "\u8BE5\u6A21\u578B\u6784\u5EFA\u5931\u8D25\u3002",
    "panel.reset": "\u590D\u4F4D\u89C6\u89D2",
    "panel.rotate": "\u81EA\u52A8\u65CB\u8F6C",
    "panel.triangles": "\u4E09\u89D2\u9762",
    "panel.height": "\u9AD8\u5EA6",
    "eiffel.name": "\u57C3\u83F2\u5C14\u94C1\u5854",
    "eiffel.place": "\u6CD5\u56FD \xB7 \u5DF4\u9ECE",
    "eiffel.blurb": "\u56DB\u9053\u5916\u5F20\u7684\u62F1\u4E0E\u4E09\u5C42\u953B\u94C1\u7ED3\u6784\u2014\u2014\u81EA 1889 \u5E74\u8D77\uFF0C\u8FD9\u4E2A\u526A\u5F71\u5C31\u662F\u5DF4\u9ECE\u7684\u4EE3\u8BCD\u3002",
    "wall.name": "\u4E2D\u56FD\u957F\u57CE",
    "wall.place": "\u4E2D\u56FD \xB7 \u516B\u8FBE\u5CAD",
    "wall.blurb": "\u579B\u53E3\u6CBF\u5C71\u810A\u8D77\u4F0F\u873F\u8712\uFF0C\u65B9\u5F62\u654C\u697C\u4F9D\u6B21\u77D7\u7ACB\uFF0C\u66FE\u7528\u4E8E\u4F20\u9012\u70FD\u706B\u3002",
    "forbidden-city.name": "\u7D2B\u7981\u57CE",
    "forbidden-city.place": "\u4E2D\u56FD \xB7 \u5317\u4EAC",
    "forbidden-city.blurb": "\u6731\u5899\u9EC4\u74E6\u73AF\u7ED5\u592A\u548C\u6BBF\uFF0C\u6BBF\u8EAB\u5750\u843D\u5728\u6C49\u767D\u7389\u4E09\u5C42\u987B\u5F25\u5EA7\u4E0A\u3002",
    "taj-mahal.name": "\u6CF0\u59EC\u9675",
    "taj-mahal.place": "\u5370\u5EA6 \xB7 \u963F\u683C\u62C9",
    "taj-mahal.blurb": "\u767D\u8272\u5927\u7406\u77F3\u6D0B\u8471\u7A79\u9876\u4E0E\u56DB\u5EA7\u5BA3\u793C\u5854\uFF0C\u5012\u6620\u5728\u6CB3\u9636\u4E0A\u7684\u957F\u5F62\u6C34\u6C60\u4E4B\u4E2D\u3002"
  }
};

// entry.js
var PANEL_KEY = "landmarks3d";
window.__ModuleLoader__.load({
  id: "@local/dsh-landmarks-3d",
  factory(require2) {
    const React = require2("react");
    const ui = createLandmarkUi(React);
    return {
      inject: ["slots"],
      apply(ctx) {
        const services = makeServices(ctx);
        const locale = ctx.get("locale");
        if (locale && typeof locale.register === "function") {
          for (const language of Object.keys(LOCALE_NAMESPACES)) {
            ctx.effect(
              () => locale.register("landmarks3d", language, LOCALE_NAMESPACES[language])
            );
          }
        }
        ctx.slots.inject(
          "main",
          () => ctx.slots.register(
            { name: "main", key: PANEL_KEY },
            (props) => React.createElement(ui.MainPanel, { ...props, services })
          )
        );
        ctx.slots.inject(
          "sidebar.panellist",
          () => ctx.slots.register(
            {
              name: "sidebar.panellist",
              id: PANEL_KEY,
              order: 20,
              label: () => makeTranslate(services.get("locale"))("panel.title", "Landmark studio")
            },
            ui.SidebarIcon
          )
        );
      }
    };
  }
});
