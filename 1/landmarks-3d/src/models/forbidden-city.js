/**
 * The Forbidden City, Beijing — Meridian Gate, the courtyard, and the Hall of
 * Supreme Harmony on its three-tier marble terrace.
 *
 * The real complex is 750 m wide with a 64 m hall, which at true scale reads as
 * a speck in a field. The plan is therefore compressed so the architecture
 * dominates the frame: the enclosure is ~240 m across while the hall stays at
 * its real 64 m, putting the palace at roughly a third of the compound width —
 * the proportion the eye expects from photographs of the axis.
 *
 * Chinese imperial architecture reads through four cues, all modelled
 * explicitly: vermilion walls and columns, a broad imperial-yellow hip roof
 * whose eaves flare upward at the corners, a white marble balustraded terrace,
 * and strict bilateral symmetry on the axis.
 */
import { createBuilder, hex, shade, mix } from '../geom-kit.js';

const VERMILION = hex('#a8322c');
const VERMILION_DARK = hex('#8a2822');
const VERMILION_LIGHT = hex('#bc443a');
const TILE = hex('#d9a92e');
const TILE_DARK = hex('#ba8d26');
const TILE_PALE = hex('#e9be49');
const MARBLE = hex('#e9e3d7');
const MARBLE_DARK = hex('#cfc7b9');
const PAVING = hex('#b6b1a7');
const PAVING_DARK = hex('#9e9990');
const LACQUER = hex('#c9a24a');
const INK = hex('#4a3a34');

/**
 * A Chinese imperial hip roof over a rectangular building.
 *
 * Four things make this silhouette read as Chinese rather than as a plain
 * pyramid, and all four are explicit here:
 *
 *   1. a deep overhanging eave, well past the wall line;
 *   2. a concave slope — the surface spreads fast at the eave and steepens
 *      towards the ridge, sampled as a smooth curve rather than one cone;
 *   3. a horizontal ridge line running the length of the building;
 *   4. upturned corner tips swept out and up from the four eave corners.
 *
 * The slope is sampled with `inset ∝ (1-t)^1.8` and `height ∝ t^1.4`, which
 * is what produces the characteristic sagging-then-rising profile. Tiles are
 * shaded in alternating courses so the layered courses read as glazed tile
 * rather than one flat sheet.
 */
function hipRoof(b, cx, cz, halfX, halfZ, y0, overhang, rise, colour, ridgeFrac = 0.42) {
  const ex = halfX + overhang;
  const ez = halfZ + overhang;
  const ridgeHalfX = Math.max(1.0, halfX * ridgeFrac);
  const ridgeHalfZ = Math.max(0.5, ez * 0.045);
  const ring = (hx, hz, y) => [
    [cx + hx, y, cz + hz],
    [cx - hx, y, cz + hz],
    [cx - hx, y, cz - hz],
    [cx + hx, y, cz - hz],
  ];

  const COURSES = 6;
  const rings = [];
  for (let i = 0; i <= COURSES; i += 1) {
    const t = i / COURSES;
    // Inset shrinks quickly at first (the wide flaring eave) and slowly near
    // the ridge; height rises slowly at first, then steeply. Together these
    // give the concave profile.
    const k = Math.pow(1 - t, 1.8);
    const hx = ridgeHalfX + (ex - ridgeHalfX) * k;
    const hz = ridgeHalfZ + (ez - ridgeHalfZ) * k;
    const y = y0 + rise * Math.pow(t, 1.4);
    rings.push(ring(hx, hz, y));
  }
  for (let i = 0; i < COURSES; i += 1) {
    const tone = shade(colour, i % 2 ? 1.0 : 1.06);
    b.loft(rings[i], rings[i + 1], tone, shade(colour, 0.84));
  }

  const ridgeY = y0 + rise;
  // Ridge cap along X, the roof's spine.
  b.box(
    cx - ridgeHalfX, ridgeY - 0.1, cz - ridgeHalfZ - 0.5,
    cx + ridgeHalfX, ridgeY + 0.7, cz + ridgeHalfZ + 0.5,
    shade(colour, 1.14),
  );
  // Ridge-end ornaments, small blocks at both ends of the ridge.
  for (const sx of [-1, 1]) {
    b.box(
      cx + sx * ridgeHalfX - 0.6, ridgeY, cz - 0.7,
      cx + sx * ridgeHalfX + 0.6, ridgeY + 1.5, cz + 0.7,
      shade(colour, 0.92),
    );
  }

  // Thin dark eave band: reads as the tile edge without becoming a brim.
  b.box(
    cx - ex - 0.35, y0 - 0.32, cz - ez - 0.35,
    cx + ex + 0.35, y0, cz + ez + 0.35,
    shade(colour, 0.7),
  );

  // Upturned corner tips. Each is a small folded quad rising from the eave
  // corner, which is the single most recognisable roof cue.
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    const corner = [cx + sx * ex, y0 + 0.05, cz + sz * ez];
    const tip = [cx + sx * (ex + 1.1), y0 + 1.35, cz + sz * (ez + 1.1)];
    const back = [cx + sx * (ex - 2.2), y0 + 0.05, cz + sz * (ez - 2.2)];
    b.polygonFan([corner, back, tip], shade(colour, 1.18), [sx, 1, sz]);
  }
  return ridgeY;
}

/** Vermilion hall body: wall mass, corner columns, front colonnade, belt band. */
function hallBody(b, cx, cz, halfX, halfZ, y0, h, cols = 7, colour = VERMILION) {
  b.box(cx - halfX, y0, cz - halfZ, cx + halfX, y0 + h, cz + halfZ, colour);
  // Corner columns, proud of the wall.
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    b.box(
      cx + sx * (halfX - 0.9) - 1.0, y0, cz + sz * (halfZ - 0.9) - 1.0,
      cx + sx * (halfX - 0.9) + 1.0, y0 + h, cz + sz * (halfZ - 0.9) + 1.0,
      shade(LACQUER, 0.88),
    );
  }
  // Front colonnade: columns standing slightly proud, with dark bays between.
  const n = Math.max(3, cols);
  for (let i = 0; i < n; i += 1) {
    const t = (i / (n - 1) - 0.5) * 2 * halfX * 0.92;
    b.box(cx + t - 0.7, y0, cz + halfZ - 0.4, cx + t + 0.7, y0 + h, cz + halfZ + 0.9, VERMILION_DARK);
  }
  // Dark door bays between the columns.
  for (let i = 0; i < n - 1; i += 1) {
    const t0 = ((-0.5 + i / (n - 1)) * 2 * halfX * 0.92) + 0.9;
    const t1 = ((-0.5 + (i + 1) / (n - 1)) * 2 * halfX * 0.92) - 0.9;
    if (t1 <= t0) continue;
    b.polygonFan(
      [
        [cx + t0, y0, cz + halfZ + 0.25],
        [cx + t1, y0, cz + halfZ + 0.25],
        [cx + t1, y0 + h * 0.82, cz + halfZ + 0.25],
        [cx + t0, y0 + h * 0.82, cz + halfZ + 0.25],
      ],
      mix(VERMILION_DARK, INK, 0.6),
      [0, 0, 1],
    );
  }
  // Vermilion belt band under the eaves.
  b.box(cx - halfX - 0.7, y0 + h - 1.5, cz - halfZ - 0.7, cx + halfX + 0.7, y0 + h, cz + halfZ + 0.7, VERMILION_LIGHT);
  return y0 + h;
}

/** White marble balustrade around a rectangle. */
function balustrade(b, cx, cz, halfX, halfZ, y, colour = MARBLE) {
  const step = 5.2;
  const nx = Math.max(2, Math.round((halfX * 2) / step));
  const nz = Math.max(2, Math.round((halfZ * 2) / step));
  const post = (x, z) => b.box(x - 0.32, y, z - 0.32, x + 0.32, y + 1.3, z + 0.32, colour);
  for (let i = 0; i <= nx; i += 1) {
    const x = cx - halfX + (2 * halfX * i) / nx;
    post(x, cz + halfZ);
    post(x, cz - halfZ);
  }
  for (let i = 0; i <= nz; i += 1) {
    const z = cz - halfZ + (2 * halfZ * i) / nz;
    post(cx + halfX, z);
    post(cx - halfX, z);
  }
  b.beam([cx - halfX, y + 1.24, cz + halfZ], [cx + halfX, y + 1.24, cz + halfZ], 0.4, 0.4, shade(colour, 1.05));
  b.beam([cx - halfX, y + 1.24, cz - halfZ], [cx + halfX, y + 1.24, cz - halfZ], 0.4, 0.4, shade(colour, 1.05));
  b.beam([cx - halfX, y + 1.24, cz - halfZ], [cx - halfX, y + 1.24, cz + halfZ], 0.4, 0.4, shade(colour, 1.05));
  b.beam([cx + halfX, y + 1.24, cz - halfZ], [cx + halfX, y + 1.24, cz + halfZ], 0.4, 0.4, shade(colour, 1.05));
}

export function build() {
  const b = createBuilder();

  // ------------------------------------------------------------------ ground
  // A paved court slightly larger than the enclosure, plus a darker inner
  // court. Both are sized from the wall after it is declared below.

  // ---------------------------------------------------------- enclosure wall
  // Compressed far below the real 750 m width: the compound must read as "a
  // palace in a walled court", not "a field with a shed". At 210 × 190 the
  // Hall of Supreme Harmony occupies about a third of the court's width, which
  // is the proportion the axis photographs convey.
  const WX = 105;
  const WZ = 95;
  const WH = 8.0;
  b.groundQuad(-WX - 17, -WZ - 17, WX + 17, WZ + 23, 0, PAVING);
  b.groundQuad(-WX - 8, -WZ - 8, WX + 8, WZ + 8, 0.04, PAVING_DARK);
  const wallSlab = (x0, z0, x1, z1) => {
    b.box(x0, 0, z0, x1, WH, z1, VERMILION);
    // Yellow tile coping, proud of the wall on both sides.
    b.box(x0 - 0.7, WH, z0 - 0.7, x1 + 0.7, WH + 0.85, z1 + 0.7, TILE);
    b.box(x0 - 1.0, WH - 0.6, z0 - 1.0, x1 + 1.0, WH, z1 + 1.0, TILE_DARK);
  };
  wallSlab(-WX, WZ - 3.5, WX, WZ);
  wallSlab(-WX, -WZ, WX, -WZ + 3.5);
  wallSlab(-WX, -WZ, -WX + 3.5, WZ);
  wallSlab(WX - 3.5, -WZ, WX, WZ);

  // Corner pavilions: small two-storey towers with yellow hip roofs.
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    const cx = sx * WX;
    const cz = sz * WZ;
    hallBody(b, cx, cz, 8.5, 8.5, WH, 5.5, 3, VERMILION_DARK);
    hipRoof(b, cx, cz, 8.5, 8.5, WH + 5.5, 2.4, 4.8, TILE, 0.4);
  }

  // -------------------------------------------------------- Meridian Gate
  // A broad U-shaped podium at the south entrance, crowned by five pavilions.
  const MG_Z = WZ - 3.5;
  const podiumY = 9.0;
  b.box(-46, 0, MG_Z - 17, 46, podiumY, MG_Z + 9, VERMILION_DARK);
  b.box(-48, 0, MG_Z - 18.5, 48, 1.8, MG_Z + 10.5, MARBLE_DARK);
  // Three arched passages on the south facade, as recessed dark panels.
  for (const [off, w, h] of [
    [0, 4.6, 6.0],
    [-16, 3.4, 4.8],
    [16, 3.4, 4.8],
  ]) {
    const z = MG_Z + 9.05;
    b.polygonFan(
      [
        [-off - w, 1.8, z],
        [off + w, 1.8, z],
        [off + w, 1.8 + h - w, z],
        [off, 1.8 + h, z],
        [-off - w, 1.8 + h - w, z],
      ],
      mix(VERMILION_DARK, INK, 0.72),
      [0, 0, 1],
    );
  }
  // The podium's cornice, then five phoenix towers.
  b.box(-47, podiumY, MG_Z - 18, 47, podiumY + 1.1, MG_Z + 10, TILE_DARK);
  hallBody(b, 0, MG_Z - 4, 18, 11.5, podiumY + 1.1, 7.0, 7);
  hipRoof(b, 0, MG_Z - 4, 18, 11.5, podiumY + 1.1 + 7.0, 3.4, 6.8, TILE, 0.4);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const cx = sx * 30;
      const cz = MG_Z - 4 + sz * 11.5;
      hallBody(b, cx, cz, 9.0, 5.0, podiumY + 1.1, 5.2, 3);
      hipRoof(b, cx, cz, 9.0, 5.0, podiumY + 1.1 + 5.2, 2.6, 4.8, TILE, 0.38);
    }
  }

  // --------------------------------------------------- axial processional path
  b.groundQuad(-9, MG_Z + 10, 9, -34, 0.07, MARBLE_DARK);
  b.groundQuad(-11.5, MG_Z + 10, -9, -34, 0.06, MARBLE);

  // ------------------------------------------------ three-tier marble terrace
  // The Taihedian terrace: three stacked white slabs, each inset, balustraded.
  const TER_Z = -52;
  for (const [hx, hz, y0, y1] of [
    [58, 34, 0, 2.8],
    [53, 29.5, 2.8, 5.6],
    [48, 25, 5.6, 8.4],
  ]) {
    b.box(-hx, y0, TER_Z - hz, hx, y1, TER_Z + hz, MARBLE);
    // Shadowed fillet at each tier's foot, so the tiers read separately.
    b.box(-hx - 0.4, y0, TER_Z - hz - 0.4, hx + 0.4, y0 + 0.6, TER_Z + hz + 0.4, MARBLE_DARK);
  }
  balustrade(b, 0, TER_Z, 58, 34, 2.8);
  balustrade(b, 0, TER_Z, 53, 29.5, 5.6);
  balustrade(b, 0, TER_Z, 48, 25, 8.4);
  // Grand stairways down the south face of the terrace.
  for (const sx of [-1, 1]) {
    for (let s = 0; s < 3; s += 1) {
      const y0 = s * 2.8;
      b.box(sx * 24 - 8, y0, TER_Z + 25 + s * 4.4, sx * 24 + 8, y0 + 2.8, TER_Z + 25 + s * 4.4 + 4.4, MARBLE);
    }
  }

  // ------------------------------------------------- Hall of Supreme Harmony
  const HALL_Y = 8.4;
  const HX = 32;
  const HZ = 17;
  hallBody(b, 0, TER_Z, HX, HZ, HALL_Y, 12.5, 9);
  // Lower (skirt) eave: broad and projecting.
  const skirtTop = hipRoof(b, 0, TER_Z, HX, HZ, HALL_Y + 12.5, 6.2, 4.6, TILE, 0.66);
  // Clerestory storey between the two roofs.
  b.box(-HX * 0.78, skirtTop - 0.5, TER_Z - HZ * 0.78, HX * 0.78, skirtTop + 2.4, TER_Z + HZ * 0.78, VERMILION_DARK);
  // Upper roof: steeper and taller — the main imperial roof.
  const ridgeTop = hipRoof(b, 0, TER_Z, HX * 0.8, HZ * 0.8, skirtTop + 2.4, 3.6, 8.2, TILE, 0.4);
  // Gilded ridge-end ornaments.
  for (const sx of [-1, 1]) {
    b.box(sx * 7.5 - 0.8, ridgeTop, TER_Z - 0.8, sx * 7.5 + 0.8, ridgeTop + 2.0, TER_Z + 0.8, LACQUER);
  }
  // Gilt bronze animals flanking the front stair.
  for (const sx of [-1, 1]) {
    b.box(sx * 16 - 2.2, HALL_Y, TER_Z + HZ + 2.6, sx * 16 + 2.2, HALL_Y + 2.8, TER_Z + HZ + 6.4, LACQUER);
  }

  // -------------------------------------- flanking halls and rear gate
  // Compact side halls, mirroring the axis.
  for (const sx of [-1, 1]) {
    const cx = sx * 92;
    const cz = TER_Z + 2;
    hallBody(b, cx, cz, 15, 11, 0.1, 8.0, 5, VERMILION_DARK);
    hipRoof(b, cx, cz, 15, 11, 8.1, 3.2, 5.4, TILE, 0.42);
  }
  // North gate building on the rear wall.
  const NG_Z = -WZ + 3.5;
  b.box(-26, 0, NG_Z - 11, 26, 8.4, NG_Z + 11, VERMILION_DARK);
  b.box(-28, 0, NG_Z - 12.5, 28, 1.6, NG_Z + 12.5, MARBLE_DARK);
  hallBody(b, 0, NG_Z, 21, 9, 8.4, 5.8, 5);
  hipRoof(b, 0, NG_Z, 21, 9, 14.2, 2.8, 5.2, TILE, 0.42);

  // ------------------------------------------------------------- ground trim
  // A darker walk hugging the wall footings, so the compound sits on the paving.
  for (const [x0, z0, x1, z1] of [
    [-WX - 2.5, WZ - 6, WX + 2.5, WZ + 2.5],
    [-WX - 2.5, -WZ - 2.5, WX + 2.5, -WZ + 6],
    [-WX - 2.5, -WZ, -WX + 6, WZ],
    [WX - 6, -WZ, WX + 2.5, WZ],
  ]) {
    b.groundQuad(x0, z0, x1, z1, 0.09, PAVING_DARK);
  }

  return b.tris;
}
