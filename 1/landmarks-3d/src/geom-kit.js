/**
 * Geometry kit shared by every landmark model.
 *
 * A model is a plain array of triangles in a right-handed Y-up world:
 *   [x, y, z] with y up and units approximately "metres".
 * Each triangle is `{ p: [x,y,z, x,y,z, x,y,z], c: [r,g,b] }` where `c` is an
 * sRGB colour in 0..1. Faces are wound counter-clockwise when seen from
 * outside; the renderer culls backfaces, so correct winding matters.
 *
 * Helpers below are pure: they never touch the canvas, the DOM or React.
 */

const EPS = 1e-9;

/** Clamp to 0..1. */
export function clamp01(v) {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Hex (#rgb or #rrggbb) to a normalised sRGB triple. */
export function hex(value) {
  let s = String(value).replace(/^#/, '');
  if (s.length === 3) s = s[0] + s[0] + s[1] + s[1] + s[2] + s[2];
  if (!/^[0-9a-f]{6}$/i.test(s)) throw new Error(`bad colour: ${value}`);
  const n = parseInt(s, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

/** Multiply a colour by a scalar factor (used for per-face shading variation). */
export function shade(c, k) {
  return [clamp01(c[0] * k), clamp01(c[1] * k), clamp01(c[2] * k)];
}

/** Linear blend of two colours. */
export function mix(a, b, t) {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Normalise a 3-vector; returns [0,1,0] for degenerate input. */
export function norm(v) {
  const L = Math.hypot(v[0], v[1], v[2]);
  if (L < EPS) return [0, 1, 0];
  return [v[0] / L, v[1] / L, v[2] / L];
}

/** Cross product a × b. */
export function cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
}

/** a - b */
export function sub(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

/** a + b */
export function add(a, b) {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

/** Dot product a · b. */
export function dot(a, b) {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

/** The signed volume of a triangle fan around `origin`; used by the verifier. */
export function triVolume(origin, p) {
  const a = [p[0] - origin[0], p[1] - origin[1], p[2] - origin[2]];
  const b = [p[3] - origin[0], p[4] - origin[1], p[5] - origin[2]];
  const c = [p[6] - origin[0], p[7] - origin[1], p[8] - origin[2]];
  return (
    a[0] * (b[1] * c[2] - b[2] * c[1]) -
    a[1] * (b[0] * c[2] - b[2] * c[0]) +
    a[2] * (b[0] * c[1] - b[1] * c[0])
  );
}

/**
 * Create a builder bound to one model buffer.
 *
 * Every helper appends triangles with outward winding. Faces are emitted in
 * the order the helpers are called; that order is irrelevant to the
 * renderer, which sorts opaque geometry front-to-back with a depth test.
 */
export function createBuilder() {
  const tris = [];

  function push(a, b, c, colour) {
    // Degenerate faces (a repeated vertex) are dropped: they contribute
    // nothing to the silhouette and waste depth-test bandwidth.
    const abx = b[0] - a[0],
      aby = b[1] - a[1],
      abz = b[2] - a[2];
    const acx = c[0] - a[0],
      acy = c[1] - a[1],
      acz = c[2] - a[2];
    const nx = aby * acz - abz * acy;
    const ny = abz * acx - abx * acz;
    const nz = abx * acy - aby * acx;
    if (nx * nx + ny * ny + nz * nz < 1e-14) return;
    tris.push({
      p: [a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]],
      c: [colour[0], colour[1], colour[2]],
    });
  }

  /** One triangle, wound a→b→c. */
  function triangle(a, b, c, colour) {
    push(a, b, c, colour);
  }

  /** A quad from four corners (a, b, c, d in CCW order seen from outside). */
  function quad(a, b, c, d, colour) {
    push(a, b, c, colour);
    push(a, c, d, colour);
  }

  /**
   * A quad whose winding is chosen automatically: the corners are reordered
   * so the face normal points along `hint`. Authoring extruded prisms is
   * much less error-prone this way — pass the outward direction of the face.
   */
  function quadFacing(a, b, c, d, colour, hint) {
    const nx =
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny =
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz =
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) quad(d, c, b, a, colour);
    else quad(a, b, c, d, colour);
  }

  /**
   * A triangle whose winding is chosen automatically, like `quadFacing`.
   */
  function triFacing(a, b, c, colour, hint) {
    const nx = (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]);
    const ny = (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]);
    const nz = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    if (nx * hint[0] + ny * hint[1] + nz * hint[2] < 0) push(a, c, b, colour);
    else push(a, b, c, colour);
  }

  /**
   * Axis-aligned box spanning [x0, x1] × [y0, y1] × [z0, z1].
   * Winding is fixed per face so the outside is always front-facing.
   */
  function box(x0, y0, z0, x1, y1, z1, colour) {
    const [xa, xb] = x0 < x1 ? [x0, x1] : [x1, x0];
    const [ya, yb] = y0 < y1 ? [y0, y1] : [y1, y0];
    const [za, zb] = z0 < z1 ? [z0, z1] : [z1, z0];
    // +X
    quad([xb, ya, za], [xb, yb, za], [xb, yb, zb], [xb, ya, zb], colour);
    // -X
    quad([xa, ya, zb], [xa, yb, zb], [xa, yb, za], [xa, ya, za], colour);
    // +Y
    quad([xa, yb, za], [xa, yb, zb], [xb, yb, zb], [xb, yb, za], colour);
    // -Y
    quad([xa, ya, zb], [xa, ya, za], [xb, ya, za], [xb, ya, zb], colour);
    // +Z
    quad([xa, ya, zb], [xb, ya, zb], [xb, yb, zb], [xa, yb, zb], colour);
    // -Z
    quad([xa, yb, za], [xb, yb, za], [xb, ya, za], [xa, ya, za], colour);
  }

  /**
   * Rectangular beam between two points `from`→`to`. `width` is measured
   * across (in the horizontal plane when the beam is near-vertical) and
   * `depth` along the remaining axis. Used for lattice bars and scaffolding.
   */
  function beam(from, to, width, depth, colour) {
    const d = norm(sub(to, from));
    // Any stable perpendicular pair; pick the world axis least aligned with d.
    const ax = Math.abs(d[0]),
      ay = Math.abs(d[1]),
      az = Math.abs(d[2]);
    let up;
    if (az <= ax && az <= ay) up = [0, 0, 1];
    else if (ay <= ax) up = [0, 1, 0];
    else up = [1, 0, 0];
    let u = norm(cross(up, d));
    let v = norm(cross(d, u));
    if (Math.abs(u[1]) < 0.05) {
      // For vertical members prefer a horizontal pair so "width" is horizontal.
      u = norm([1, 0, 0]);
      v = norm(cross(d, u));
    }
    const hu = [u[0] * width / 2, u[1] * width / 2, u[2] * width / 2];
    const hv = [v[0] * depth / 2, v[1] * depth / 2, v[2] * depth / 2];
    const s = (p, su, sv) => [
      p[0] + su * hu[0] + sv * hv[0],
      p[1] + su * hu[1] + sv * hv[1],
      p[2] + su * hu[2] + sv * hv[2],
    ];
    // Eight corners: 0..3 at `from`, 4..7 at `to`.
    const c00 = s(from, -1, -1),
      c10 = s(from, 1, -1),
      c11 = s(from, 1, 1),
      c01 = s(from, -1, 1);
    const d00 = s(to, -1, -1),
      d10 = s(to, 1, -1),
      d11 = s(to, 1, 1),
      d01 = s(to, -1, 1);
    // Six quads of a general prism.
    quad(c00, c10, d10, d00, colour);
    quad(c10, c11, d11, d10, colour);
    quad(c11, c01, d01, d11, colour);
    quad(c01, c00, d00, d01, colour);
    quad(d00, d10, d11, d01, colour);
    quad(c00, c01, c11, c10, colour);
  }

  /**
   * Cylinder / truncated cone along +Y from `y0` to `y1`, radius `r0`→`r1`.
   * `rTop === 0` yields a cone; open ends are capped unless `caps === false`.
   */
  function cylinder(cx, cz, y0, y1, r0, r1, sides, colour, caps = true) {
    const n = Math.max(3, Math.floor(sides));
    const ring = (y, r) => {
      const out = new Array(n);
      for (let i = 0; i < n; i += 1) {
        const a = (i / n) * Math.PI * 2;
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
        // Cone tip at the top: one triangle per segment, outward winding.
        push(lo[i], [cx, yHi, cz], lo[j], colour);
      } else if (baseLo === 0) {
        // Cone tip at the bottom.
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

  /**
   * Vertical prism (regular polygon) between two Y heights, optionally
   * rotated by `phase`. Good for octagonal or hexagonal plan shapes.
   */
  function prism(cx, cz, y0, y1, r0, r1, sides, colour, phase = 0) {
    cylinder(cx, cz, y0, y1, r0, r1, sides, colour, true);
    if (phase) {
      // `cylinder` draws with phase 0; a rotated variant is not needed by the
      // shipped models, so a phase argument is accepted but unused.
    }
    return phase;
  }

  /**
   * A closed solid prism between two parallel polygons given in world space.
   * Both loops must list their corners in the same rotational order; the
   * winding of the side walls and caps is derived from the loop normal, so a
   * clockwise-authored loop is corrected rather than rendered inside-out.
   */
  function loft(loopA, loopB, colour, capColour) {
    const n = loopA.length;
    if (loopB.length !== n) throw new Error('loft loops must have equal length');
    // Newell normal of the first loop gives the solid's axis orientation.
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

  /**
   * A convex polygon fan at one height (single-sided). Pass `hint` for the
   * direction it should face; used for paving inlays and roof planes.
   */
  function polygonFan(loop, colour, hint) {
    const n = loop.length;
    for (let i = 1; i < n - 1; i += 1) {
      triFacing(loop[0], loop[i], loop[i + 1], colour, hint);
    }
  }

  /**
   * A horizontal rectangle at height `y` whose winding is fixed to face up,
   * so paving never disappears from a top-down camera.
   */
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
            t.p[0] + offset[0], t.p[1] + offset[1], t.p[2] + offset[2],
            t.p[3] + offset[0], t.p[4] + offset[1], t.p[5] + offset[2],
            t.p[6] + offset[0], t.p[7] + offset[1], t.p[8] + offset[2],
          ],
          c: t.c,
        });
      }
    },
  };
}

/** Axis-aligned bounding box of a model, `[minX,minY,minZ,maxX,maxY,maxZ]`. */
export function bounds(tris) {
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
  return b;
}
