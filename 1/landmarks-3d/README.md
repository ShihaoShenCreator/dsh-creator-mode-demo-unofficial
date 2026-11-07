# Landmark studio (`@local/dsh-landmarks-3d`)

A DeepSeek Harness plugin: a **Landmark studio** entry in the left sidebar that
opens a full-page 3D gallery of four monuments — the Eiffel Tower, the Great
Wall, the Forbidden City and the Taj Mahal — each a hand-authored mesh
rendered in real time with WebGL.

Nothing is downloaded. Every model is generated from code at load time, so the
plugin works offline and has no asset pipeline.

## What you get

- **Left sidebar entry** (`sidebar.panellist`, id `landmarks3d`) beside Plugins,
  Skins and Schedules. Its label follows the active locale.
- **A main panel** (`main`, key `landmarks3d`) that the sidebar entry selects.
- **Four orbitable models**, switchable from the left rail, each with a caption
  (name, place, one-line note) and live counts of triangles and height.
- **Interaction**: drag to orbit, non-passive wheel to zoom, double-click or the
  Reset button to return to the opening view. Auto-rotate toggles on and off.
- **Theme aware**: the stage sky, ground disc and contact shadow are derived
  from the active light/dark theme; every host control uses `--dsw-alias-*`
  tokens.
- **Both languages**: English and Chinese copy, registered through the Client
  locale service.

| Landmark | Triangles | Real-world height modelled |
|:--|--:|:--|
| Eiffel Tower, Paris | 18 912 | 330 m |
| Great Wall at Badaling | 9 240 | wall ~8.5 m on a ~47 m ridge |
| Forbidden City, Beijing | 6 393 | ~38 m (Hall of Supreme Justice + terrace) |
| Taj Mahal, Agra | 14 129 | 65 m |

## Layout

```
package.json           bundle manifest: dsh.bundle.patch + dsh.client
cordis.patch.yml       inserts the plugin row
index.js               Host half (no Host behaviour; all rendering is Client side)
client.js              built bundle — the only file the browser loads
icon.svg               plugin icon
locale/en.json         Plugin Manager display metadata (English)
locale/zh.json         Plugin Manager display metadata (Chinese)

src/geom-kit.js        mesh builder: boxes, beams, cylinders, lofts, winding helpers
src/models/*.js        one module per landmark, each exporting build() -> triangles
src/view/math.js       4x4 matrix and vector helpers
src/view/renderer.js   WebGL renderer: flat-shaded faces, sun + hemisphere, framing
src/client/ui.js       the panel, stage, camera controls, service adapters
src/client/models.js   model registry with memoised builds
src/client/locale-data.js  UI copy (en + zh) and the landmark list

tools/                 build and verification scripts (not shipped)
preview/               offline PNG previews (development aid, not shipped)
MODEL-SPEC.md          the mesh contract each model follows
```

## Build

`client.js` is generated; edit `src/` and rebuild:

```powershell
npm install --no-save esbuild@0.28.2 react@18 react-dom@18
node tools/build-client.mjs
```

React stays external (`require('react')` from the browser module table); every
other module is inlined into the single loader-wrapped file.

## Verify

```powershell
node tools/verify.mjs            # the whole suite
node tools/verify.mjs --no-preview
```

| Step | What it proves |
|:--|:--|
| `verify-models.mjs` | Mesh sanity: triangle counts, real-world bounds, no NaN vertices, no zero-area faces, consistent winding, outward-facing volume |
| `check-bundle.mjs` | Manifest, exports, `files[]`, loader id, no forbidden Client imports, dictionary parity across languages, icon validity |
| `smoke.mjs` | The renderer against a recording fake WebGL context: shaders link, buffers are sized, three passes draw, matrices are finite, framing fits the model, context loss is handled |
| `render-check.mjs` | The panel rendered through React's server renderer in both locales: no missing keys, canvas mounted, controls carry accessible state, colour policy respected |
| `integration.mjs` | The **built `client.js`** executed as the browser does: loader contract, `apply` registers the panel and a matching sidebar entry, dictionaries register, disposers are owned, the registered panel renders |
| `preview.mjs` | Rasterises each model to `preview/*.png` with a software rasteriser so the geometry can be eyeballed |

The previews are a development aid, not the shipped renderer: the plugin draws
with WebGL in the page. `preview.mjs` shares only the mesh format with it.

## Design notes

**Continuous silhouettes.** Each of the four models is built to be recognised
from a single 3/4 view: the Eiffel Tower's legs merge into one unbroken shaft
(an earlier version left a visible gap and was rejected on preview), the Great
Wall sits on a ridge that dips through a saddle, the Forbidden City's hall
dominates its court, and the Taj Mahal's symmetry is mirrored about `x = 0`.

**Composition over literal scale.** A 1 km wall on a 27 m ridge reads as a
scratch on a plane, and a 64 m hall in a 750 m court reads as a speck. Both are
compressed so the architecture fills the frame; the proportions that matter are
preserved. This is documented in each model's module header.

**Winding is enforced, not hoped for.** `geom-kit` derives the orientation of
generated faces from the solid's own axis (`loft`, `quadFacing`, `triFacing`),
and the verifier independently checks signed volume and shared-edge
consistency. Backface culling then means a mis-wound face would vanish rather
than merely darken.

**Framing is solved, not tuned.** The camera distance comes from projecting the
model's eight bounding-box corners onto the camera axes and taking the smallest
distance that keeps all of them inside the frustum. A tower is limited by the
vertical half-angle, a wall by the horizontal one.

**Failure stays local.** A crash boundary wraps the panel, WebGL context loss
stops drawing without throwing, and a model that fails to build shows an error
instead of blanking the slot.

## Install

```powershell
# via the agent's plugin_manager: action=install_bundle, target=<this directory>
```

The bundle is linked into the profile, so editing `client.js` and refreshing the
page is enough to see changes; the Host row requires no restart because it has
no runtime behaviour.

## Licensing

All geometry, copy and artwork in this plugin are original work authored for
this plugin. No third-party models, textures or fonts are included.
