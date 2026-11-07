/**
 * The workbench stylesheet, kept as one template string.
 *
 * Every selector is prefixed `.ve-` (no global resets, no host-token reads).
 * The dark NLE palette lives as custom properties on `.ve-root`, so the surface
 * stays identical under both host themes.
 */

export const STYLE_TAG_ID = 'video-editor'

export const css = `
.ve-root {
  --ve-bg: #101216;
  --ve-panel: #171a21;
  --ve-panel-2: #1f232c;
  --ve-line: #2b303b;
  --ve-text: #e6e9ef;
  --ve-dim: #98a1b0;
  --ve-accent: #4c8dff;
  --ve-accent-2: #7aa8ff;
  --ve-danger: #ff5f57;
  --ve-warn: #e7b24c;
  --ve-track: #12151a;
  --ve-shadow: 0 12px 32px rgba(0, 0, 0, .55);
  --ve-radius: 6px;
  position: relative;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--ve-bg);
  color: var(--ve-text);
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  font-size: 12px;
  line-height: 1.4;
  -webkit-font-smoothing: antialiased;
}
.ve-root * { box-sizing: border-box; }
.ve-num, .ve-timecode, .ve-clock, .ve-ruler-label, .ve-transport-time, .ve-duration { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }

/* ---------------------------------------------------------------- toolbar */
.ve-toolbar {
  flex: 0 0 40px;
  height: 40px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  background: var(--ve-panel);
  border-bottom: 1px solid var(--ve-line);
  user-select: none;
}
.ve-brand { display: flex; align-items: center; gap: 8px; color: var(--ve-dim); flex: 0 0 auto; }
.ve-brand svg { display: block; }
.ve-brand-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--ve-accent); flex: 0 0 auto; }
.ve-title {
  flex: 0 1 auto;
  min-width: 60px;
  max-width: 320px;
  padding: 4px 8px;
  border: 1px solid transparent;
  border-radius: var(--ve-radius);
  background: transparent;
  color: var(--ve-text);
  font: inherit;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  cursor: text;
}
.ve-title:hover { border-color: var(--ve-line); background: var(--ve-panel-2); }
.ve-title-input { border-color: var(--ve-accent); background: var(--ve-bg); outline: none; }
.ve-spacer { flex: 1 1 auto; }
.ve-field { display: flex; align-items: center; gap: 4px; color: var(--ve-dim); flex: 0 0 auto; }
.ve-field-label { font-size: 11px; letter-spacing: .02em; }
.ve-select {
  height: 24px;
  padding: 0 4px;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-panel-2);
  color: var(--ve-text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.ve-select:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 1px; }
.ve-icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 24px;
  min-width: 24px;
  padding: 0 6px;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-panel-2);
  color: var(--ve-text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
}
.ve-icon-btn:hover:not(:disabled) { border-color: var(--ve-accent-2); color: #fff; }
.ve-icon-btn:disabled { opacity: .45; cursor: default; }
.ve-icon-btn:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 1px; }
.ve-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-panel-2);
  color: var(--ve-text);
  font: inherit;
  font-size: 11px;
  cursor: pointer;
  white-space: nowrap;
}
.ve-btn:hover:not(:disabled) { border-color: var(--ve-accent-2); }
.ve-btn:disabled { opacity: .45; cursor: default; }
.ve-btn:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 1px; }
.ve-btn-primary { border-color: #2f5fae; background: #21406e; color: #fff; }
.ve-btn-primary:hover:not(:disabled) { border-color: var(--ve-accent); background: #27508a; }
.ve-btn-danger { border-color: #6a2b2b; background: #3a1d1d; color: #ffd7d5; }
.ve-btn-danger:hover:not(:disabled) { border-color: var(--ve-danger); }
.ve-btn-ghost { border-color: transparent; background: transparent; color: var(--ve-dim); }
.ve-btn-ghost:hover:not(:disabled) { border-color: var(--ve-line); color: var(--ve-text); }
.ve-warn-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 22px;
  padding: 0 8px;
  border: 1px solid #5a4520;
  border-radius: var(--ve-radius);
  background: #2a2213;
  color: var(--ve-warn);
  font-size: 11px;
  white-space: nowrap;
}
.ve-busy-chip { display: inline-flex; align-items: center; gap: 6px; height: 22px; color: var(--ve-dim); font-size: 11px; }

/* ------------------------------------------------------------------- main */
.ve-main { flex: 1 1 auto; min-height: 0; display: flex; align-items: stretch; }

/* ---------------------------------------------------------------- media bin */
.ve-bin {
  flex: 0 0 224px;
  width: 224px;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: var(--ve-panel);
  border-right: 1px solid var(--ve-line);
  position: relative;
}
.ve-bin-head {
  flex: 0 0 32px;
  height: 32px;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 8px;
  border-bottom: 1px solid var(--ve-line);
}
.ve-bin-title { font-weight: 600; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; color: var(--ve-text); }
.ve-bin-count { color: var(--ve-dim); font-size: 11px; }
.ve-bin-grow { flex: 1 1 auto; }
.ve-bin-list { flex: 1 1 auto; min-height: 0; overflow-y: auto; overflow-x: hidden; padding: 4px 0 24px; }
.ve-bin-list::-webkit-scrollbar { width: 10px; }
.ve-bin-list::-webkit-scrollbar-thumb { background: #2f3541; border-radius: 5px; }
.ve-bin-list::-webkit-scrollbar-track { background: transparent; }
.ve-bin-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border: 1px solid transparent;
  border-left: 2px solid transparent;
  cursor: grab;
  position: relative;
}
.ve-bin-row:hover { background: var(--ve-panel-2); border-left-color: var(--ve-accent-2); }
.ve-bin-row:active { cursor: grabbing; }
.ve-bin-thumb {
  flex: 0 0 64px;
  width: 64px;
  height: 36px;
  border-radius: 3px;
  overflow: hidden;
  background: #0b0d11;
  border: 1px solid var(--ve-line);
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #4a5160;
}
.ve-bin-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.ve-bin-meta { flex: 1 1 auto; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.ve-bin-name {
  font-size: 11px;
  color: var(--ve-text);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.25;
  word-break: break-all;
}
.ve-bin-sub { display: flex; align-items: center; gap: 5px; color: var(--ve-dim); font-size: 10px; }
.ve-bin-sub .ve-dot { width: 2px; height: 2px; border-radius: 50%; background: var(--ve-dim); }
.ve-bin-actions { flex: 0 0 auto; display: flex; align-items: center; gap: 2px; opacity: 0; transition: opacity .1s linear; }
.ve-bin-row:hover .ve-bin-actions, .ve-bin-row:focus-within .ve-bin-actions { opacity: 1; }
.ve-mini-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 1px solid transparent;
  border-radius: 4px;
  background: transparent;
  color: var(--ve-dim);
  cursor: pointer;
}
.ve-mini-btn:hover { border-color: var(--ve-line); background: var(--ve-bg); color: var(--ve-text); }
.ve-mini-btn-danger:hover { border-color: #6a2b2b; color: #ff9c98; }
.ve-mini-btn:focus-visible { outline: 1px solid var(--ve-accent); }
.ve-bin-empty {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 18px 16px;
  text-align: center;
  color: var(--ve-dim);
}
.ve-bin-empty svg { opacity: .5; }
.ve-bin-empty-title { color: var(--ve-text); font-size: 12px; }
.ve-bin-empty-hint { font-size: 10.5px; line-height: 1.5; color: var(--ve-dim); }
.ve-bin-drop {
  position: absolute;
  inset: 0;
  z-index: 6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 8px;
  background: rgba(16, 18, 22, .88);
  border: 1px dashed var(--ve-accent);
  color: var(--ve-accent-2);
  font-size: 12px;
  text-align: center;
  padding: 12px;
}
.ve-bin-pathbar {
  flex: 0 0 auto;
  border-top: 1px solid var(--ve-line);
  padding: 6px 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--ve-panel-2);
}
.ve-textarea {
  width: 100%;
  min-height: 52px;
  resize: vertical;
  padding: 5px 6px;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-bg);
  color: var(--ve-text);
  font: inherit;
  font-size: 11px;
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
}
.ve-textarea:focus { outline: 1px solid var(--ve-accent); outline-offset: -1px; }
.ve-row-end { display: flex; justify-content: flex-end; gap: 6px; }
.ve-inline-error { color: var(--ve-danger); font-size: 10.5px; line-height: 1.4; }
.ve-bin-uploading {
  flex: 0 0 auto;
  padding: 6px 8px;
  border-top: 1px solid var(--ve-line);
  color: var(--ve-accent-2);
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ---------------------------------------------------------------- preview */
.ve-preview-pane {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 240px;
  display: flex;
  flex-direction: column;
  background: var(--ve-bg);
  position: relative;
}
.ve-stage-wrap {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px 14px;
  background:
    radial-gradient(circle at 50% 40%, rgba(76, 141, 255, .035), transparent 60%),
    var(--ve-bg);
  overflow: hidden;
}
.ve-stage {
  position: relative;
  background: #000;
  box-shadow: 0 0 0 1px var(--ve-line), 0 10px 26px rgba(0, 0, 0, .5);
  overflow: hidden;
  max-width: 100%;
  max-height: 100%;
}
.ve-stage-fill { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }
.ve-video {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
  display: block;
}
.ve-overlay-video {
  position: absolute;
  object-fit: cover;
  background: #000;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, .6);
  pointer-events: none;
}
.ve-stage-empty {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--ve-dim);
  background:
    repeating-linear-gradient(45deg, #0c0e12, #0c0e12 8px, #0e1015 8px, #0e1015 16px);
  text-align: center;
  padding: 16px;
}
.ve-stage-empty-title { color: var(--ve-text); font-size: 12px; }
.ve-stage-empty-hint { font-size: 11px; color: var(--ve-dim); }
.ve-stage-badge {
  position: absolute;
  left: 6px;
  top: 6px;
  z-index: 3;
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 2px 6px;
  border-radius: 3px;
  background: rgba(0, 0, 0, .6);
  color: var(--ve-dim);
  font-size: 10px;
  font-variant-numeric: tabular-nums;
}
.ve-stage-error {
  position: absolute;
  left: 50%;
  bottom: 8px;
  transform: translateX(-50%);
  z-index: 3;
  padding: 3px 8px;
  border-radius: 3px;
  background: rgba(58, 20, 20, .9);
  border: 1px solid #6a2b2b;
  color: #ffc9c7;
  font-size: 10.5px;
  white-space: nowrap;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* transport */
.ve-transport {
  flex: 0 0 36px;
  height: 36px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-top: 1px solid var(--ve-line);
  background: var(--ve-panel);
  user-select: none;
}
.ve-play-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 26px;
  padding: 0;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-panel-2);
  color: var(--ve-text);
  cursor: pointer;
}
.ve-play-btn:hover { border-color: var(--ve-accent); color: #fff; }
.ve-play-btn-active { border-color: var(--ve-accent); background: #21406e; color: #fff; }
.ve-play-btn:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 1px; }
.ve-transport-time { display: flex; align-items: baseline; gap: 4px; font-size: 11px; color: var(--ve-text); }
.ve-transport-current { color: var(--ve-text); font-weight: 600; }
.ve-transport-sep { color: var(--ve-dim); }
.ve-transport-total { color: var(--ve-dim); }
.ve-transport-frame { color: var(--ve-dim); font-size: 10px; }
.ve-volume { display: flex; align-items: center; gap: 4px; color: var(--ve-dim); }
.ve-range {
  -webkit-appearance: none;
  appearance: none;
  height: 14px;
  background: transparent;
  cursor: pointer;
}
.ve-range::-webkit-slider-runnable-track { height: 3px; border-radius: 2px; background: var(--ve-line); }
.ve-range::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 10px;
  height: 10px;
  margin-top: -3.5px;
  border-radius: 50%;
  background: var(--ve-accent-2);
  border: 0;
}
.ve-range::-moz-range-track { height: 3px; border-radius: 2px; background: var(--ve-line); }
.ve-range::-moz-range-thumb { width: 10px; height: 10px; border-radius: 50%; background: var(--ve-accent-2); border: 0; }
.ve-range:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 2px; }
.ve-volume-range { width: 68px; }
.ve-transport-grow { flex: 1 1 auto; }
.ve-transport-hint { color: var(--ve-dim); font-size: 10px; opacity: .8; }

/* --------------------------------------------------------------- timeline */
.ve-timeline {
  flex: 0 0 42%;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  background: var(--ve-panel);
  border-top: 1px solid var(--ve-line);
  position: relative;
  outline: none;
}
.ve-timeline:focus-visible { box-shadow: inset 0 0 0 1px rgba(76, 141, 255, .55); }
.ve-tl-head {
  flex: 0 0 30px;
  height: 30px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  border-bottom: 1px solid var(--ve-line);
  user-select: none;
}
.ve-tl-title { font-weight: 600; font-size: 11px; letter-spacing: .04em; text-transform: uppercase; }
.ve-tl-grow { flex: 1 1 auto; }
.ve-tl-total { display: flex; align-items: center; gap: 5px; color: var(--ve-dim); font-size: 11px; }
.ve-tl-total .ve-timecode { color: var(--ve-text); }
.ve-zoom { display: flex; align-items: center; gap: 5px; color: var(--ve-dim); font-size: 10.5px; }
.ve-zoom-range { width: 88px; }
.ve-zoom-value { color: var(--ve-dim); font-variant-numeric: tabular-nums; min-width: 42px; text-align: right; font-size: 10px; }
.ve-tl-body {
  flex: 1 1 auto;
  min-height: 0;
  display: flex;
  overflow: hidden;
}
.ve-tl-labels {
  flex: 0 0 84px;
  width: 84px;
  border-right: 1px solid var(--ve-line);
  background: var(--ve-panel);
  display: flex;
  flex-direction: column;
  user-select: none;
}
.ve-labels-spacer { height: 26px; flex: 0 0 26px; border-bottom: 1px solid var(--ve-line); }
.ve-track-label {
  flex: 0 0 56px;
  height: 56px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 2px;
  padding: 0 8px;
  border-top: 1px solid var(--ve-line);
}
.ve-track-label-name { font-size: 11px; color: var(--ve-text); display: flex; align-items: center; gap: 5px; }
.ve-track-label-dot { width: 5px; height: 5px; border-radius: 50%; }
.ve-track-label-dot-main { background: var(--ve-accent); }
.ve-track-label-dot-overlay { background: var(--ve-warn); }
.ve-track-label-hint { font-size: 9.5px; color: var(--ve-dim); line-height: 1.3; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
.ve-tl-scroll { flex: 1 1 auto; min-width: 0; overflow: auto; position: relative; }
.ve-tl-scroll::-webkit-scrollbar { height: 10px; width: 10px; }
.ve-tl-scroll::-webkit-scrollbar-thumb { background: #2f3541; border-radius: 5px; }
.ve-tl-scroll::-webkit-scrollbar-track { background: #0d0f13; }
.ve-tl-content { position: relative; min-height: 100%; }
.ve-ruler {
  position: sticky;
  top: 0;
  z-index: 4;
  height: 26px;
  min-width: 100%;
  background: var(--ve-panel);
  border-bottom: 1px solid var(--ve-line);
  cursor: pointer;
  user-select: none;
}
.ve-ruler-tick { position: absolute; top: 0; bottom: 0; width: 1px; background: var(--ve-line); }
.ve-ruler-tick-major { background: #3a4150; }
.ve-ruler-label {
  position: absolute;
  top: 5px;
  padding-left: 3px;
  font-size: 9.5px;
  color: var(--ve-dim);
  white-space: nowrap;
  pointer-events: none;
}
.ve-track-row {
  position: relative;
  height: 56px;
  min-width: 100%;
  background: var(--ve-track);
  border-top: 1px solid var(--ve-line);
}
.ve-track-row-empty {
  background-image: repeating-linear-gradient(90deg, rgba(255, 255, 255, .02) 0, rgba(255, 255, 255, .02) 1px, transparent 1px, transparent 64px);
}
.ve-track-drop { position: absolute; inset: 0; border: 1px dashed var(--ve-accent); background: rgba(76, 141, 255, .1); pointer-events: none; z-index: 3; }
.ve-tl-empty {
  position: absolute;
  left: 16px;
  right: 16px;
  top: 34px;
  height: 96px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: var(--ve-dim);
  border: 1px dashed #363d4a;
  border-radius: 6px;
  background: rgba(23, 26, 33, .35);
  pointer-events: none;
  z-index: 2;
}
.ve-tl-empty-title { color: var(--ve-text); font-size: 12px; }
.ve-tl-empty-hint { font-size: 10.5px; }
.ve-tl-hintbar {
  flex: 0 0 20px;
  height: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 10px;
  border-top: 1px solid var(--ve-line);
  color: var(--ve-dim);
  font-size: 9.5px;
  background: var(--ve-panel);
  white-space: nowrap;
  overflow: hidden;
  user-select: none;
}
.ve-tl-hint-key { color: #b9c1d0; }

/* clips */
.ve-clip {
  position: absolute;
  top: 4px;
  bottom: 4px;
  border-radius: 3px;
  overflow: hidden;
  background: #191d25;
  border: 1px solid #3a4150;
  border-top-width: 2px;
  cursor: grab;
  z-index: 1;
  contain: paint;
}
.ve-clip-main { border-top-color: var(--ve-accent); }
.ve-clip-overlay { border-top-color: var(--ve-warn); }
.ve-clip:hover { border-color: var(--ve-accent-2); z-index: 2; }
.ve-clip-selected { border-color: var(--ve-accent); box-shadow: 0 0 0 1px var(--ve-accent) inset; z-index: 2; }
.ve-clip-dragging { opacity: .55; z-index: 3; cursor: grabbing; }
.ve-clip-droptarget { box-shadow: inset 3px 0 0 var(--ve-accent-2); }
.ve-clip-strip { position: absolute; inset: 0; display: flex; overflow: hidden; }
.ve-clip-frame {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  object-fit: cover;
  display: block;
  background: #0b0d11;
  border-right: 1px solid rgba(0, 0, 0, .5);
  user-select: none;
  -webkit-user-drag: none;
}
.ve-clip-frame-fallback {
  flex: 1 1 0;
  min-width: 0;
  height: 100%;
  background: linear-gradient(135deg, #1b202a, #141821);
  border-right: 1px solid rgba(0, 0, 0, .5);
}
.ve-clip-shade {
  position: absolute;
  left: 0;
  right: 0;
  top: 0;
  height: 18px;
  background: linear-gradient(rgba(8, 10, 14, .88), rgba(8, 10, 14, .28));
  pointer-events: none;
}
.ve-clip-label {
  position: absolute;
  left: 5px;
  right: 5px;
  top: 2px;
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 10px;
  color: #eef1f7;
  text-shadow: 0 1px 2px #000;
  pointer-events: none;
  overflow: hidden;
}
.ve-clip-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-weight: 600; }
.ve-clip-dur { margin-left: auto; color: #b9c1d0; font-variant-numeric: tabular-nums; }
.ve-clip-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 8px;
  cursor: ew-resize;
  z-index: 2;
  background: transparent;
}
.ve-clip-handle:hover, .ve-clip-handle-active { background: linear-gradient(90deg, rgba(122, 168, 255, .55), rgba(122, 168, 255, .05)); }
.ve-clip-handle-left { left: 0; border-left: 2px solid transparent; }
.ve-clip-handle-right { right: 0; border-right: 2px solid transparent; }
.ve-clip-handle-left:hover { border-left-color: var(--ve-accent-2); }
.ve-clip-handle-right:hover { border-right-color: var(--ve-accent-2); }
.ve-clip-badge {
  position: absolute;
  right: 4px;
  bottom: 3px;
  padding: 1px 4px;
  border-radius: 2px;
  background: rgba(0, 0, 0, .62);
  color: #c9d1e0;
  font-size: 9px;
  font-variant-numeric: tabular-nums;
  pointer-events: none;
}
.ve-playhead {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  margin-left: -1px;
  background: var(--ve-danger);
  z-index: 5;
  pointer-events: none;
}
.ve-playhead::before {
  content: '';
  position: absolute;
  top: 0;
  left: -5px;
  width: 12px;
  height: 8px;
  background: var(--ve-danger);
  clip-path: polygon(0 0, 100% 0, 50% 100%);
}
.ve-playhead-handle {
  position: absolute;
  top: 0;
  width: 18px;
  height: 26px;
  margin-left: -9px;
  z-index: 6;
  cursor: ew-resize;
}

/* ------------------------------------------------------------------ modal */
.ve-modal-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(6, 8, 11, .72);
  backdrop-filter: blur(2px);
  padding: 16px;
}
.ve-modal {
  width: 420px;
  max-width: 100%;
  max-height: 100%;
  overflow: auto;
  border-radius: 8px;
  border: 1px solid var(--ve-line);
  background: var(--ve-panel);
  box-shadow: var(--ve-shadow);
  color: var(--ve-text);
}
.ve-modal-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--ve-line);
}
.ve-modal-title { font-weight: 600; font-size: 12px; }
.ve-modal-grow { flex: 1 1 auto; }
.ve-modal-body { display: flex; flex-direction: column; gap: 10px; padding: 12px; }
.ve-modal-foot { display: flex; align-items: center; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--ve-line); }
.ve-form-row { display: flex; flex-direction: column; gap: 4px; }
.ve-form-label { color: var(--ve-dim); font-size: 10.5px; letter-spacing: .02em; }
.ve-input {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--ve-line);
  border-radius: var(--ve-radius);
  background: var(--ve-bg);
  color: var(--ve-text);
  font: inherit;
  font-size: 11px;
}
.ve-input:focus { outline: 1px solid var(--ve-accent); outline-offset: -1px; }
.ve-input-mono { font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace; }
.ve-progress {
  height: 8px;
  border-radius: 4px;
  background: #0b0d11;
  border: 1px solid var(--ve-line);
  overflow: hidden;
}
.ve-progress-bar { height: 100%; background: linear-gradient(90deg, #2f6fd0, var(--ve-accent-2)); transition: width .2s linear; }
.ve-progress-meta { display: flex; align-items: center; gap: 8px; font-size: 11px; color: var(--ve-dim); }
.ve-progress-percent { margin-left: auto; color: var(--ve-text); font-variant-numeric: tabular-nums; }
.ve-output-path {
  padding: 5px 7px;
  border-radius: 4px;
  border: 1px solid var(--ve-line);
  background: var(--ve-bg);
  font-family: ui-monospace, SFMono-Regular, Consolas, 'Liberation Mono', monospace;
  font-size: 10px;
  color: var(--ve-dim);
  word-break: break-all;
  max-height: 64px;
  overflow: auto;
}
.ve-modal-note { color: var(--ve-dim); font-size: 10.5px; line-height: 1.5; }
.ve-modal-error {
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #6a2b2b;
  background: #2a1616;
  color: #ffb4b1;
  font-size: 10.5px;
  word-break: break-word;
}
.ve-link {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 26px;
  padding: 0 10px;
  border-radius: var(--ve-radius);
  border: 1px solid #2f5fae;
  background: #21406e;
  color: #fff;
  font-size: 11px;
  text-decoration: none;
  white-space: nowrap;
}
.ve-link:hover { border-color: var(--ve-accent); background: #27508a; }

/* -------------------------------------------------------------- error card */
.ve-error-card {
  margin: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1px solid #6a2b2b;
  background: #241717;
  color: #ffd0ce;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 11px;
}
.ve-error-card-body { flex: 1 1 auto; min-width: 0; }
.ve-error-card-title { color: #ff9c98; font-weight: 600; margin-bottom: 2px; }
.ve-error-card-detail { color: #e7bcba; font-size: 10.5px; word-break: break-word; }
.ve-error-inline {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 8px 10px 0;
  padding: 6px 8px;
  border-radius: 4px;
  border: 1px solid #6a2b2b;
  background: #241717;
  color: #ffb4b1;
  font-size: 10.5px;
}
.ve-error-inline-body { flex: 1 1 auto; min-width: 0; word-break: break-word; }

/* ------------------------------------------------------------- opener row */
.ve-opener-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 10px;
  border: 0;
  border-radius: 6px;
  background: transparent;
  color: var(--ve-text);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  text-align: left;
}
.ve-opener-row:hover { background: var(--ve-panel-2); }
.ve-opener-row:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: -2px; }
.ve-opener-icon { display: flex; align-items: center; justify-content: center; width: 16px; height: 16px; color: var(--ve-accent-2); flex: 0 0 auto; }
.ve-opener-label { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.ve-opener-title { font-size: 12px; color: var(--ve-text); }
.ve-opener-detail { font-size: 10px; color: var(--ve-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* -------------------------------------------------------------- dock strip */
.ve-dock {
  display: flex;
  align-items: center;
  gap: 7px;
  height: 26px;
  padding: 0 9px;
  border: 1px solid var(--ve-line);
  border-radius: 8px;
  background: var(--ve-panel);
  color: var(--ve-dim);
  font-size: 11px;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  cursor: pointer;
  width: 100%;
  text-align: left;
  user-select: none;
}
.ve-dock:hover { border-color: #3d4657; color: var(--ve-text); }
.ve-dock:focus-visible { outline: 1px solid var(--ve-accent); outline-offset: 1px; }
.ve-dock-icon { display: flex; align-items: center; color: var(--ve-accent-2); flex: 0 0 auto; }
.ve-dock-label { color: var(--ve-text); font-size: 11px; white-space: nowrap; }
.ve-dock-meta { color: var(--ve-dim); font-size: 11px; font-variant-numeric: tabular-nums; white-space: nowrap; }
.ve-dock-grow { flex: 1 1 auto; min-width: 4px; }
.ve-dock-hint { color: var(--ve-dim); font-size: 10px; opacity: .68; white-space: nowrap; }
.ve-dock-dot { width: 4px; height: 4px; border-radius: 50%; background: #3d4657; flex: 0 0 auto; }

/* ---------------------------------------------------------------- spinner */
.ve-spin { display: inline-block; width: 10px; height: 10px; border-radius: 50%; border: 1.5px solid rgba(122, 168, 255, .35); border-top-color: var(--ve-accent-2); animation: ve-spin .8s linear infinite; }
@keyframes ve-spin { to { transform: rotate(360deg); } }
`

/**
 * Insert the stylesheet once, keyed by a stable id.
 * @returns {Function} disposer removing the tag.
 */
export function insertStyles() {
  const doc = typeof document === 'undefined' ? undefined : document
  if (doc === undefined) return () => {}
  const selector = `style[data-plugin-css="${STYLE_TAG_ID}"]`
  const existing = doc.querySelector(selector)
  if (existing !== null) return () => {}
  const tag = doc.createElement('style')
  tag.dataset.plugin = '@local/video-editor'
  tag.dataset.pluginCss = STYLE_TAG_ID
  tag.textContent = css
  doc.head.appendChild(tag)
  return () => {
    try {
      tag.remove()
    } catch {
      // head already replaced (page teardown)
    }
  }
}
