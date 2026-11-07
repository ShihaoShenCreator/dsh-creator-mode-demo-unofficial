/**
 * The Great Wall at Badaling — a crenellated parapet riding a mountain ridge.
 *
 * Composition matters more than real-world extent here: a 1 km wall on a
 * 27 m ridge reads as a scratch on a plane. The scene is therefore compressed
 * to ~340 m and the ridge raised to ~45 m, closer to how the wall is
 * photographed — a wall climbing steeply over a sharp crest.
 *
 * Recognition comes from: the merlon teeth on the parapet, the wall's
 * batter (wider at its base), the walkway, and the square watchtowers that
 * punctuate the crest.
 */
import { createBuilder, hex, shade, mix } from '../geom-kit.js';

const BRICK = hex('#bda98f');
const BRICK_PALE = hex('#cdbc9f');
const BRICK_DARK = hex('#9c876f');
const STONE = hex('#8d7c68');
const STONE_DARK = hex('#736556');
const RIDGE = hex('#7b8a5c');
const RIDGE_PALE = hex('#93a06f');
const RIDGE_DARK = hex('#616e48');
const PAVING = hex('#ab9f8a');
const MOSS = hex('#6b7a50');
const ROCK = hex('#8a8478');

const HALF_SPAN = 150;
const NX = 46;
const NZ = 18;

/** Ridge crest height above the valley floor, as a function of x. */
function crest(x) {
  // Two humps with a saddle: the wall dips through the middle, which is what
  // makes a wall on a ridge read as a wall on a ridge.
  const hump = 24 * Math.sin(((x + HALF_SPAN) / (2 * HALF_SPAN)) * Math.PI);
  const relief = Math.pow(Math.max(0, hump), 1.05) + 5 * Math.sin(x * 0.045 + 0.7);
  // Fade the whole ridge out at both ends of the scene, so the terrain never
  // ends in a vertical cut face; the hill simply meets the valley floor.
  const edge = Math.max(0, Math.min(1, (HALF_SPAN - 24 - Math.abs(x)) / 34));
  return Math.max(0, (7 + relief) * edge);
}

/** The ridge centreline in z, so the wall snakes instead of running straight. */
function pathZ(x) {
  return 24 * Math.sin(x / 62) + 6 * Math.sin(x / 21);
}

/** Terrain height at a point: a ridge falling away to either side. */
function terrainAt(x, z) {
  const dz = z - pathZ(x);
  const sigma = 26;
  const fall = Math.exp(-(dz * dz) / (sigma * sigma));
  const c = crest(x);
  // A shallow valley floor plus the ridge hump.
  return Math.max(0, c * fall - 1.5 * (1 - fall));
}

/** Unit direction of the wall path at x, in the XZ plane. */
function pathDir(x) {
  const e = 0.8;
  const dz = pathZ(x + e) - pathZ(x - e);
  const L = Math.hypot(2 * e, dz) || 1;
  return [2 * e / L, 0, dz / L];
}

/** A rectangular prism along `dir`, centred at (cx,cz), from y0 to y1. */
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
    [cx + ox + wx, y, cz + oz + wz],
  ];
  b.loft(loop(y0), loop(y1), colour, shade(colour, 0.88));
}

export function build() {
  const b = createBuilder();

  // ---------------------------------------------------------------- terrain
  // A heightfield grid. Colour follows height and slope: grassy crest, darker
  // rock and moss in the gullies, so the ridge has volume from any angle.
  const X0 = -HALF_SPAN;
  const X1 = HALF_SPAN;
  const Z0 = -72;
  const Z1 = 72;
  // ---------------------------------------------------------------- terrain
  // A rectangular heightfield, matching the plinth style of the other models,
  // with the ridge height fading to zero at every edge so no vertical cut face
  // is ever visible. A thin earth skirt below y = 0 gives the terrain slab a
  // solid edge instead of letting it read as a floating sheet.
  for (let i = 0; i < NX; i += 1) {
    for (let j = 0; j < NZ; j += 1) {
      const xa = X0 + ((X1 - X0) * i) / NX;
      const xb = X0 + ((X1 - X0) * (i + 1)) / NX;
      const za = Z0 + ((Z1 - Z0) * j) / NZ;
      const zb = Z0 + ((Z1 - Z0) * (j + 1)) / NZ;
      // Edge falloff: the hill meets the valley floor well before the border.
      const edge = (x) => Math.max(0, Math.min(1, (HALF_SPAN - 34 - Math.abs(x)) / 26));
      const side = (z) => Math.max(0, Math.min(1, (72 - 18 - Math.abs(z)) / 22));
      const h = (x, z) => terrainAt(x, z) * edge(x) * side(z);
      const hA = h(xa, za);
      const hB = h(xb, za);
      const hC = h(xb, zb);
      const hD = h(xa, zb);
      const avg = (hA + hB + hC + hD) / 4;
      const t = avg / 34;
      const tone =
        t > 0.76 ? RIDGE_PALE : t > 0.48 ? RIDGE : t > 0.2 ? RIDGE_DARK : mix(ROCK, MOSS, 0.55);
      b.quadFacing(
        [xa, hD, zb],
        [xb, hC, zb],
        [xb, hB, za],
        [xa, hA, za],
        tone,
        [0, 1, 0],
      );
    }
  }
  // The terrain already reaches y = 0 at every edge, so the slab needs no
  // side skirt: it sits flush on the ground plane like the other models.

  // ---------------------------------------------------------------- the wall
  const SEGMENTS = 52;
  const WALL_H = 8.5;
  const WALL_W = 3.0;
  const BATTER = 2.2;
  const START = X0 + 18;
  const END = X1 - 18;
  for (let i = 0; i < SEGMENTS; i += 1) {
    const xa = START + ((END - START) * i) / SEGMENTS;
    const xb = START + ((END - START) * (i + 1)) / SEGMENTS;
    const xm = (xa + xb) / 2;
    const dir = pathDir(xm);
    const cz = (pathZ(xa) + pathZ(xb)) / 2;
    // Sink the wall's base into the terrain so no daylight shows underneath
    // on a slope.
    const yBase = crest(xm) - 2.6;
    const top = yBase + WALL_H;
    const len = Math.max((xb - xa) * 0.62, 1.2);

    // Battered body: a wide stone footing, then the brick wall proper.
    slab(b, xm, cz, dir, len, WALL_W + BATTER, yBase, yBase + WALL_H * 0.42, STONE);
    slab(b, xm, cz, dir, len, WALL_W, yBase + WALL_H * 0.42, top, BRICK_DARK);

    // Walkway paving, inset between the two parapets.
    slab(b, xm, cz, dir, len, WALL_W - 0.55, top - 0.25, top, PAVING);

    // Parapets with merlons on both edges.
    for (const side of [-1, 1]) {
      const px = -dir[2] * side;
      const pz = dir[0] * side;
      const off = WALL_W - 0.3;
      const pcx = xm + px * off;
      const pcz = cz + pz * off;
      slab(b, pcx, pcz, dir, len, 0.3, top, top + 0.9, BRICK);
      // Merlon teeth: taller blocks with a gap between each.
      for (let k = 0; k < 3; k += 1) {
        const t = ((k + 0.5) / 3 - 0.5) * 2 * len;
        slab(b, pcx + dir[0] * t, pcz + dir[2] * t, dir, len / 3 * 0.55, 0.3, top + 0.9, top + 1.7, BRICK_PALE);
      }
    }
  }

  // ------------------------------------------------------------ watchtowers
  // Square towers on the crest, each with a battered stone base, a brick
  // shaft, arched openings on all four faces, and a crenellated crown.
  for (const tx of [-95, -18, 62, 128]) {
    const dir = pathDir(tx);
    const tz = pathZ(tx);
    const base = crest(tx) - 3.0;
    const px = -dir[2];
    const pz = dir[0];

    // Stone base, wider than the shaft.
    slab(b, tx, tz, dir, 8.4, 6.9, base, base + 2.0, STONE_DARK);
    // Brick shaft.
    slab(b, tx, tz, dir, 7.4, 5.9, base + 2.0, base + 9.4, BRICK_DARK);
    // Crown course.
    slab(b, tx, tz, dir, 7.7, 6.2, base + 9.4, base + 10.3, BRICK);

    // Arched openings: a recessed dark panel on each of the four faces.
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
          [cxx - ax * halfW, y1 - halfW * 1.1, czz - az * halfW],
        ],
        mix(STONE_DARK, BRICK_DARK, 0.25),
        [nx, 0, nz],
      );
    };
    arch(0, 1, 1.7, base + 2.6, base + 6.6);
    arch(0, -1, 1.7, base + 2.6, base + 6.6);
    arch(1, 0, 1.5, base + 2.6, base + 6.4);
    arch(-1, 0, 1.5, base + 2.6, base + 6.4);

    // Crown merlons around the top platform.
    const topY = base + 10.3;
    for (const side of [-1, 1]) {
      for (let k = -2; k <= 2; k += 1) {
        const cx2 = tx + px * side * 5.9 + dir[0] * k * 2.4;
        const cz2 = tz + pz * side * 5.9 + dir[2] * k * 2.4;
        slab(b, cx2, cz2, dir, 0.75, 0.4, topY, topY + 1.5, BRICK_PALE);
      }
    }
    // A lookout deck inside the crown.
    slab(b, tx, tz, dir, 7.0, 5.6, topY - 0.35, topY, PAVING);
  }

  return b.tris;
}
