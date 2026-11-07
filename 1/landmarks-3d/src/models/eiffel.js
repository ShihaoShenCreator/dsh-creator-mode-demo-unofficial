/**
 * Eiffel Tower, Paris — wrought-iron lattice tower, 1889.
 *
 * Proportions follow the real stack: a 125 m square base of four splayed
 * legs, first platform at 57 m, second at 115 m, third at 196 m, campanile
 * to 276 m, antenna to 330 m.
 *
 * The silhouette is one continuous body: the legs merge into a tapering
 * square shaft at the first platform and never break. Recognition cues are
 * the four arched legs, the platform bands, the steady concave taper and
 * the lattice texture.
 */
import { createBuilder, hex, shade, mix } from '../geom-kit.js';

const IRON = hex('#4b443a');
const IRON_LIGHT = hex('#6a6052');
const IRON_DARK = hex('#37322b');
const IRON_WARM = hex('#7b6b55');
const STONE = hex('#b6aa93');
const STONE_DARK = hex('#97896f');
const GROUND = hex('#8f8b7e');
const GILT = hex('#c9a95d');

/**
 * Half-width of the shaft at height y, fitted to the real tower's published
 * dimensions: 35 m at the first platform (57 m), 20 m at the second (115 m),
 * 12 m at the third (196 m) and ~5 m at the top of the shaft (276 m).
 *
 * An exponential decay fits those four points far better than a power curve,
 * which is what gives the tower its characteristically fast narrowing low
 * down followed by a long slender run to the top.
 */
function halfAt(y) {
  const t = Math.max(0, Math.min(1, (y - 57) / (276 - 57)));
  // 35 → 5 m across the shaft, with a little residual width at the top.
  const k = Math.exp(-3 * t);
  return 5 + 30 * (k - Math.exp(-3)) / (1 - Math.exp(-3));
}

/**
 * Four outward-facing side quads of a square frustum whose centre and
 * half-width change from bottom to top. Corner order is CCW seen from above,
 * so (lo[i], hi[i], hi[j], lo[j]) faces outward.
 */
function frustum(b, y0, y1, h0, h1, cx0, cz0, cx1, cz1, tones) {
  const ring = (cx, cz, h, y) => [
    [cx + h, y, cz + h],
    [cx - h, y, cz + h],
    [cx - h, y, cz - h],
    [cx + h, y, cz - h],
  ];
  const lo = ring(cx0, cz0, h0, y0);
  const hi = ring(cx1, cz1, h1, y1);
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    b.quad(lo[i], hi[i], hi[j], lo[j], tones[i % tones.length]);
  }
}

/** Lattice panel: an X plus edge posts on one face of a frustum band. */
function latticeFace(b, face, y0, y1, h0, h1, cx0, cz0, cx1, cz1, scale = 1) {
  const ang = face * Math.PI * 0.5;
  const nx = Math.sin(ang);
  const nz = Math.cos(ang);
  const tx = Math.cos(ang);
  const tz = -Math.sin(ang);
  const P = (u, y, h, cx, cz) => [cx + nx * h + tx * u, y, cz + nz * h + tz * u];
  const w = h0 * 0.94 * scale;
  // Two crossing diagonals, the visible ironwork of a lattice girder.
  b.beam(P(-w, y0, h0, cx0, cz0), P(w, y1, h1, cx1, cz1), 0.85, 0.85, IRON_DARK);
  b.beam(P(w, y0, h0, cx0, cz0), P(-w, y1, h1, cx1, cz1), 0.85, 0.85, IRON_DARK);
  // Edge posts, slightly proud, so each face reads as framed ironwork.
  b.beam(P(-w, y0, h0, cx0, cz0), P(-w, y1, h1, cx1, cz1), 1.15, 1.15, shade(IRON_WARM, 1.06));
  b.beam(P(w, y0, h0, cx0, cz0), P(w, y1, h1, cx1, cz1), 1.15, 1.15, shade(IRON_WARM, 1.06));
  // Horizontal tie through the middle of the band.
  const ym = (y0 + y1) / 2;
  const hm = (h0 + h1) / 2;
  b.beam(P(-w, ym, hm, (cx0 + cx1) / 2, (cz0 + cz1) / 2), P(w, ym, hm, (cx0 + cx1) / 2, (cz0 + cz1) / 2), 0.6, 0.6, shade(IRON_WARM, 0.95));
}

/** A square platform slab with a proud corbelled lip. */
function platform(b, y, half, thick, tone) {
  b.box(-half, y, -half, half, y + thick, half, tone);
  b.box(-half - 1.3, y + thick, -half - 1.3, half + 1.3, y + thick + 0.75, half + 1.3, shade(tone, 1.12));
  // Underside corbel band, darker, so the deck reads as a solid floor.
  b.box(-half - 0.6, y - 0.7, -half - 0.6, half + 0.6, y, half + 0.6, shade(tone, 0.82));
}

const LEGS = [
  [1, 1],
  [1, -1],
  [-1, 1],
  [-1, -1],
];

export function build() {
  const b = createBuilder();

  // ---------------------------------------------------------------- ground
  b.groundQuad(-86, -86, 86, 86, 0, GROUND);
  b.groundQuad(-44, -44, 44, 44, 0.02, shade(GROUND, 0.88));

  // ------------------------------------------------------- stone footings
  for (const [sx, sz] of LEGS) {
    const cx = sx * 44;
    const cz = sz * 44;
    b.box(cx - 14.5, 0, cz - 14.5, cx + 14.5, 1.6, cz + 14.5, STONE_DARK);
    b.box(cx - 13, 1.6, cz - 13, cx + 13, 3.4, cz + 13, STONE);
    b.box(cx - 12, 3.4, cz - 12, cx + 12, 4.1, cz + 12, shade(STONE, 1.05));
  }

  // ------------------------------------------------------------ four legs
  // From the footing up to where the legs meet the first platform. Each leg
  // is a frustum whose centre moves inward and whose section shrinks, so the
  // four legs visibly converge.
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
        shade(IRON, 0.86),
      ]);
      // Lattice on the outer faces of this band.
      latticeFace(b, 0, y0, y1, h0, h1, cx0, cz0, cx1, cz1);
      latticeFace(b, 1, y0, y1, h0, h1, cx0, cz0, cx1, cz1);
      latticeFace(b, 2, y0, y1, h0, h1, cx0, cz0, cx1, cz1);
      latticeFace(b, 3, y0, y1, h0, h1, cx0, cz0, cx1, cz1);
      // Segment belt, so the taper reads as stacked iron courses.
      if (i > 0) {
        b.box(cx0 - h0 - 0.4, y0 - 0.5, cz0 - h0 - 0.4, cx0 + h0 + 0.4, y0, cz0 + h0 + 0.4, shade(IRON_WARM, 1.02));
      }
    }
  }

  // ------------------------------------------------ ornamental base arches
  // One great arch on each of the four faces, spanning between adjacent legs.
  // A semicircular voussoir band with a spandrel filling above it.
  const ARCH_R = 25.5;
  const ARCH_BASE = 5.0;
  const ARCH_SEG = 16;
  for (let f = 0; f < 4; f += 1) {
    const ang = f * Math.PI * 0.5;
    const nx = Math.sin(ang);
    const nz = Math.cos(ang);
    const tx = Math.cos(ang);
    const tz = -Math.sin(ang);
    // The arch plane sits on the face, slightly inside the legs' outer edge.
    const off = 30.5;
    for (let i = 0; i < ARCH_SEG; i += 1) {
      const a0 = (Math.PI * i) / ARCH_SEG;
      const a1 = (Math.PI * (i + 1)) / ARCH_SEG;
      const R = ARCH_R;
      const point = (a, r) => [
        nx * off + tx * (Math.cos(a) * r),
        ARCH_BASE + Math.sin(a) * R,
        nz * off + tz * (Math.cos(a) * r),
      ];
      const inner = point(a0, R - 6.4);
      const innerNext = point(a1, R - 6.4);
      const outer = point(a0, R);
      const outerNext = point(a1, R);
      b.quad(inner, outer, outerNext, innerNext, IRON_WARM);
      // Spandrel: fill from the arch up to the springing line, on each side.
      if (i === 0 || i === ARCH_SEG - 1) {
        const base = [nx * off + tx * (Math.cos(a0) * R * (i ? 1 : -1)), ARCH_BASE, nz * off + tz * (Math.cos(a0) * R * (i ? 1 : -1))];
        b.beam(outer, [base[0], ARCH_BASE + 0.2, base[2]], 1.2, 1.2, IRON_DARK);
      }
    }
  }

  // ------------------------------------------------------------ platforms
  platform(b, 56.2, 32.5, 3.0, shade(IRON, 1.10));
  // A band of pilasters around the first platform, hinting at the arcade.
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
  // The frieze band above the first platform: a square perimeter, gold accents.
  for (let f = 0; f < 4; f += 1) {
    const ang = f * Math.PI * 0.5;
    const nx = Math.sin(ang);
    const nz = Math.cos(ang);
    const tx = Math.cos(ang);
    const tz = -Math.sin(ang);
    for (let k = 0; k < 12; k += 1) {
      const u0 = -33 + (66 * k) / 12;
      const u1 = -33 + (66 * (k + 1)) / 12;
      const p0 = [nx * 32.4 + tx * u0, 65.6, nz * 32.4 + tz * u0];
      const p1 = [nx * 32.4 + tx * u1, 65.6, nz * 32.4 + tz * u1];
      b.quad(p0, p1, [p1[0], 66.9, p1[2]], [p0[0], 66.9, p0[2]], k % 2 ? IRON_WARM : GILT);
    }
  }

  // -------------------------------------------------------------- shaft
  // One continuous tapering body from the first platform to the campanile.
  // The taper is the tower's most recognisable trait, so it is sampled
  // densely and braced on every face.
  const SHAFT_BOTTOM = 59.0;
  const SHAFT_TOP = 276.0;
  const SHAFT_SEG = 26;
  for (let i = 0; i < SHAFT_SEG; i += 1) {
    const y0 = SHAFT_BOTTOM + ((SHAFT_TOP - SHAFT_BOTTOM) * i) / SHAFT_SEG;
    const y1 = SHAFT_BOTTOM + ((SHAFT_TOP - SHAFT_BOTTOM) * (i + 1)) / SHAFT_SEG;
    const h0 = halfAt(Math.max(y0, 59.0));
    const h1 = halfAt(y1);
    frustum(b, y0, y1, h0, h1, 0, 0, 0, 0, [
      shade(IRON, 1.07),
      shade(IRON, 0.90),
      shade(IRON, 0.97),
      shade(IRON, 0.84),
    ]);
    for (let f = 0; f < 4; f += 1) {
      latticeFace(b, f, y0, y1, h0, h1, 0, 0, 0, 0);
    }
    // Horizontal lattice band at every third course.
    if (i % 3 === 0) {
      b.box(-h1 - 0.5, y1 - 0.55, -h1 - 0.5, h1 + 0.5, y1, h1 + 0.5, shade(IRON_WARM, 1.05));
    }
  }

  // Second and third platforms.
  platform(b, 112.5, 18.0, 2.4, shade(IRON, 1.06));
  platform(b, 193.0, 9.8, 2.0, shade(IRON, 1.0));
  // Balustrade rings around both decks.
  for (const [deckY, r, posts] of [
    [116.0, 18.4, 28],
    [196.5, 10.2, 20],
  ]) {
    for (let i = 0; i < posts; i += 1) {
      const a = (i / posts) * Math.PI * 2;
      const px = Math.cos(a) * r;
      const pz = Math.sin(a) * r;
      b.box(px - 0.24, deckY, pz - 0.24, px + 0.24, deckY + 2.1, pz + 0.24, shade(IRON, 1.18));
    }
    for (let i = 0; i < posts; i += 1) {
      const a0 = (i / posts) * Math.PI * 2;
      const a1 = ((i + 1) / posts) * Math.PI * 2;
      b.beam(
        [Math.cos(a0) * r, deckY + 2.05, Math.sin(a0) * r],
        [Math.cos(a1) * r, deckY + 2.05, Math.sin(a1) * r],
        0.35, 0.35, shade(IRON, 1.22),
      );
    }
  }

  // ------------------------------------------------ campanile and finial
  // The top cabin, a squat block with a lantern band, then the mast.
  b.box(-9.6, 276, -9.6, 9.6, 279.4, 9.6, shade(IRON, 1.12));
  b.box(-7.4, 279.4, -7.4, 7.4, 284.6, 7.4, shade(IRON, 0.96));
  // Warm lantern glazing, the one gold note near the top.
  b.box(-7.7, 281.0, -7.7, 7.7, 283.1, 7.7, shade(GILT, 0.94));
  b.box(-5.7, 284.6, -5.7, 5.7, 290.4, 5.7, shade(IRON, 1.06));
  b.box(-6.0, 286.0, -6.0, 6.0, 287.6, 6.0, shade(GILT, 0.9));
  b.cylinder(0, 0, 290.4, 302.0, 2.7, 1.7, 16, shade(IRON, 0.98));
  b.cylinder(0, 0, 302.0, 314.0, 1.5, 0.55, 12, shade(IRON, 1.04));
  b.cylinder(0, 0, 314.0, 320.5, 0.5, 0.24, 10, GILT);
  b.cylinder(0, 0, 320.5, 330.0, 0.24, 0.0, 8, GILT);

  // ---------------------------------------------- leg-to-shaft transition
  // A short collar that visually joins the four leg tops to the square shaft,
  // closing the gap that would otherwise make the tower read as two pieces.
  b.box(-33.0, 54.8, -33.0, 33.0, 59.4, 33.0, shade(IRON, 0.94));
  b.box(-33.6, 58.6, -33.6, 33.6, 60.2, 33.6, shade(IRON_WARM, 1.02));
  // Four diagonal braces from the leg centres into the shaft base.
  for (const [sx, sz] of LEGS) {
    b.beam([sx * 27, 54.9, sz * 27], [sx * 20, 74, sz * 20], 1.3, 1.3, shade(IRON_DARK, 1.1));
  }

  // ------------------------------------------------- under-deck structure
  // A few visible girders under the first platform, so the deck is supported
  // rather than glued to the top of the legs.
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
        1.1, 1.1, shade(IRON_DARK, 1.05),
      );
    }
  }

  // ---------------------------------------------------- decorative detail
  // Warm accents at the leg footings, tying masonry to iron.
  for (const [sx, sz] of LEGS) {
    b.box(sx * 44 - 12.4, 3.9, sz * 44 - 12.4, sx * 44 + 12.4, 4.7, sz * 44 + 12.4, mix(STONE, IRON_DARK, 0.45));
  }

  return b.tris;
}
