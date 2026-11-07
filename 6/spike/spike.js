/**
 * spike/spike.js — paper-reader rendering core, extracted as a *factory*.
 *
 * DESIGN CONTRACT (why this file looks the way it does)
 * ----------------------------------------------------
 * This module is written to be the source for a plain-JS DSH client plugin
 * bundle: hand-written JS, no bundler, no `import` of npm modules, no React.
 * The only external dependency is the pdf.js module namespace, *injected* by
 * the caller so the plugin can own how (and from where) pdf.js is loaded.
 *
 *   import { createPdfReader } from "./spike.js";
 *
 *   const reader = createPdfReader({
 *     pdfjsLib,                // namespace object of pdfjs-dist/build/pdf.min.mjs
 *     workerSrc,               // URL of pdf.worker.min.mjs   (module worker)
 *     cMapUrl,                 // URL of .../cmaps/           (trailing slash!)
 *     standardFontDataUrl,     // URL of .../standard_fonts/  (trailing slash!)
 *     wasmUrl,                 // URL of .../wasm/            (trailing slash!)
 *     iccUrl,                  // optional: URL of .../iccs/  (trailing slash!)
 *     container,               // an empty DOM element that will hold the pages
 *     onSelection,             // (selection|null) => void, called on selection change
 *   });
 *
 * The returned controller is:
 *   open({ data } | { url }), setScale(n), getScale(), fitWidth(pageNo?),
 *   destroy(), getSelection(), search(query), addHighlight(highlight),
 *   renderHighlights(list), getHighlights(), removeHighlight(id),
 *   scrollToPage(n), getDebugState()
 *
 * Everything the real plugin needs is DOM-level: one wrapper <div> per page,
 * a <canvas> for the faithful raster, a pdf.js `TextLayer` <div> stacked on
 * top for selection, and a highlight overlay <div> between them.
 *
 * PDF.JS FACTS USED HERE (pdfjs-dist 6.3.289; line numbers refer to the
 * unminified `build/pdf.mjs` / `web/pdf_viewer.mjs` of that package)
 * ------------------------------------------------------------------
 *  getDocument .......... pdf.mjs:15422  — documented option keys are read at
 *                        15427-15464; `cMapUrl`/`standardFontDataUrl`/`wasmUrl`/`iccUrl`
 *                        go through getFactoryUrlProp (8700) which *throws*
 *                        unless the string ends with "/".
 *  isEvalSupported ....... DOES NOT EXIST in 6.3.289 (whole-package grep is
 *                        empty). Passing it is silently ignored; do not rely
 *                        on it to disable eval.
 *  page.getViewport ...... pdf.mjs:15814 — `{ scale, rotation, offsetX, offsetY, dontFlip }`;
 *                        `userUnit` is taken from the page, and `scale *= userUnit`
 *                        inside PageViewport (826).
 *  page.render ........... pdf.mjs:15851 — `{ canvasContext, canvas, viewport,
 *                        transform, background, annotationMode, ... }`; returns
 *                        a RenderTask with `.promise` / `.cancel()`.
 *  TextLayer ............. pdf.mjs:15038 — `new TextLayer({ textContentSource,
 *                        images, container, viewport })`; `.render()` (15115)
 *                        returns a promise, `.update({ viewport, onBefore })`
 *                        (15139) re-lays-out spans on zoom only, `.cancel()`
 *                        (15167). Getters `textDivs` / `textContentItemsStr`
 *                        (15173/15176).
 *  renderTextLayer / updateTextLayer ... REMOVED as exports in 6.x. The 6.x
 *                        replacement *is* the TextLayer class above. `.textLayer`
 *                        CSS + `--total-scale-factor` is still mandatory.
 *  Native subclassing ... `TextLayer` has private fields (`#scale`, `#container`),
 *                        so it cannot be subclassed/monkey-patched from a
 *                        bundle; call the public methods only.
 *  setLayerDimensions ..... pdf.mjs:1524 — writes `width: round(down,
 *                        var(--total-scale-factor) * <rawPageWidth>px,
 *                        var(--scale-round-x))`, the same for height, and
 *                        `data-main-rotation`. Exported, so we can re-run it.
 *  OutputScale ........... pdf.mjs:1547 — `pixelRatio` = devicePixelRatio.
 *  PixelsPerInch ......... 96 CSS px / 72 PDF pt; not needed here because we
 *                        define zoom 1 as "1 PDF unit = 1 CSS px".
 *
 * COORDINATES (the part that must not be guessed)
 * ---------------------------------------------
 *  four frames are in play:
 *   (P) PDF user space: y grows upwards, origin = MediaBox lower-left.
 *   (V) viewport space: page.getViewport(...) maps P -> V; origin = top-left
 *       of the *rotated* page box, y grows downwards. This is exactly the
 *       frame of the CSS pixel box of the page wrapper.
 *   (T) text-layer space: the TextLayer's private #transform
 *       `[1,0,0,-1,-pageX, pageY+pageHeight]` (pdf.mjs:15096) maps P -> T,
 *       i.e. the *unrotated* page box with y downwards. Spans are positioned
 *       in T as percentages of rawDims.pageWidth/pageHeight.
 *   (C) client/screen space: what getBoundingClientRect and
 *       Range.getClientRects return (viewport scroll included).
 *
 *  page wrapper -> V   (wrap rect, no transform on the wrapper)
 *  V -> P              viewport.convertToPdfPoint(x, y)      (pdf.mjs:914)
 *  P -> V              viewport.convertToViewportPoint(x, y)  (pdf.mjs:909)
 *  V -> C              add wrapper.getBoundingClientRect().left/top
 *  For a rotated page the wrapper is *already* rotated-sized (viewport.width
 *  /height), so measuring against the wrapper yields V directly; measuring
 *  against the text-layer div does NOT (that div carries the
 *  [data-main-rotation] transform and its getBoundingClientRect is the
 *  axis-aligned bound of the rotated box). This is the single most common
 *  bug in "selection rect on rotated PDF" code.
 *
 *  highlights are persisted as *PDF-space* rectangles
 *  `{ x1, y1, x2, y2 }` from `Util.normalizeRect` (pdf.mjs:636), so they
 *  survive zoom, rotation and reload. Exactly the same choice the viewer
 *  makes in DOMRectToPDF (web/pdf_viewer.mjs:4744).
 */

let __nextHighlightId = 1;

const MAX_CANVAS_PIXELS = 16 * 1024 * 1024; // 16M px hard cap, mirrors viewer prefs
const MAX_CANVAS_DIM = 8192;
const CULL_MARGIN = '120% 0px'; // lazy-render margin around the scroll box
const DEFAULT_PAGE_MARGIN = 10; // CSS px between pages
const MIN_ZOOM = 0.15;
const MAX_ZOOM = 8;

/* ---------------------------------------------------------------------- */
/* small helpers (pure; unit-testable in Node)                            */
/* ---------------------------------------------------------------------- */

/** Collapse runs of whitespace to one space and trim, index-preserving. */
function collapseWhitespace(raw) {
  let out = '';
  let lastWasSpace = true; // trims leading whitespace
  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v') {
      if (!lastWasSpace) {
        out += ' ';
        lastWasSpace = true;
      }
      continue;
    }
    out += ch;
    lastWasSpace = false;
  }
  return out;
}

/**
 * Search/compare normalisation that also returns a source index map.
 *
 * pdf.js itself only normalises a few Unicode ligatures (`normalizeUnicode`,
 * pdf.mjs:731) and the viewer's find controller has its own `normalize`
 * (web/pdf_viewer.mjs:660). For a reader that must match what the user typed
 * against text extracted from a PDF we do a bit more, but never in a way
 * that loses the mapping back to (item, offset):
 *
 *   - every character is NFKC-normalised individually (expanding ligatures
 *     such as U+FB01 "fi" -> "fi", which can change length);
 *   - NBSP and the various thin/zero-width spaces become U+0020;
 *   - typographic quotes/dashes are folded to ASCII;
 *   - runs of whitespace collapse to a single space;
 *   - the result is lower-cased for case-insensitive matching.
 *
 * Each emitted character records the index of the *source* character it came
 * from, so a match in normalised space maps back to raw (item, offset).
 *
 * @returns {{ text: string, map: number[] }} map[i] = source index of text[i]
 */
function normalizeWithMap(raw) {
  const out = [];
  const map = [];
  let lastWasSpace = true;
  const push = (ch, sourceIndex) => {
    out.push(ch);
    map.push(sourceIndex);
  };
  const FOLD = {
    '\u2018': "'",
    '\u2019': "'",
    '\u201a': "'",
    '\u201b': "'",
    '\u201c': '"',
    '\u201d': '"',
    '\u201e': '"',
    '\u201f': '"',
    '\u2010': '-',
    '\u2011': '-',
    '\u2012': '-',
    '\u2013': '-',
    '\u2014': '-',
    '\u2212': '-',
    '\u00ad': '', // soft hyphen: drop
    '\u200b': '', // zero-width space: drop
    '\ufeff': '', // BOM / ZWNBSP: drop
    '\u2028': ' ',
    '\u2029': ' ',
  };
  for (let i = 0; i < raw.length; i++) {
    let ch = raw[i];
    const ws = ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f' || ch === '\v' ||
      ch === '\u00a0' || ch === '\u2000' || ch === '\u2001' || ch === '\u2002' ||
      ch === '\u2003' || ch === '\u2004' || ch === '\u2005' || ch === '\u2006' ||
      ch === '\u2007' || ch === '\u2008' || ch === '\u2009' || ch === '\u200a' ||
      ch === '\u202f' || ch === '\u205f' || ch === '\u3000';
    if (ws) {
      if (!lastWasSpace) {
        push(' ', i);
        lastWasSpace = true;
      }
      continue;
    }
    if (FOLD[ch] !== undefined) {
      const folded = FOLD[ch];
      if (folded === '') continue;
      push(folded, i);
      lastWasSpace = false;
      continue;
    }
    // NFKC can expand one code point into several (ligatures, circled digits,
    // full-width forms). Expand and map every output char to the same source.
    const expanded = ch.normalize('NFKC').toLowerCase();
    for (let k = 0; k < expanded.length; k++) push(expanded[k], i);
    lastWasSpace = false;
  }
  return { text: out.join(''), map };
}

/** Normalise a plain string the same way (no index map needed). */
function normalizeQuery(raw) {
  return normalizeWithMap(raw).text.trim();
}

/** Is `rect` inside `outer` (client coordinates)? */
function rectOverlaps(rect, outer) {
  return !(
    rect.right <= outer.left ||
    rect.left >= outer.right ||
    rect.bottom <= outer.top ||
    rect.top >= outer.bottom
  );
}

/* ---------------------------------------------------------------------- */
/* pdf.js viewer helpers we re-implement (web/pdf_viewer.mjs:308-345)     */
/* ---------------------------------------------------------------------- */

/**
 * Find the simplest fraction `[num, den]` approximating x, denominator <= 8.
 * Used to round canvas dimensions to whole device pixels the way the viewer
 * does, which keeps the canvas and the text layer on the same pixel grid.
 */
function approximateFraction(x) {
  if (Math.floor(x) === x) return [x, 1];
  const xinv = 1 / x;
  const limit = 8;
  if (xinv > limit) return [1, limit];
  if (Math.floor(xinv) === xinv) return [1, xinv];
  const x_ = x > 1 ? xinv : x;
  let a = 0;
  let b = 1;
  let c = 1;
  let d = 1;
  while (true) {
    const p = a + c;
    const q = b + d;
    if (q > limit) break;
    if (x_ <= p / q) {
      c = p;
      d = q;
    } else {
      a = p;
      b = q;
    }
  }
  if (x_ - a / b < c / d - x_) return x_ === x ? [a, b] : [b, a];
  return x_ === x ? [c, d] : [d, c];
}

/** Round x down to a multiple of `div` (never below 1). */
function floorToDivide(x, div) {
  if (div <= 1) return Math.floor(x);
  return Math.floor(x / div) * div;
}

/* ---------------------------------------------------------------------- */
/* factory                                                                */
/* ---------------------------------------------------------------------- */

/**
 * @param {object} options
 * @param {object} options.pdfjsLib            pdfjs-dist module namespace
 * @param {string} options.workerSrc           URL of pdf.worker.min.mjs
 * @param {string} [options.cMapUrl]           .../cmaps/   (trailing slash)
 * @param {string} [options.standardFontDataUrl] .../standard_fonts/ (slash)
 * @param {string} [options.wasmUrl]           .../wasm/     (trailing slash)
 * @param {string} [options.iccUrl]            .../iccs/     (trailing slash)
 * @param {HTMLElement} options.container      empty host element
 * @param {(sel: object|null) => void} [options.onSelection]
 * @param {object[]} [options.highlights]      initial highlight list (JSON)
 * @param {boolean} [options.useSystemFonts]   default false (deterministic)
 * @param {number} [options.maxMountedPages]   default 8
 * @returns {object} reader controller
 */
export function createPdfReader(options = {}) {
  const {
    pdfjsLib,
    workerSrc,
    cMapUrl = null,
    standardFontDataUrl = null,
    wasmUrl = null,
    iccUrl = null,
    container,
    onSelection = null,
    highlights: initialHighlights = null,
    useSystemFonts = false,
    maxMountedPages = 8,
    verbosity = 0,
  } = options;

  if (!pdfjsLib || typeof pdfjsLib.getDocument !== 'function') {
    throw new TypeError('createPdfReader: `pdfjsLib` must be the pdfjs-dist module namespace');
  }
  if (!container || container.nodeType !== 1) {
    throw new TypeError('createPdfReader: `container` must be a DOM element');
  }
  // getFactoryUrlProp (pdf.mjs:8700) throws unless the URL ends with "/".
  for (const [name, value] of [
    ['cMapUrl', cMapUrl],
    ['standardFontDataUrl', standardFontDataUrl],
    ['wasmUrl', wasmUrl],
    ['iccUrl', iccUrl],
  ]) {
    if (value != null && !value.endsWith('/')) {
      throw new TypeError(`createPdfReader: \`${name}\` must end with "/" (pdf.js getFactoryUrlProp)`);
    }
  }

  // The worker itself: a *module* worker (pdf.mjs:16304 `new Worker(workerSrc,
  // { type: "module" })`). GlobalWorkerOptions must be set before getDocument
  // or pdf.js throws 'No "GlobalWorkerOptions.workerSrc" specified.'
  if (workerSrc) pdfjsLib.GlobalWorkerOptions.workerSrc = workerSrc;

  const doc = container.ownerDocument;
  const win = doc.defaultView || globalThis;
  const { TextLayer, setLayerDimensions, Util, OutputScale } = pdfjsLib;

  /* ------------------------------------------------------------------- */
  /* state                                                               */
  /* ------------------------------------------------------------------- */
  let loadingTask = null;
  let pdfDoc = null;
  let zoom = 1;
  let pageStates = []; // [{ pageNumber, pageProxy, div, canvasWrap, canvas, textDiv, textLayer, ... }]
  let highlightList = Array.isArray(initialHighlights) ? initialHighlights.slice() : [];
  let selectionScheduled = false;
  let lastSelection = null;
  let renderObserver = null;
  let cullObserver = null;
  let destroyed = false;
  let maxPageWidthPt = 0; // max rotated width in PDF units, for fitWidth
  const textCache = new Map(); // pageNumber -> { items, normalized, map }

  /* ------------------------------------------------------------------- */
  /* DOM scaffold                                                        */
  /* ------------------------------------------------------------------- */
  const root = doc.createElement('div');
  root.className = 'pr-reader';
  root.setAttribute('data-component', 'paper-reader-spike');
  const pagesHost = doc.createElement('div');
  pagesHost.className = 'pr-pages';
  root.append(pagesHost);
  container.replaceChildren(root);

  /* ------------------------------------------------------------------- */
  /* geometry                                                            */
  /* ------------------------------------------------------------------- */
  // pdf.js viewer convention (web/pdf_viewer.mjs:6668-6671): the user-facing
  // zoom is multiplied by PixelsPerInch.PDF_TO_CSS_UNITS (96/72 = 4/3) before
  // it reaches getViewport(). That is why zoom 1 makes a US-Letter page 816
  // CSS px wide instead of 612 — i.e. "100%" is 96 dpi, not 72 dpi.
  const PDF_TO_CSS = (pdfjsLib.PixelsPerInch && pdfjsLib.PixelsPerInch.PDF_TO_CSS_UNITS) || 96 / 72;

  const viewportScale = (logicalScale = zoom) => logicalScale * PDF_TO_CSS;

  const pageViewport = (pageState, logicalScale = zoom) => {
    // getViewport applies page.rotate itself; PageViewport multiplies scale
    // by page.userUnit internally (build/pdf.mjs:826).
    return pageState.pageProxy.getViewport({ scale: viewportScale(logicalScale) });
  };

  /**
   * Keep the page wrapper + text layer geometry in sync with a viewport.
   *
   * CSS contract (web/pdf_viewer.css:6299-6303):
   *   --total-scale-factor = calc(--scale-factor * --user-unit)
   *   .textLayer span font-size = calc(--text-scale-factor * --font-height)
   * and PageViewport keeps `this.scale` *before* applying userUnit
   * (build/pdf.mjs:822-826) while `viewport.width = rawWidth * scale * userUnit`.
   * Therefore --scale-factor must be viewport.scale and --user-unit must be
   * viewport.userUnit — NOT viewport.scale / userUnit.
   */
  const applyPageMetrics = (pageState, viewport) => {
    const { div, textDiv, canvasWrap } = pageState;
    // Wrapper is the *rotated* page box in CSS px. The viewer does the same by
    // calling setLayerDimensions(div, viewport, mustFlip=true, mustRotate=false)
    // (web/pdf_viewer.mjs:6638) — note mustRotate=false: the wrapper must NOT
    // receive data-main-rotation, otherwise the global CSS rule rotates it a
    // second time on top of the viewport rotation.
    div.style.width = `${viewport.width}px`;
    div.style.height = `${viewport.height}px`;
    div.style.setProperty('--scale-factor', String(viewport.scale));
    if (viewport.userUnit !== 1) div.style.setProperty('--user-unit', String(viewport.userUnit));
    else div.style.removeProperty('--user-unit');
    canvasWrap.style.width = `${viewport.width}px`;
    canvasWrap.style.height = `${viewport.height}px`;
    if (textDiv) {
      // Re-run setLayerDimensions on every scale change: TextLayer.update()
      // (pdf.mjs:15139) only repositions spans; the container size is written
      // by setLayerDimensions (pdf.mjs:1524) and would otherwise go stale.
      if (roundDownSupported) {
        try {
          setLayerDimensions(textDiv, viewport);
        } catch {
          /* older/no helper: use the explicit fallback below */
        }
      } else {
        // Without CSS round(): set the raw (unrotated) page box in px. The
        // [data-main-rotation] transform still rotates it into the wrapper.
        const { pageWidth, pageHeight } = viewport.rawDims;
        textDiv.style.width = `${pageWidth * viewport.scale * viewport.userUnit}px`;
        textDiv.style.height = `${pageHeight * viewport.scale * viewport.userUnit}px`;
        textDiv.setAttribute('data-main-rotation', String(viewport.rotation));
      }
    }
  };

  // `setLayerDimensions` writes width/height with CSS `round(down, ...)`
  // (pdf.mjs:1533). Feature-detect once so an old engine still lays out.
  const roundDownSupported = (() => {
    try {
      return !!(win.CSS && win.CSS.supports && win.CSS.supports('width', 'round(down, 10px, 1px)'));
    } catch {
      return false;
    }
  })();

  /* ------------------------------------------------------------------- */
  /* page creation / teardown                                            */
  /* ------------------------------------------------------------------- */
  const buildPages = async (document) => {
    pageStates = [];
    pagesHost.replaceChildren();
    maxPageWidthPt = 0;
    for (let n = 1; n <= document.numPages; n++) {
      const pageProxy = await document.getPage(n);
      const base = pageProxy.getViewport({ scale: 1 });
      maxPageWidthPt = Math.max(maxPageWidthPt, base.width);

      const div = doc.createElement('div');
      div.className = 'pr-page';
      div.setAttribute('data-page', String(n));
      div.setAttribute('data-page-number', String(n));
      // NOTE: deliberately NOT data-main-rotation here — that attribute is the
      // text layer's own rotation marker and the CSS rule behind it rotates the
      // element it sits on (see applyPageMetrics).

      const canvasWrap = doc.createElement('div');
      canvasWrap.className = 'pr-canvas-wrap';
      const canvas = doc.createElement('canvas');
      canvas.setAttribute('role', 'presentation');
      canvasWrap.append(canvas);

      const highlightLayer = doc.createElement('div');
      highlightLayer.className = 'pr-highlights';
      highlightLayer.setAttribute('data-page', String(n));

      div.append(canvasWrap, highlightLayer);
      pagesHost.append(div);

      const state = {
        pageNumber: n,
        pageProxy,
        div,
        canvasWrap,
        canvas,
        highlightLayer,
        textDiv: null,
        textLayer: null,
        renderTask: null,
        textPromise: null,
        rendered: false,
        dirty: true,
        wantsRender: false,
        selectionBound: false,
        renderGeneration: 0,
      };
      pageStates.push(state);
      applyPageMetrics(state, pageProxy.getViewport({ scale: viewportScale(zoom) }));
    }
  };

  const mountPage = (state) => {
    // Called by IntersectionObserver when the page comes near the viewport.
    if (destroyed) return;
    if (state.rendered && !state.dirty) return;
    requestRender(state);
  };

  /**
   * Single-flight render scheduling.
   *
   * PITFALL (found empirically, see README): a zoom that arrives while a
   * page's render is still in flight must NOT be dropped. The naive
   * `if (renderTask) { dirty = true }` branch leaves the canvas painted at the
   * *old* scale while the wrapper CSS already has the new size, so the painted
   * page silently occupies only part of its box (and every selection rect,
   * which is measured against the wrapper, lands offset from the glyphs).
   * Instead we set `wantsRender` and let the running loop pick it up.
   */
  const requestRender = (state) => {
    if (destroyed) return;
    state.wantsRender = true;
    if (state.renderTask) return; // the running loop will re-run
    void runRenderLoop(state);
  };

  const runRenderLoop = async (state) => {
    while (state.wantsRender && !destroyed) {
      state.wantsRender = false;
      await renderPage(state);
    }
  };

  const unrenderPage = (state) => {
    if (!state.rendered || state.renderTask) return;
    // Free pixel memory for far-away pages; the wrapper keeps its size so the
    // scroll position is stable, and the text layer is left in place (it is
    // cheap and keeps an existing selection alive).
    const { canvas } = state;
    if (canvas.width > 1 && canvas.height > 1) {
      const ctx = canvas.getContext('2d');
      ctx?.clearRect(0, 0, canvas.width, canvas.height);
    }
    state.rendered = false;
    state.dirty = true;
  };

  const renderPage = async (state) => {
    if (destroyed) return;
    const generation = ++state.renderGeneration;
    const viewport = pageViewport(state);
    applyPageMetrics(state, viewport);

    // --- text layer (independent of the canvas; start it first so the page
    //     becomes selectable as early as possible) --------------------------
    if (!state.textLayer) {
      const { pageX, pageY, pageWidth, pageHeight } = viewport.rawDims;
      state.textDiv = doc.createElement('div');
      state.textDiv.className = 'textLayer';
      state.textDiv.tabIndex = 0;
      state.div.append(state.textDiv);
      // TextLayer reads `viewport.rawDims` for its own #transform:
      // [1,0,0,-1,-pageX, pageY+pageHeight] (pdf.mjs:15096).
      state.textLayer = new TextLayer({
        textContentSource: state.pageProxy.streamTextContent({
          includeMarkedContent: true,
          disableNormalization: true,
        }),
        container: state.textDiv,
        viewport,
      });
      state.textPromise = state.textLayer
        .render()
        .then(() => {
          if (destroyed) return;
          // The viewer adds an `endOfContent` sentinel that is stretched over
          // the page while dragging so a selection can extend to the page
          // frame (web/pdf_viewer.mjs:6236-6239).
          const endOfContent = doc.createElement('div');
          endOfContent.className = 'endOfContent';
          state.textDiv.append(endOfContent);
          bindTextLayerSelection(state);
          repaintPageHighlights(state);
        })
        .catch((ex) => {
          if (ex && ex.name === 'AbortException') return;
          if (typeof console !== 'undefined') console.error('[spike] text layer failed', ex);
        });
      applyPageMetrics(state, viewport); // TextLayer ctor re-set width/height
    } else {
      // Already built: cheap zoom update path (pdf.mjs:15139).
      state.textLayer.update({ viewport });
      applyPageMetrics(state, viewport);
    }

    // --- canvas -------------------------------------------------------------
    const outputScale = new OutputScale();
    outputScale.limitCanvas(viewport.width, viewport.height, MAX_CANVAS_PIXELS, MAX_CANVAS_DIM);
    const sfx = approximateFraction(outputScale.sx);
    const sfy = approximateFraction(outputScale.sy);
    const canvas = state.canvas;
    const rawPxWidth = floorToDivide(Math.round(viewport.width * outputScale.sx), sfx[0]);
    const rawPxHeight = floorToDivide(Math.round(viewport.height * outputScale.sy), sfy[0]);
    canvas.width = Math.max(1, rawPxWidth);
    canvas.height = Math.max(1, rawPxHeight);
    // Match the viewer's pixel-grid rounding for the text layer so spans and
    // glyphs agree on sub-pixel positions (web/pdf_viewer.mjs:7236-7249).
    const pagePxWidth = floorToDivide(Math.round(viewport.width), sfx[1]);
    const pagePxHeight = floorToDivide(Math.round(viewport.height), sfy[1]);
    state.div.style.setProperty('--scale-round-x', `${sfx[1]}px`);
    state.div.style.setProperty('--scale-round-y', `${sfy[1]}px`);
    const scaleX = pagePxWidth > 0 ? canvas.width / pagePxWidth : 1;
    const scaleY = pagePxHeight > 0 ? canvas.height / pagePxHeight : 1;
    const transform = outputScale.scaled || scaleX !== 1 || scaleY !== 1
      ? [scaleX, 0, 0, scaleY, 0, 0]
      : null;
    canvas.style.width = '100%';
    canvas.style.height = '100%';

    state.renderTask?.cancel();
    state.renderTask = null;
    try {
      const task = state.pageProxy.render({
        canvasContext: canvas.getContext('2d', { alpha: false }),
        canvas,
        viewport,
        // `intent` and `annotationMode` are the only other options the spike
        // needs; forms/annotations are left to the plugin (the paper reader
        // shows the page as printed).
      });
      state.renderTask = task;
      await task.promise;
      if (destroyed || generation !== state.renderGeneration) return;
      state.rendered = true;
      state.dirty = false;
      repaintPageHighlights(state);
      refreshDebugState();
    } catch (ex) {
      if (ex && ex.name === 'RenderingCancelledException') return;
      if (ex && ex.name === 'AbortException') return;
      if (typeof console !== 'undefined') console.error('[spike] render failed', state.pageNumber, ex);
    } finally {
      state.renderTask = null;
    }
  };

  /* ------------------------------------------------------------------- */
  /* lazy rendering                                                      */
  /* ------------------------------------------------------------------ */
  const attachObservers = () => {
    if (typeof win.IntersectionObserver !== 'function') {
      // No IntersectionObserver (old/embedded browser): render everything.
      pageStates.forEach((s) => requestRender(s));
      return;
    }
    renderObserver = new win.IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const state = pageStates[Number(entry.target.getAttribute('data-page')) - 1];
          if (state) mountPage(state);
        }
      },
      { root: root, rootMargin: CULL_MARGIN, threshold: 0 },
    );
    cullObserver = new win.IntersectionObserver(
      (entries) => {
        const mounted = pageStates.filter((s) => s.rendered).length;
        for (const entry of entries) {
          if (entry.isIntersecting) continue;
          if (mounted <= 2) continue; // never cull the only rendered page
          const state = pageStates[Number(entry.target.getAttribute('data-page')) - 1];
          if (state && pageStates.filter((s) => s.rendered).length > maxMountedPages) unrenderPage(state);
        }
      },
      { root: root, rootMargin: '300% 0px', threshold: 0 },
    );
    pageStates.forEach((s) => {
      renderObserver.observe(s.div);
      cullObserver.observe(s.div);
    });
  };

  const disconnectObservers = () => {
    renderObserver?.disconnect();
    cullObserver?.disconnect();
    renderObserver = null;
    cullObserver = null;
  };

  /* ------------------------------------------------------------------- */
  /* selection                                                           */
  /* ------------------------------------------------------------------- */
  const bindTextLayerSelection = (state) => {
    const { textDiv } = state;
    if (state.selectionBound) return;
    state.selectionBound = true;
    // Mirrors the viewer's TextLayerBuilder#bindMouse (web/pdf_viewer.mjs:6265):
    // the `.selecting` class makes the `endOfContent` sentinel cover the page
    // so a drag that leaves the page still extends the selection.
    textDiv.addEventListener('mousedown', () => textDiv.classList.add('selecting'));
    textDiv.addEventListener('copy', (event) => {
      const selection = doc.getSelection();
      if (selection) event.clipboardData?.setData('text/plain', selection.toString());
      event.preventDefault();
    });
  };

  const resetSelectingClass = () => {
    for (const state of pageStates) state.textDiv?.classList.remove('selecting');
  };

  const pageStateForNode = (node) => {
    let el = node;
    if (el && el.nodeType === 3) el = el.parentNode;
    while (el && el !== root) {
      if (el.classList?.contains('pr-page')) {
        return pageStates[Number(el.getAttribute('data-page')) - 1] || null;
      }
      el = el.parentNode;
    }
    return null;
  };

  /** Which page does a client rect belong to (largest intersection wins)? */
  const pageStateForRect = (rect) => {
    let best = null;
    let bestArea = 0;
    for (const state of pageStates) {
      if (!state.textLayer) continue;
      const box = state.div.getBoundingClientRect();
      if (!rectOverlaps(rect, box)) continue;
      const w = Math.min(rect.right, box.right) - Math.max(rect.left, box.left);
      const h = Math.min(rect.bottom, box.bottom) - Math.max(rect.top, box.top);
      const area = Math.max(0, w) * Math.max(0, h);
      if (area > bestArea) {
        bestArea = area;
        best = state;
      }
    }
    return best;
  };

  /**
   * Convert one client rect into
   *   - page-viewport CSS rect (x, y, w, h) relative to the page wrapper
   *   - normalised PDF-space rect (x1, y1, x2, y2)
   */
  const clientRectToPageRect = (state, rect) => {
    const viewport = pageViewport(state);
    const box = state.div.getBoundingClientRect();
    // wrapper -> V (viewport space, rotated frame, y down)
    const vx = rect.left - box.left;
    const vy = rect.top - box.top;
    const vx2 = vx + rect.width;
    const vy2 = vy + rect.height;
    // V -> P (PDF user space, y up)
    const [px1, py1] = viewport.convertToPdfPoint(vx, vy);
    const [px2, py2] = viewport.convertToPdfPoint(vx2, vy2);
    const pdfRect = Util.normalizeRect([px1, py1, px2, py2]);
    return {
      page: state.pageNumber,
      x: Math.round(vx * 100) / 100,
      y: Math.round(vy * 100) / 100,
      w: Math.round(rect.width * 100) / 100,
      h: Math.round(rect.height * 100) / 100,
      pdfRect: {
        x1: Math.round(pdfRect[0] * 1000) / 1000,
        y1: Math.round(pdfRect[1] * 1000) / 1000,
        x2: Math.round(pdfRect[2] * 1000) / 1000,
        y2: Math.round(pdfRect[3] * 1000) / 1000,
      },
    };
  };

  /**
   * Read the live DOM selection and turn it into the plugin-facing shape:
   *   { text, pageNumber, pageCount, rects: [{page, x, y, w, h, pdfRect}],
   *     anchorRect: {left, top, right, bottom, width, height},   // client px
   *     normalizedText }
   * Returns null when there is no non-collapsed selection inside the pages.
   */
  const computeSelection = () => {
    if (destroyed) return null;
    const selection = doc.getSelection();
    if (!selection || selection.isCollapsed || selection.rangeCount === 0) return null;
    const text = selection.toString();
    if (!text || !text.trim()) return null;

    const rects = [];
    const clientBoxes = [];
    for (let i = 0; i < selection.rangeCount; i++) {
      const range = selection.getRangeAt(i);
      if (!root.contains(range.commonAncestorContainer) && !root.contains(range.startContainer)) continue;
      const clientRects = range.getClientRects();
      for (const clientRect of clientRects) {
        if (clientRect.width <= 0 || clientRect.height <= 0) continue;
        const state = pageStateForRect(clientRect);
        if (!state) continue;
        rects.push(clientRectToPageRect(state, clientRect));
        clientBoxes.push(clientRect);
      }
    }
    if (!rects.length) return null;

    const pages = [...new Set(rects.map((r) => r.page))];
    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (const b of clientBoxes) {
      left = Math.min(left, b.left);
      top = Math.min(top, b.top);
      right = Math.max(right, b.right);
      bottom = Math.max(bottom, b.bottom);
    }

    return {
      text,
      normalizedText: normalizeQuery(text),
      pageNumber: pages[0],
      pageCount: pages.length,
      rects,
      anchorRect: {
        left: Math.round(left * 100) / 100,
        top: Math.round(top * 100) / 100,
        right: Math.round(right * 100) / 100,
        bottom: Math.round(bottom * 100) / 100,
        width: Math.round((right - left) * 100) / 100,
        height: Math.round((bottom - top) * 100) / 100,
      },
    };
  };

  const scheduleSelectionUpdate = () => {
    if (selectionScheduled) return;
    selectionScheduled = true;
    const run = () => {
      selectionScheduled = false;
      if (destroyed) return;
      const sel = computeSelection();
      lastSelection = sel;
      if (typeof onSelection === 'function') {
        try {
          onSelection(sel);
        } catch (ex) {
          if (typeof console !== 'undefined') console.error('[spike] onSelection threw', ex);
        }
      }
    };
    if (typeof win.requestAnimationFrame === 'function') win.requestAnimationFrame(run);
    else win.setTimeout(run, 16);
  };

  const onSelectionChange = () => scheduleSelectionUpdate();
  const onPointerUp = () => {
    // The `selecting` class is used only while the pointer is down.
    win.setTimeout(resetSelectingClass, 0);
    scheduleSelectionUpdate();
  };
  const onPointerDown = () => scheduleSelectionUpdate();
  doc.addEventListener('selectionchange', onSelectionChange);
  doc.addEventListener('pointerup', onPointerUp);
  doc.addEventListener('pointerdown', onPointerDown);

  /* ------------------------------------------------------------------- */
  /* highlightList                                                          */
  /* ------------------------------------------------------------------ */
  const normalizeHighlight = (input) => {
    if (!input || typeof input !== 'object') throw new TypeError('highlight must be an object');
    const page = Number(input.page);
    if (!Number.isInteger(page) || page < 1) throw new TypeError('highlight.page must be a 1-based integer');
    let pdfRect = input.pdfRect;
    if (!pdfRect && Array.isArray(input.rects) && input.rects.length) {
      // Accept the selection rects directly: merge their PDF-space boxes.
      const merged = [Infinity, Infinity, -Infinity, -Infinity];
      for (const r of input.rects) {
        if (!r.pdfRect) continue;
        merged[0] = Math.min(merged[0], r.pdfRect.x1);
        merged[1] = Math.min(merged[1], r.pdfRect.y1);
        merged[2] = Math.max(merged[2], r.pdfRect.x2);
        merged[3] = Math.max(merged[3], r.pdfRect.y2);
      }
      if (!Number.isFinite(merged[0])) throw new TypeError('highlight.rects contain no pdfRect');
      pdfRect = { x1: merged[0], y1: merged[1], x2: merged[2], y2: merged[3] };
    }
    if (!pdfRect || !Number.isFinite(pdfRect.x1) || !Number.isFinite(pdfRect.y1) ||
        !Number.isFinite(pdfRect.x2) || !Number.isFinite(pdfRect.y2)) {
      throw new TypeError('highlight needs { pdfRect: {x1,y1,x2,y2} } or rects with pdfRect');
    }
    return {
      id: input.id || `hl-${Date.now().toString(36)}-${__nextHighlightId++}`,
      page,
      color: input.color || 'yellow',
      text: typeof input.text === 'string' ? input.text : '',
      note: typeof input.note === 'string' ? input.note : '',
      createdAt: input.createdAt || new Date().toISOString(),
      pdfRect: {
        x1: pdfRect.x1,
        y1: pdfRect.y1,
        x2: pdfRect.x2,
        y2: pdfRect.y2,
      },
    };
  };

  const viewportRectForPdfRect = (state, pdfRect) => {
    const viewport = pageViewport(state);
    // P -> V: both corners; rotation is a multiple of 90 so min/max is exact.
    const [x1, y1] = viewport.convertToViewportPoint(pdfRect.x1, pdfRect.y1);
    const [x2, y2] = viewport.convertToViewportPoint(pdfRect.x2, pdfRect.y2);
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  };

  const repaintPageHighlights = (state) => {
    const layer = state.highlightLayer;
    layer.replaceChildren();
    for (const hl of highlightList) {
      if (hl.page !== state.pageNumber) continue;
      const box = viewportRectForPdfRect(state, hl.pdfRect);
      if (box.width <= 0.01 || box.height <= 0.01) continue;
      const el = doc.createElement('div');
      el.className = 'pr-highlight';
      el.setAttribute('data-highlight-id', hl.id);
      el.setAttribute('data-page', String(state.pageNumber));
      el.setAttribute('data-color', hl.color || 'yellow');
      el.style.left = `${box.left}px`;
      el.style.top = `${box.top}px`;
      el.style.width = `${box.width}px`;
      el.style.height = `${box.height}px`;
      layer.append(el);
    }
  };

  const repaintAllHighlights = () => {
    for (const state of pageStates) repaintPageHighlights(state);
    refreshDebugState();
  };

  /* ------------------------------------------------------------------- */
  /* search                                                              */
  /* ------------------------------------------------------------------ */
  const pageText = async (pageNumber) => {
    const cached = textCache.get(pageNumber);
    if (cached) return cached;
    const state = pageStates[pageNumber - 1];
    if (!state) throw new RangeError(`no page ${pageNumber}`);
    // Same text-content options as the text layer *strings*: the TextLayer is
    // built with `{ includeMarkedContent: true, disableNormalization: true }`
    // (web/pdf_viewer.mjs:6220-6223), so its `textContentItemsStr` equals
    // `getTextContent({ disableNormalization: true }).items[i].str` in order.
    // That identity is what makes (itemIndex, offset) -> TextLayer span exact.
    const textContent = await state.pageProxy.getTextContent({
      includeMarkedContent: false,
      disableNormalization: true,
    });
    const items = textContent.items.filter((item) => typeof item.str === 'string');
    const parts = [];
    const itemStartOffsets = [];
    let offset = 0;
    for (let i = 0; i < items.length; i++) {
      itemStartOffsets.push(offset);
      parts.push(items[i].str);
      offset += items[i].str.length;
    }
    const raw = parts.join('');
    const normalized = normalizeWithMap(raw);
    const entry = {
      pageNumber,
      items,
      itemStartOffsets,
      raw,
      text: normalized.text,
      map: normalized.map,
    };
    textCache.set(pageNumber, entry);
    return entry;
  };

  const searchInPage = (entry, query) => {
    const matches = [];
    if (!entry.text || !query) return matches;
    let from = 0;
    for (;;) {
      const at = entry.text.indexOf(query, from);
      if (at === -1) break;
      from = at + 1;
      const end = Math.min(entry.text.length - 1, at + query.length - 1);
      const rawStart = entry.map[at];
      const rawEnd = entry.map[end] + 1;
      // Map raw offsets -> (itemIndex, offsetWithinItem).
      let startItem = 0;
      while (startItem + 1 < entry.itemStartOffsets.length && entry.itemStartOffsets[startItem + 1] <= rawStart) {
        startItem++;
      }
      let endItem = startItem;
      while (endItem + 1 < entry.itemStartOffsets.length && entry.itemStartOffsets[endItem + 1] <= rawEnd) {
        endItem++;
      }
      const startOffset = rawStart - entry.itemStartOffsets[startItem];
      const endOffset = Math.min(entry.items[endItem].str.length, rawEnd - entry.itemStartOffsets[endItem]);
      const approxPdfRect = pdfRectForItemRange(entry.pageNumber, entry.items, startItem, endItem, startOffset, endOffset);
      matches.push({
        page: entry.pageNumber,
        itemIndex: startItem,
        endItemIndex: endItem,
        startOffset,
        endOffset,
        matchedText: entry.items
          .slice(startItem, endItem + 1)
          .map((item, idx) => (idx === 0 ? item.str.slice(startOffset)
            : idx === endItem - startItem ? item.str.slice(0, endOffset)
              : item.str))
          .join(''),
        approxPdfRect,
      });
    }
    return matches;
  };

  /**
   * Approximate PDF-space box for a run of text items between two offsets.
   * Exact enough for scroll-into-view and for a first highlight pass; the
   * exact geometry is taken from the DOM (Selection -> convertToPdfPoint).
   * item.transform is the text matrix in PDF space: [a,b,c,d,e,f] with (e,f)
   * the origin of the run on its baseline and height = hypot(c,d) (pdf.worker
   * src/core/evaluator.js textContentItem). y grows up in PDF space, so the
   * box is [x, baseline, x+width, baseline+height].
   */
  const pdfRectForItemRange = (pageNumber, items, startItem, endItem, startOffset, endOffset) => {
    const rect = [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = startItem; i <= endItem && i < items.length; i++) {
      const item = items[i];
      const t = item.transform || [1, 0, 0, 1, 0, 0];
      const height = Math.abs(Math.hypot(t[2], t[3])) || 10;
      let runStart = 0;
      let runEnd = item.str.length;
      if (i === startItem) runStart = startOffset;
      if (i === endItem) runEnd = endOffset;
      if (runEnd <= runStart) continue;
      const rawWidth = item.width || 0;
      const advance = item.str.length ? rawWidth / item.str.length : rawWidth;
      const x = t[4] + advance * runStart;
      const width = advance * (runEnd - runStart);
      const yBottom = t[5];
      const yTop = yBottom + height;
      rect[0] = Math.min(rect[0], x);
      rect[1] = Math.min(rect[1], yBottom);
      rect[2] = Math.max(rect[2], x + width);
      rect[3] = Math.max(rect[3], yTop);
    }
    if (!Number.isFinite(rect[0])) return null;
    return { x1: rect[0], y1: rect[1], x2: rect[2], y2: rect[3] };
  };

  /* ------------------------------------------------------------------- */
  /* debug surface for headless verification                             */
  /* ------------------------------------------------------------------ */
  const refreshDebugState = () => {
    root.setAttribute('data-rendered-pages', String(pageStates.filter((s) => s.rendered).length));
  };

  /* ------------------------------------------------------------------- */
  /* public controller                                                   */
  /* ------------------------------------------------------------------ */
  const controller = {
    /**
     * Load a PDF. Accepts exactly one of `{ data }` (Uint8Array) or `{ url }`.
     * Returns { numPages, fingerprints, pageWidths, pageHeights }.
     */
    async open(source = {}) {
      if (destroyed) throw new Error('reader destroyed');
      if (!source.data && !source.url) throw new TypeError('open() expects { data } or { url }');
      disconnectObservers();
      if (loadingTask) {
        try {
          await loadingTask.destroy();
        } catch {
          /* ignore */
        }
        loadingTask = null;
        pdfDoc = null;
      }
      textCache.clear();

      // Exact getDocument() options object used by the spike (see README):
      loadingTask = pdfjsLib.getDocument({
        ...(source.data ? { data: source.data } : { url: source.url }),
        cMapUrl,
        cMapPacked: true,
        standardFontDataUrl,
        wasmUrl,
        iccUrl,
        // `isEvalSupported` does not exist in 6.3.289 (removed); passing it is
        // a no-op, kept out on purpose.
        useSystemFonts, // false => standard_fonts/ substitution, deterministic
        disableFontFace: false, // false => embedded fonts render as @font-face
        isOffscreenCanvasSupported: true,
        verbosity,
      });
      pdfDoc = await loadingTask.promise;
      await buildPages(pdfDoc);
      attachObservers();
      // Render the first page eagerly: IntersectionObserver would also fire, but
      // an explicit first render makes the reader usable before the first rAF.
      if (pageStates[0]) { requestRender(pageStates[0]); await pageStates[0].textPromise; }
      repaintAllHighlights();
      refreshDebugState();
      return {
        numPages: pdfDoc.numPages,
        fingerprints: pdfDoc.fingerprints,
        pageWidths: pageStates.map((s) => s.pageProxy.getViewport({ scale: 1 }).width),
        pageHeights: pageStates.map((s) => s.pageProxy.getViewport({ scale: 1 }).height),
      };
    },

    /**
     * Set zoom. 1 == "100%" == 96 dpi, i.e. a page is rendered at
     * PixelsPerInch.PDF_TO_CSS_UNITS (4/3) times its PDF-unit size, exactly
     * like the pdf.js viewer (web/pdf_viewer.mjs:6668).
     */
    setScale(next, { anchorPageNumber = null } = {}) {
      const value = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, Number(next) || 1));
      if (Math.abs(value - zoom) < 1e-4) return zoom;
      zoom = value;
      for (const state of pageStates) {
        const viewport = pageViewport(state);
        // CSS geometry first (cheap, synchronous, keeps scroll position sane),
        // then request a re-render. requestRender() queues behind an in-flight
        // render instead of dropping the request — see the comment there.
        applyPageMetrics(state, viewport);
        state.dirty = true;
        if (state.textLayer) state.textLayer.update({ viewport });
        if (state.rendered || state.textLayer) requestRender(state);
      }
      repaintAllHighlights();
      refreshDebugState();
      if (anchorPageNumber) this.scrollToPage(anchorPageNumber, { align: 'nearest' });
      return zoom;
    },

    getScale() {
      return zoom;
    },

    /** Zoom so the widest page fits the container width. */
    fitWidth(pageNumber = null) {
      const target = pageNumber ? pageStates[pageNumber - 1] : null;
      // Raw page width in PDF units (no PDF_TO_CSS factor yet).
      const widthPt = target
        ? target.pageProxy.getViewport({ scale: 1 }).width
        : maxPageWidthPt || 612;
      const available = Math.max(120, root.clientWidth - 2 * DEFAULT_PAGE_MARGIN - 2);
      // setScale() multiplies by PDF_TO_CSS before reaching getViewport(), so
      // divide here to land exactly on `available` CSS px.
      return this.setScale(available / (widthPt * PDF_TO_CSS), { anchorPageNumber: pageNumber });
    },

    /** Remove every page, cancel rendering, terminate the worker document. */
    async destroy() {
      if (destroyed) return;
      destroyed = true;
      doc.removeEventListener('selectionchange', onSelectionChange);
      doc.removeEventListener('pointerup', onPointerUp);
      doc.removeEventListener('pointerdown', onPointerDown);
      disconnectObservers();
      for (const state of pageStates) {
        state.renderTask?.cancel();
        state.renderTask = null;
        state.renderGeneration++;
        try {
          state.textLayer?.cancel();
        } catch {
          /* ignore */
        }
      }
      pageStates = [];
      pagesHost.replaceChildren();
      if (loadingTask) {
        try {
          await loadingTask.destroy();
        } catch {
          /* ignore */
        }
        loadingTask = null;
      }
      pdfDoc = null;
      textCache.clear();
    },

    /** Live selection in the plugin-facing shape (null when nothing selected). */
    getSelection() {
      const sel = computeSelection();
      lastSelection = sel;
      return sel;
    },

    /**
     * Case/whitespace/typography-insensitive full-document search.
     * Returns { query, total, matches: [{ page, itemIndex, endItemIndex,
     * startOffset, endOffset, matchedText, approxPdfRect }] }.
     * Matching happens in normalised space and is mapped back to the
     * (itemIndex, offset) pairs that identify the TextLayer spans.
     */
    async search(rawQuery, { maxMatches = 500 } = {}) {
      const query = normalizeQuery(rawQuery || '');
      if (!query) return { query: '', total: 0, matches: [] };
      const matches = [];
      for (let n = 1; n <= (pdfDoc?.numPages || 0); n++) {
        const entry = await pageText(n);
        const found = searchInPage(entry, query);
        for (const match of found) {
          if (matches.length >= maxMatches) break;
          matches.push(match);
        }
        if (matches.length >= maxMatches) break;
      }
      return { query, total: matches.length, matches };
    },

    /**
     * Exact highlight geometry for a search match, taken from the rendered
     * text layer (Range over the spans + convertToPdfPoint), so it agrees
     * pixel-for-pixel with a user selection. Requires the page to be rendered
     * (the reader renders it on demand here).
     */
    async getMatchRects(match) {
      const state = pageStates[match.page - 1];
      if (!state) return [];
      if (!state.textLayer) {
        requestRender(state);
        await state.textPromise;
      }
      if (!state.textLayer) return [];
      const entry = await pageText(match.page);
      const textDivs = state.textLayer.textDivs;
      const startDiv = textDivs[match.itemIndex];
      const endDiv = textDivs[match.endItemIndex];
      if (!startDiv || !endDiv) return [];
      const range = doc.createRange();
      const startText = startDiv.firstChild;
      const endText = endDiv.firstChild;
      if (!startText || !endText) return [];
      try {
        range.setStart(startText, Math.min(match.startOffset, startText.length));
        range.setEnd(endText, Math.min(match.endOffset, endText.length));
      } catch {
        return [];
      }
      const rects = [];
      for (const clientRect of range.getClientRects()) {
        if (clientRect.width <= 0 || clientRect.height <= 0) continue;
        rects.push(clientRectToPageRect(state, clientRect));
      }
      if (!rects.length) {
        const fallback = pdfRectForItemRange(match.page, entry.items, match.itemIndex, match.endItemIndex,
          match.startOffset, match.endOffset);
        if (fallback) rects.push({ page: match.page, pdfRect: fallback });
      }
      return rects;
    },

    /** Add (and paint) one persisted highlight. Returns the stored record. */
    addHighlight(input) {
      const record = normalizeHighlight(input);
      highlightList.push(record);
      repaintAllHighlights();
      return record;
    },

    /** Replace the highlight store (or repaint the current one) from JSON. */
    renderHighlights(list) {
      if (Array.isArray(list)) {
        highlightList = list.map((item) => normalizeHighlight(item));
      }
      repaintAllHighlights();
      return highlightList.slice();
    },

    getHighlights() {
      return highlightList.slice();
    },

    removeHighlight(id) {
      const before = highlightList.length;
      highlightList = highlightList.filter((hl) => hl.id !== id);
      repaintAllHighlights();
      return before !== highlightList.length;
    },

    scrollToPage(pageNumber, { align = 'start' } = {}) {
      const state = pageStates[Number(pageNumber) - 1];
      if (!state) return false;
      const pageTop = state.div.offsetTop;
      if (align === 'nearest') {
        const viewTop = root.scrollTop;
        const viewBottom = viewTop + root.clientHeight;
        const pageBottom = pageTop + state.div.offsetHeight;
        if (pageTop >= viewTop && pageBottom <= viewBottom) return true;
        root.scrollTop = pageTop - DEFAULT_PAGE_MARGIN;
        return true;
      }
      root.scrollTop = pageTop - DEFAULT_PAGE_MARGIN;
      return true;
    },

    /** Spike-only inspection surface used by the headless checks. */
    getDebugState() {
      return {
        zoom,
        numPages: pdfDoc?.numPages || 0,
        renderedPages: pageStates.filter((s) => s.rendered).map((s) => s.pageNumber),
        pages: pageStates.map((s) => {
          const viewport = s.rendered || s.textLayer ? pageViewport(s) : null;
          return {
            pageNumber: s.pageNumber,
            cssWidth: s.div.style.width,
            cssHeight: s.div.style.height,
            textLayerSpans: s.textDiv ? s.textLayer?.textDivs.length ?? 0 : 0,
            textLayerItems: s.textDiv ? s.textLayer?.textContentItemsStr.length ?? 0 : 0,
            canvasPx: s.canvas.width && s.canvas.height ? [s.canvas.width, s.canvas.height] : null,
            highlightCount: s.highlightLayer.childElementCount,
            rotation: s.pageProxy.rotation,
            viewportWidth: viewport ? Math.round(viewport.width * 100) / 100 : null,
            viewportHeight: viewport ? Math.round(viewport.height * 100) / 100 : null,
          };
        }),
        highlights: highlightList.length,
        selection: lastSelection,
      };
    },

    /** @internal exposed for tests: normalisation helpers */
    _internals: { normalizeWithMap, normalizeQuery, collapseWhitespace, approximateFraction, floorToDivide },
  };

  return controller;
}

export default createPdfReader;
