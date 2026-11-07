# Poster workbench

A Conversation View for DeepSeek Harness. It draws the poster over the live
fluid-noise shader used by the Harness website, sets the type in the site's
Host Grotesk face, and lets the poster's title, text, and shader colors be
edited in place. The default page carries only the title — no captions, hints,
or extra chrome.

Open it from the session's view tabs (the row beside **Chat** and
**Trajectory**); the tab reads **海报** in Chinese and **Poster** in English.

## Editing

The small round button at the poster's lower right opens the editor:

- **标题 / Title** — the poster headline. Defaults to `Everything is a plugin`.
- **文字 / Text** — optional body copy. Left empty, the poster shows the
  headline only; line breaks are preserved.
- **配色 / Colors** — three palettes, or five color pickers for the shader's
  five color stops. Index 3 is the navy mid tone, index 4 the warm cream.

Edits persist in this browser's local storage. `Escape` closes the editor.

## What it is made of

| File | Role |
|---|---|
| `index.js` | Host half; renders nothing, registered so the bundle has a Loader row. |
| `src/client.js` | Client build template: the View, shader host, editor, styles, locale dictionaries. |
| `src/fragment.glsl` | WebGL2 fragment shader: the site's fluid-noise pattern with its color stops as uniforms. |
| `src/fonts.css` | `@font-face` rules embedding Host Grotesk as WOFF2 data URLs, so the view needs no network access. |
| `scripts/build-client.mjs` | Inlines the shader and font stylesheet into `client.js`. Run it after editing either source. |
| `locale/*.json` | Plugin inventory title and description. |
| `icon.svg` | Plugin icon. |

```powershell
node scripts/build-client.mjs
node scripts/smoke.mjs
```

`build-client.mjs` inlines `src/fonts.css` and `src/fragment.glsl` into `client.js`.
`smoke.mjs` loads the built bundle against a small React/context stub and checks
that it applies, registers the `conversation.view` entry, and renders the poster
with its default title.

The shader degrades to a static palette gradient when WebGL2 is unavailable, and
stops animating when the page is hidden, the view scrolls off screen, or the
reader prefers reduced motion.

## Credits

The fluid-noise pattern and the Host Grotesk typeface are adapted from the
DeepSeek Harness website. Host Grotesk is distributed under the SIL Open Font
License 1.1; the license text is in `OFL.txt` and the fonts are embedded in
`src/fonts.css` as data URLs so no separate font file is served.
