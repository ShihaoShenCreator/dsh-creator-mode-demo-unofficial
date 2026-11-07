# Paper reader — delivery notes

Right-sidebar paper reader for the DSH Web GUI. Installed in profile `desktop` as the
bundle `@local/paper-reader` (row id `paper-reader`, entry `include:paper-reader`).

## Where the code is

| Path | Role |
|---|---|
| `.dsh-created-plugins/paper-reader/package.json` | bundle manifest (`dsh.bundle.patch` + `dsh.client`) |
| `.dsh-created-plugins/paper-reader/cordis.patch.yml` | one inserted Host row |
| `.dsh-created-plugins/paper-reader/index.js` | Host half: asset route + paper/annotation API routes |
| `.dsh-created-plugins/paper-reader/client.js` | Client half: tab type, tab body, selection menu, highlights/notes, ask-in-chat |
| `.dsh-created-plugins/paper-reader/locale/{en,zh}.json` | plugin display metadata (Plugins page) |
| `.dsh-created-plugins/paper-reader/icon.svg` | original icon |
| `.dsh-created-plugins/paper-reader/vendor/pdfjs/` | vendored pdf.js 6.3.289 (Apache-2.0), served offline |

Tests and research (workspace, not shipped):

| Path | Role |
|---|---|
| `tools/client-smoke.mjs` | bundle factory + registration assertions |
| `tools/host-integration.mjs` | real `Request`/`Response` drive of upload → list → read → annotate → delete + traversal guard |
| `tools/pdf-engine.mjs` | parses a real PDF with the **vendored** build and the plugin's exact option object |
| `notes/api-findings.md` | source-cited DSH client-plugin API research |

## How it works

- **Open**: the right sidebar's guide ("More tools") lists a *Paper reader* card; opening it
  registers a `paper-reader` tab type (`priority: extension`, `keepMounted: true`). The tab
  body and chip title register into the keyed `sidebar.right.pane.tab` and
  `...pane.tab.title` seats under the type id.
- **Faithful reading**: pdf.js renders each page to a canvas at the real page box, and a
  pdf.js `TextLayer` is drawn over it. Layout, fonts and images come from the document
  itself; the page is never reflowed. cMaps, standard fonts, wasm decoders and ICC profiles
  are all served same-origin from this bundle, so nothing is fetched from a CDN and text in
  CJK/CID fonts is not dropped.
- **Upload/persistence**: papers are streamed to the Host and stored under
  `$DSH_HOME/paper-reader/papers`, annotations under `.../annotations`, one JSON per paper.
  The page reaches them through exact `/api/paper-reader.*` Fetch routes inside Connection's
  shared `/api` handler, so the browser-session owner principal is enforced first.
- **Selection menu**: selecting text in the text layer shows a floating menu with
  **Highlight**, **Add note**, **Ask in chat** and **Copy**. Selection geometry is normalized
  per page (fractions of the page box), so highlights survive zoom, fit-width and relayout.
- **Ask in chat**: inserts `ask.template` from the active locale into the composer via
  `inputActions.insertText` (falling back to `setDraft`). The template exists in
  zh/en/de/es/fr/ja/pt/ru, so the inserted question follows the interface language.

## Verification (what was actually checked)

Verified:

- Bundle installs and applies (`application: applied`, one row, no warnings).
- Live Client registrations: `@local/paper-reader` is an active occupant of
  `sidebar.right.pane.tab`, `sidebar.right.pane.tab.title`, and
  `conversation.input.right` (composer bridge).
- Asset route: `pdf.min.mjs`, `pdf.worker.min.mjs`, a `.bcmap`, a `.pfb`, and `openjpeg.wasm`
  all answer `200` with correct content types; `..` / encoded traversal and directory paths
  answer 403/404.
- API routes answer `401` without the browser cookie (auth fence) and pass every behaviour
  assertion in `tools/host-integration.mjs` with one.
- Engine: the vendored build parses a real 2-page PDF, exposes the page count and viewport,
  and extracts text from both pages.
- Locale dictionaries: zh/en key parity (34 keys), every key used, and both prompt templates
  present in all six extra locales.

Not verified — requires a human in the browser:

- How the page **looks**: canvas sharpness, text-layer alignment against painted glyphs,
  the floating menu's exact position, and note/highlight appearance in light and dark themes.
- Actual mouse selection and drag behaviour, and clipboard copy.
- That the "Ask in chat" insertion lands in the real composer (the code path is
  `inputActions.insertText` then `setDraft`; both are the documented composer faces, but the
  composer owning the prop at click time could not be exercised headlessly).

If text selection looks vertically offset in the browser, the fix is the pdf.js layer CSS
contract: `--total-scale-factor` must equal `viewport.scale × viewport.userUnit` on the page
container (already set in `renderPage`), and the `.pr-textLayer` rule set in the plugin
stylesheet must stay applied while the text layer renders.
