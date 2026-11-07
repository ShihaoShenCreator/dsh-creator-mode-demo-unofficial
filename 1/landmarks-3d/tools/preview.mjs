/**
 * Offline preview renderer: rasterises each model to a PNG with a tiny
 * software rasteriser, so the geometry can be inspected without a browser.
 *
 * This is a *development* aid for the model authors, not the shipped renderer —
 * the shipped path is WebGL in the page (see `src/view/renderer.js`). It shares
 * nothing with that code except the mesh format.
 *
 *   node tools/preview.mjs            # all four, into preview/
 *   node tools/preview.mjs eiffel
 */
import { deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(root, 'preview');
mkdirSync(OUT, { recursive: true });

const W = 960;
const H = 680;
const FOVY = 0.72;

function png(width, height, rgb) {
  // Minimal PNG writer: RGB8, one IDAT, filter 0 per scanline.
  const stride = width * 3;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const chunks = [];
  const chunk = (type, data) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body), 0);
    chunks.push(len, body, crc);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type RGB
  chunk('IHDR', ihdr);
  chunk('IDAT', deflateSync(raw, { level: 6 }));
  chunk('IEND', Buffer.alloc(0));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), ...chunks]);
}

let crcTable = null;
function crc32(buf) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let n = 0; n < 256; n += 1) {
      let c = n;
      for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i += 1) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function norm(v) {
  const L = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / L, v[1] / L, v[2] / L];
}
function cross(a, b) {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}
function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** Rasterise one model to RGB bytes. */
function render(tris, opts) {
  const { yaw = 0.72, pitch = 0.30 } = opts;
  // Bounds
  const b = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity];
  for (const t of tris) {
    for (let i = 0; i < 3; i += 1) {
      const x = t.p[i * 3],
        y = t.p[i * 3 + 1],
        z = t.p[i * 3 + 2];
      if (x < b[0]) b[0] = x;
      if (y < b[1]) b[1] = y;
      if (z < b[2]) b[2] = z;
      if (x > b[3]) b[3] = x;
      if (y > b[4]) b[4] = y;
      if (z > b[5]) b[5] = z;
    }
  }
  const target = [(b[0] + b[3]) / 2, (b[1] + b[4]) * 0.44, (b[2] + b[5]) / 2];
  const halfX = (b[3] - b[0]) / 2;
  const halfZ = (b[5] - b[2]) / 2;
  const minY = b[1];
  const maxY = b[4];

  const aspect = W / H;
  const tanV = Math.tan(FOVY / 2);
  const tanH = tanV * aspect;
  // Fit exactly like the runtime: all eight box corners inside the frustum.
  const cp = Math.cos(pitch);
  const eyeDir = [Math.sin(yaw) * cp, Math.sin(pitch), Math.cos(yaw) * cp];
  const forward = [-eyeDir[0], -eyeDir[1], -eyeDir[2]];
  const right = norm(cross(forward, [0, 1, 0]));
  const up = cross(right, forward);
  let need = 0;
  for (const sx of [-1, 1]) {
    for (const sy of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const p = [sx * halfX, sy > 0 ? maxY : minY, sz * halfZ];
        const d = [p[0] - target[0], p[1] - target[1], p[2] - target[2]];
        const cx = dot(d, right);
        const cy = dot(d, up);
        const cz = dot(d, forward);
        need = Math.max(need, Math.abs(cx) / tanH - cz, Math.abs(cy) / tanV - cz);
      }
    }
  }
  const dist = need * 1.05 / (opts.zoom || 1);
  const eye = [
    target[0] + eyeDir[0] * dist,
    target[1] + eyeDir[1] * dist,
    target[2] + eyeDir[2] * dist,
  ];

  const rgb = Buffer.alloc(W * H * 3);
  // Sky gradient background
  for (let y = 0; y < H; y += 1) {
    const t = y / H;
    const r = Math.round(226 * (1 - t) + 250 * t);
    const g = Math.round(233 * (1 - t) + 247 * t);
    const bl = Math.round(241 * (1 - t) + 240 * t);
    for (let x = 0; x < W; x += 1) {
      const o = (y * W + x) * 3;
      rgb[o] = r;
      rgb[o + 1] = g;
      rgb[o + 2] = bl;
    }
  }

  const zbuf = new Float64Array(W * H).fill(Infinity);
  const sun = norm([Math.sin(yaw + 0.62) * Math.cos(0.62), Math.sin(0.62), Math.cos(yaw + 0.62) * Math.cos(0.62)]);
  const cull = opts.cull !== false;
  let culled = 0;

  for (const t of tris) {
    const verts = [];
    for (let i = 0; i < 3; i += 1) {
      const p = [t.p[i * 3] - eye[0], t.p[i * 3 + 1] - eye[1], t.p[i * 3 + 2] - eye[2]];
      const x = dot(p, right);
      const y = dot(p, up);
      const z = dot(p, forward);
      if (z <= 1e-6) continue;
      verts.push([x / (z * tanH) * (aspect > 1 ? 1 : 1), y / (z * tanV), z, p]);
    }
    if (verts.length < 3) continue;

    // Face normal in world space and its shading.
    const e1 = [t.p[3] - t.p[0], t.p[4] - t.p[1], t.p[5] - t.p[2]];
    const e2 = [t.p[6] - t.p[0], t.p[7] - t.p[1], t.p[8] - t.p[2]];
    const n = norm(cross(e1, e2));
    // Backface culling, matching WebGL's gl.CULL_FACE in the shipped renderer:
    // drop faces whose normal points away from the camera. Without this the
    // preview can show geometry that never appears in the product.
    if (cull) {
      const toEye = norm([eye[0] - t.p[0], eye[1] - t.p[1], eye[2] - t.p[2]]);
      if (dot(n, toEye) <= 0) {
        culled += 1;
        continue;
      }
    }
    const lambert = Math.max(0, dot(n, sun));
    const hemi = 0.5 + 0.5 * n[1];
    const amb = 0.34 + 0.30 * hemi;
    const shade = amb + lambert * 0.80;
    const col = [
      Math.min(255, Math.round(t.c[0] * shade * 255)),
      Math.min(255, Math.round(t.c[1] * shade * 255)),
      Math.min(255, Math.round(t.c[2] * shade * 255)),
    ];

    // Screen space: x spans the horizontal half-angle plane, y the vertical.
    const sx = verts.map((v) => W / 2 + v[0] * (W / 2));
    const sy = verts.map((v) => H / 2 - v[1] * (H / 2));
    const minX = Math.max(0, Math.floor(Math.min(...sx)));
    const maxX = Math.min(W - 1, Math.ceil(Math.max(...sx)));
    const minYv = Math.max(0, Math.floor(Math.min(...sy)));
    const maxYv = Math.min(H - 1, Math.ceil(Math.max(...sy)));
    if (maxX < minX || maxYv < minYv) continue;
    const area = (sx[1] - sx[0]) * (sy[2] - sy[0]) - (sx[2] - sx[0]) * (sy[1] - sy[0]);
    if (Math.abs(area) < 1e-12) continue;
    for (let y = minYv; y <= maxYv; y += 1) {
      for (let x = minX; x <= maxX; x += 1) {
        const px = x + 0.5;
        const py = y + 0.5;
        const w0 = ((sx[1] - px) * (sy[2] - py) - (sx[2] - px) * (sy[1] - py)) / area;
        const w1 = ((sx[2] - px) * (sy[0] - py) - (sx[0] - px) * (sy[2] - py)) / area;
        const w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * verts[0][2] + w1 * verts[1][2] + w2 * verts[2][2];
        const idx = y * W + x;
        if (z >= zbuf[idx]) continue;
        zbuf[idx] = z;
        const o = idx * 3;
        rgb[o] = col[0];
        rgb[o + 1] = col[1];
        rgb[o + 2] = col[2];
      }
    }
  }
  return png(W, H, rgb);
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const zoomArg = process.argv.find((a) => a.startsWith('--zoom='));
const zoom = zoomArg ? Number(zoomArg.split('=')[1]) || 1 : 1;
const MODELS = [
  ['eiffel', 'src/models/eiffel.js'],
  ['great-wall', 'src/models/great-wall.js'],
  ['forbidden-city', 'src/models/forbidden-city.js'],
  ['taj-mahal', 'src/models/taj-mahal.js'],
];

for (const [name, file] of MODELS) {
  if (only.length && !only.includes(name)) continue;
  const mod = await import(pathToFileURL(resolve(root, file)).href);
  const tris = mod.build();
  const started = Date.now();
  const pngBuf = render(tris, { yaw: 0.72, pitch: 0.30, zoom });
  const suffix = zoom === 1 ? '' : `-zoom${zoom}`;
  const target = resolve(OUT, `${name}${suffix}.png`);
  writeFileSync(target, pngBuf);
  console.log(`${name}: ${tris.length} tris -> ${target} (${Date.now() - started} ms)`);
}
