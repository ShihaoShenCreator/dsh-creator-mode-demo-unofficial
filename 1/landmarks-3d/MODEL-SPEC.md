# Landmark model contract

Every model is one ES module under `src/models/` that exports `build()`, returning a
plain array of triangles. No DOM, no canvas, no network, no React — pure geometry.

```js
import { createBuilder, hex } from '../geom-kit.js';

export function build() {
  const b = createBuilder();
  b.box(-40, 0, -40, 40, 2, 40, hex('#cfc6b8'));   // base slab, metres
  // ... more shapes ...
  return b.tris;
}
```

## Coordinates and units

- Right-handed, **Y is up**.
- Units are **metres**, and every model is built around its own origin:
  **the ground plane is y = 0**, and the plan centre sits near x = 0, z = 0.
- Keep the model inside the footprint budget listed for your landmark below.
  The viewer normalises scale from the bounding box, so absolute size only
  matters for internal proportions — get the real-world ratios right.
- The camera looks from +Z toward −Z and slightly down, so the **front facade
  is the +Z side**. Details that should read on first sight belong there.

## Required winding

Faces are wound **counter-clockwise seen from outside**; the renderer culls
backfaces, so a wrongly wound face is invisible, not just dark. The helpers in
`src/geom-kit.js` (`box`, `quad`, `cylinder`, `beam`, `triangle`, `prism`,
`groundQuad`) all emit outward winding — prefer them over hand-built triangles.
If you must emit raw triangles, order them so `cross(b - a, c - a)` points away
from the solid.

## Geometry kit API (src/geom-kit.js)

| Helper | Meaning |
|:--|:--|
| `createBuilder()` | Fresh buffer; helpers append to `b.tris`, returned as the model |
| `hex('#rrggbb')` | sRGB triple in 0..1 for the `colour` argument |
| `shade(c, k)`, `mix(a, b, t)` | Multiplicative / blended colours for tonal variation |
| `b.box(x0,y0,z0, x1,y1,z1, c)` | Axis-aligned box (any corner order) |
| `b.quad(a, b, c, d, c)` | One quad from four `[x,y,z]` corners, CCW from outside |
| `b.triangle(a, b, c, c)` | One triangle |
| `b.beam(from, to, width, depth, c)` | Rectangular bar between two points (lattice work) |
| `b.cylinder(cx,cz, y0,y1, r0,r1, sides, c, caps)` | Cylinder / cone / frustum along +Y |
| `b.prism(cx,cz, y0,y1, r0,r1, sides, c)` | Regular vertical prism |
| `b.groundQuad(x0,z0, x1,z1, y, c)` | Flat horizontal patch at height y |
| `b.merge(other, offset)` | Append another triangle array |

Prefer many small primitives over one huge custom mesh: each primitive is
already correctly wound, and the viewer sorts and shades per triangle.

## Verification you must run before reporting back

From the plugin root (`landmarks-3d/`):

```powershell
node tools/verify-models.mjs <your-model-name>
```

It fails on NaN vertices, zero-area triangles, inconsistent winding, negative
signed volume (inward-facing surfaces), and out-of-range height/footprint. Run
it, fix what it reports, and paste the final line into your report. A model
whose file does not exist yet is reported MISSING and is not your problem.

## Style and fidelity

- Landmarks must be **recognisable from a 3/4 view at a glance**, not
  photoreal. Silhouette and proportion carry the recognition; texture does not.
- Model only what reads: main masses, the defining tiers/columns/roofs, and a
  few dozen accent details. Budget choosable: 4 000–12 000 triangles per model.
- Use a small, deliberate palette (4–8 colours) that suits the material: stone,
  brick, glazed tile, gilt bronze, gravel. Slight per-face variation via
  `shade()` is welcome; random noise is not.
- Ground contact matters: give the base a slab or terrain patch so the model
  does not float in space.
