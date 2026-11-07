/**
 * The Taj Mahal, Agra — white marble mausoleum on a raised plinth.
 *
 * Symmetry about the x = 0 axis is the entire design, so every element is
 * built either once on the axis or mirrored in pairs. The recognition cues
 * are: the bulging onion dome with its finial, the four chhatris at the
 * plinth corners, the great iwan arch, the four tall minarets, and the
 * reflecting pool running out from the main gate.
 */
import { createBuilder, hex, shade, mix } from '../geom-kit.js';

const MARBLE = hex('#f2ede2');
const MARBLE_MID = hex('#e6dfd1');
const MARBLE_SHADE = hex('#d3ccbe');
const INLAY = hex('#b9b3a6');
const SANDSTONE = hex('#9d5b45');
const SANDSTONE_DARK = hex('#874f3b');
const WATER = hex('#4f7c74');
const WATER_PALE = hex('#6b9990');
const GILT = hex('#c3a05c');
const GARDEN = hex('#8c9a6c');

/** An octagonal or n-gon ring at height y, radius r, rotated by phase. */
function ngon(cx, cz, y, r, n, phase = Math.PI / 8) {
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const a = phase + (i / n) * Math.PI * 2;
    out[i] = [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r];
  }
  return out;
}

/** A lofted regular prism from one ring to another (both same `n`). */
function stack(b, cx, cz, y0, y1, r0, r1, n, colour, capColour) {
  b.loft(ngon(cx, cz, y0, r0, n), ngon(cx, cz, y1, r1, n), colour, capColour);
}

/**
 * The onion dome profile: a sequence of radii from the drum upward, bulging
 * past the drum radius then contracting to the finial neck. Values are
 * fractions of the dome's base radius; heights are fractions of its height.
 */
const DOME_PROFILE = [
  [0.0, 1.02],
  [0.1, 1.16],
  [0.22, 1.21],
  [0.35, 1.18],
  [0.5, 1.06],
  [0.64, 0.86],
  [0.76, 0.62],
  [0.86, 0.38],
  [0.94, 0.18],
  [1.0, 0.06],
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
  // A gilded band at the dome's shoulder, as the real building has.
  const bandY = y0 + height * 0.1;
  b.loft(
    ngon(cx, cz, bandY - 0.5, radius * 1.16, N),
    ngon(cx, cz, bandY + 0.5, radius * 1.2, N),
    GILT,
    GILT,
  );
  return y0 + height;
}

/** A chhatri: a small domed kiosk on pillars. */
function chhatri(b, cx, cz, y0, scale = 1) {
  const R = 3.4 * scale;
  const colH = 5.0 * scale;
  // Plinth
  b.loft(ngon(cx, cz, y0, R * 1.35, 8), ngon(cx, cz, y0 + 0.8 * scale, R * 1.3, 8), MARBLE_SHADE, MARBLE);
  // Eight slender columns.
  for (let i = 0; i < 8; i += 1) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const px = cx + Math.cos(a) * R;
    const pz = cz + Math.sin(a) * R;
    b.box(px - 0.42 * scale, y0 + 0.8 * scale, pz - 0.42 * scale, px + 0.42 * scale, y0 + 0.8 * scale + colH, pz + 0.42 * scale, MARBLE_MID);
  }
  // Entablature ring.
  const top = y0 + 0.8 * scale + colH;
  b.loft(ngon(cx, cz, top, R * 1.12, 8), ngon(cx, cz, top + 1.0 * scale, R * 1.05, 8), MARBLE, MARBLE_SHADE);
  // Small onion dome on top.
  onionDome(b, cx, cz, top + 1.0 * scale, 4.6 * scale, 2.5 * scale, MARBLE);
  // Finial
  b.cylinder(cx, cz, top + 1.0 * scale + 4.6 * scale, top + 1.0 * scale + 6.2 * scale, 0.32 * scale, 0.08 * scale, 6, GILT);
}

/** A minaret: octagonal shaft with two balconies and a chhatri cap. */
function minaret(b, cx, cz, y0, totalH) {
  const R = 2.6;
  b.loft(ngon(cx, cz, y0, R * 1.5, 8), ngon(cx, cz, y0 + 2.4, R * 1.3, 8), MARBLE_SHADE, MARBLE);
  // Shaft, slightly tapering.
  stack(b, cx, cz, y0 + 2.4, y0 + totalH * 0.42, R, R * 0.9, 8, MARBLE_MID);
  // Balcony 1
  b.loft(ngon(cx, cz, y0 + totalH * 0.42, R * 1.5, 8), ngon(cx, cz, y0 + totalH * 0.42 + 0.7, R * 1.45, 8), MARBLE, MARBLE_SHADE);
  stack(b, cx, cz, y0 + totalH * 0.42 + 0.7, y0 + totalH * 0.72, R * 0.86, R * 0.76, 8, MARBLE_MID);
  // Balcony 2
  b.loft(ngon(cx, cz, y0 + totalH * 0.72, R * 1.32, 8), ngon(cx, cz, y0 + totalH * 0.72 + 0.6, R * 1.28, 8), MARBLE, MARBLE_SHADE);
  stack(b, cx, cz, y0 + totalH * 0.72 + 0.6, y0 + totalH * 0.92, R * 0.72, R * 0.64, 8, MARBLE_MID);
  // Capital and a small domed cap.
  b.loft(ngon(cx, cz, y0 + totalH * 0.92, R * 0.95, 8), ngon(cx, cz, y0 + totalH * 0.92 + 0.8, R * 0.88, 8), MARBLE, MARBLE);
  onionDome(b, cx, cz, y0 + totalH * 0.92 + 0.8, totalH * 0.12, R * 0.78, MARBLE);
}

export function build() {
  const b = createBuilder();

  // ---------------------------------------------------------------- garden
  b.groundQuad(-92, -70, 92, 128, 0, GARDEN);

  // ---------------------------------------------------------- mausoleum plinth
  // The raised marble plinth: ~95 m square, with a modest step course.
  const PL = 47;
  const PLZ = 0;
  const PL_Y = 4.4;
  b.box(-PL - 2, 0, PLZ - PL - 2, PL + 2, 1.0, PLZ + PL + 2, MARBLE_SHADE);
  b.box(-PL, 1.0, PLZ - PL, PL, PL_Y, PLZ + PL, MARBLE);
  // Plinth edge trim, darker at the top lip.
  b.box(-PL - 0.5, PL_Y - 0.5, PLZ - PL - 0.5, PL + 0.5, PL_Y, PLZ + PL + 0.5, MARBLE_SHADE);

  // Plinth balustrade on all four sides, interrupted at the pool side.
  const railSeg = 8;
  for (let i = 0; i < railSeg; i += 1) {
    for (const side of [0, 1, 2, 3]) {
      // skip the south-centre bays where the pool walk enters
      if (side === 0 && (i === 3 || i === 4)) continue;
      const t0 = (i / railSeg - 0.5) * 2 * PL;
      const t1 = ((i + 1) / railSeg - 0.5) * 2 * PL;
      const mid = (t0 + t1) / 2;
      const len = Math.abs(t1 - t0);
      // Side 0 = +Z (south), 1 = +X, 2 = -Z, 3 = -X
      if (side === 0) b.beam([mid, PL_Y + 0.9, PLZ + PL], [mid + len, PL_Y + 0.9, PLZ + PL], 0.4, 0.4, MARBLE_MID);
      if (side === 2) b.beam([mid, PL_Y + 0.9, PLZ - PL], [mid + len, PL_Y + 0.9, PLZ - PL], 0.4, 0.4, MARBLE_MID);
      if (side === 1) b.beam([PL, PL_Y + 0.9, mid], [PL, PL_Y + 0.9, mid + len], 0.4, 0.4, MARBLE_MID);
      if (side === 3) b.beam([-PL, PL_Y + 0.9, mid], [-PL, PL_Y + 0.9, mid + len], 0.4, 0.4, MARBLE_MID);
    }
  }

  // ----------------------------------------------------------- main building
  // The mausoleum block: a square base with chamfered (octagon-ish) corners,
  // a tall central iwan, smaller arches to each side, and a heavy cornice.
  const MZ = PLZ;
  const HALF = 26;
  const BASE_H = 18;
  b.loft(
    ngon(0, MZ, PL_Y, HALF * 1.06, 8, Math.PI / 8),
    ngon(0, MZ, PL_Y + 1.6, HALF * 1.04, 8, Math.PI / 8),
    MARBLE_SHADE,
    MARBLE,
  );
  // Main block, square with the corners clipped by extra chamfer panels.
  b.box(-HALF, PL_Y + 1.6, MZ - HALF, HALF, PL_Y + 1.6 + BASE_H, MZ + HALF, MARBLE);
  // Four chamfered corner panels, giving the plan its octagonal reading.
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
        [px - dx * w, PL_Y + 1.6 + BASE_H, pz - dz * w],
      ],
      shade(MARBLE, 0.97),
      [nx, 0, nz],
    );
  }

  // The four grand iwans: a recessed pointed arch with a pishtaq frame.
  const iwan = (facing, centreT, halfWidth, archTop, baseY) => {
    const nx = facing[0];
    const nz = facing[2];
    const px = -nz;
    const pz = nx;
    const off = HALF + 0.15;
    const c = [centreT[0] + nx * off, 0, centreT[1] + nz * off];
    // Pishtaq: a tall rectangular frame, proud of the wall.
    b.polygonFan(
      [
        [c[0] - px * halfWidth, baseY, c[2] - pz * halfWidth],
        [c[0] + px * halfWidth, baseY, c[2] + pz * halfWidth],
        [c[0] + px * halfWidth, archTop, c[2] + pz * halfWidth],
        [c[0] - px * halfWidth, archTop, c[2] - pz * halfWidth],
      ],
      MARBLE_MID,
      [nx, 0, nz],
    );
    // The dark recessed arch inside the frame: a pointed (two-centred) arch.
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
        [c[0] - px * w, spring, c[2] - pz * w],
      ],
      mix(MARBLE_SHADE, INLAY, 0.42),
      [nx, 0, nz],
    );
    // A thin inlay border just inside the frame.
    b.polygonFan(
      [
        [c[0] - px * (w + 0.55), baseY, c[2] - pz * (w + 0.55)],
        [c[0] + px * (w + 0.55), baseY, c[2] + pz * (w + 0.55)],
        [c[0] + px * (w + 0.55), spring, c[2] + pz * (w + 0.55)],
        [c[0] - px * (w + 0.55), spring, c[2] - pz * (w + 0.55)],
      ],
      INLAY,
      [nx, 0, nz],
    );
  };
  iwan([0, 0, 1], [0, MZ], 7.6, PL_Y + 17.4, PL_Y + 2.4);
  iwan([0, 0, -1], [0, MZ], 7.6, PL_Y + 17.4, PL_Y + 2.4);
  iwan([1, 0, 0], [MZ, 0], 7.6, PL_Y + 17.4, PL_Y + 2.4);
  iwan([-1, 0, 0], [MZ, 0], 7.6, PL_Y + 17.4, PL_Y + 2.4);

  // Two smaller side arches on the south face, flanking the great iwan.
  for (const sx of [-1, 1]) {
    const cx = sx * 16.5;
    const z = MZ + HALF + 0.1;
    b.polygonFan(
      [
        [cx - 2.6, PL_Y + 2.4, z],
        [cx + 2.6, PL_Y + 2.4, z],
        [cx + 2.6, PL_Y + 8.2, z],
        [cx, PL_Y + 10.4, z],
        [cx - 2.6, PL_Y + 8.2, z],
      ],
      mix(MARBLE_SHADE, INLAY, 0.3),
      [0, 0, 1],
    );
    b.polygonFan(
      [
        [cx - 3.4, PL_Y + 2.4, z + 0.12],
        [cx + 3.4, PL_Y + 2.4, z + 0.12],
        [cx + 3.4, PL_Y + 9.0, z + 0.12],
        [cx, PL_Y + 11.4, z + 0.12],
        [cx - 3.4, PL_Y + 9.0, z + 0.12],
      ],
      MARBLE_MID,
      [0, 0, 1],
    );
  }

  // Cornice: a broad band stepping out under the dome drum.
  const corniceY = PL_Y + 1.6 + BASE_H;
  b.box(-HALF - 1.4, corniceY, MZ - HALF - 1.4, HALF + 1.4, corniceY + 1.5, MZ + HALF + 1.4, MARBLE_MID);
  b.box(-HALF - 2.0, corniceY + 1.5, MZ - HALF - 2.0, HALF + 2.0, corniceY + 2.3, MZ + HALF + 2.0, MARBLE);

  // ------------------------------------------------------------- dome and drum
  // The drum the dome sits on, with a row of arched niches hinted by inlay.
  const drumY = corniceY + 2.3;
  const drumH = 6.4;
  stack(b, 0, MZ, drumY, drumY + drumH, 17.2, 17.0, 24, MARBLE_MID);
  // Narrow inlay banding on the drum.
  b.loft(
    ngon(0, MZ, drumY + drumH - 0.9, 17.3, 24),
    ngon(0, MZ, drumY + drumH, 17.1, 24),
    INLAY,
    INLAY,
  );
  // Dome base ring.
  b.loft(
    ngon(0, MZ, drumY + drumH, 18.2, 24),
    ngon(0, MZ, drumY + drumH + 1.2, 18.0, 24),
    MARBLE,
    MARBLE_MID,
  );

  const domeBase = drumY + drumH + 1.2;
  const domeH = 22.5;
  const domeR = 17.6;
  onionDome(b, 0, MZ, domeBase, domeH, domeR, MARBLE);
  const domeApex = domeBase + domeH;
  // Finial: a stack of gilt discs and a spire.
  b.cylinder(0, MZ, domeApex - 0.2, domeApex + 2.0, 1.4, 0.9, 12, GILT);
  b.cylinder(0, MZ, domeApex + 2.0, domeApex + 3.4, 0.9, 0.55, 10, GILT);
  b.cylinder(0, MZ, domeApex + 3.4, domeApex + 6.4, 0.5, 0.18, 8, GILT);
  // Crescent tip.
  b.cylinder(0, MZ, domeApex + 6.4, domeApex + 8.6, 0.18, 0.02, 6, GILT);

  // ------------------------------------------------------------- chhatris
  // Four chhatris ringing the dome, on the cornice-level roof.
  const chY = corniceY + 2.3;
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    chhatri(b, sx * (HALF - 3.5), MZ + sz * (HALF - 3.5), chY, 1.25);
  }

  // -------------------------------------------------------------- minarets
  // Four octagonal minarets at the plinth corners, taller than the plinth.
  for (const [sx, sz] of [
    [1, 1],
    [-1, 1],
    [-1, -1],
    [1, -1],
  ]) {
    minaret(b, sx * (PL - 3.4), MZ + sz * (PL - 3.4), 0, 41);
  }

  // --------------------------------------------------------------- the pool
  // A long reflecting pool running south from the plinth, bordered in marble
  // and flanked by two red sandstone buildings.
  const POOL_Z0 = PLZ + PL + 8;
  const POOL_Z1 = 116;
  const POOL_HW = 6.5;
  // Marble kerb
  b.box(-POOL_HW - 1.6, 0, POOL_Z0, POOL_HW + 1.6, 0.85, POOL_Z1, MARBLE_MID);
  // Water inset, a touch below the kerb.
  b.groundQuad(-POOL_HW, POOL_Z0 + 1.2, POOL_HW, POOL_Z1 - 1.2, 0.55, WATER);
  // Lighter ripple band down the pool's centre.
  b.groundQuad(-2.2, POOL_Z0 + 3, 2.2, POOL_Z1 - 3, 0.58, WATER_PALE);
  // Walkways either side of the pool.
  for (const sx of [-1, 1]) {
    b.groundQuad(sx * (POOL_HW + 1.6), POOL_Z0, sx * (POOL_HW + 15), POOL_Z1, 0.2, MARBLE_SHADE);
  }
  // A marble fountain platform at the pool's head.
  b.loft(
    ngon(0, POOL_Z0 + 3.0, 0.3, POOL_HW * 1.15, 12),
    ngon(0, POOL_Z0 + 3.0, 1.1, POOL_HW * 1.1, 12),
    MARBLE,
    MARBLE_SHADE,
  );

  // Two flanking red sandstone buildings (the mosque and the javab).
  for (const sx of [-1, 1]) {
    const cx = sx * 44;
    const cz = POOL_Z0 + 34;
    b.box(cx - 14, 0, cz - 12, cx + 14, 9.5, cz + 12, SANDSTONE);
    b.box(cx - 15, 9.5, cz - 13, cx + 15, 10.6, cz + 13, SANDSTONE_DARK);
    // Three small domes on each, in marble-white.
    for (const ox of [-8, 0, 8]) {
      onionDome(b, cx + ox, cz, 10.6, 5.2, 3.6, MARBLE_MID);
    }
    // A darker arch band across the facade.
    b.polygonFan(
      [
        [cx - 12, 0.1, cz + 12.12],
        [cx + 12, 0.1, cz + 12.12],
        [cx + 12, 6.2, cz + 12.12],
        [cx - 12, 6.2, cz + 12.12],
      ],
      mix(SANDSTONE_DARK, INLAY, 0.25),
      [0, 0, 1],
    );
  }

  // ----------------------------------------------------------------- gate
  // A simplified red sandstone gateway closing the far end of the pool.
  const GC = POOL_Z1 + 8;
  b.box(-22, 0, GC - 4, 22, 13, GC + 4, SANDSTONE);
  b.box(-24, 13, GC - 6, 24, 14.2, GC + 6, SANDSTONE_DARK);
  b.polygonFan(
    [
      [-7, 0.1, GC + 4.12],
      [7, 0.1, GC + 4.12],
      [7, 9.0, GC + 4.12],
      [0, 11.6, GC + 4.12],
      [-7, 9.0, GC + 4.12],
    ],
    mix(SANDSTONE_DARK, INLAY, 0.18),
    [0, 0, 1],
  );
  for (const sx of [-1, 1]) {
    onionDome(b, sx * 15, GC, 14.2, 4.4, 3.0, MARBLE_MID);
  }

  return b.tris;
}
